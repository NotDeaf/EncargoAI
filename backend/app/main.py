"""
Things to do:
- [X] Implement support for multiple file uploads at once (send one at a time to GPT)
- [X] Store Json results in a database (e.g. SQLite) for later retrieval and analysis
- [X] Allow user ability to edit the data extracted by ChatGPT in case of errors
- [X] Store copy of PDF in the cloud
- [] (Maybe) Allow user to select which variables to extract, or even create their own
- [X] Frontend interface should work on green yellow red tier of confidence values 
    - It knows what its doing green
    - (11 x 15 --> No response should be an assumption and yellow with a note)
    - Couldnt find at all is red
"""



import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional, Tuple

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from functools import lru_cache
from sqlmodel import Field, Session, SQLModel, create_engine, select

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - handled at runtime
    load_dotenv = None

if load_dotenv:
    load_dotenv()

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - handled at runtime
    PdfReader = None

try:
    import pytesseract
    from pdf2image import convert_from_path
except ImportError:  # pragma: no cover - optional OCR stack
    pytesseract = None
    convert_from_path = None

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - handled at runtime
    OpenAI = None

# directory where uploaded files will be stored
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SYSTEM_PROMPT_PATH = Path(__file__).parent / "SystemPrompt.md"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


class Document(SQLModel, table=True):
    """Stored upload + extraction record."""
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    stored_filename: str
    storage_path: str
    uploaded_at: datetime
    pdf_size_bytes: int
    ocr_method: Optional[str] = None
    ocr_worked: bool = True
    extraction_json: str


class DocumentUpdate(SQLModel):
    """Payload to update stored extraction data or filename."""
    filename: Optional[str] = None
    extraction: Optional[dict] = None


class DocumentResponse(SQLModel):
    """Response model for stored documents with parsed extraction."""
    id: int
    filename: str
    stored_filename: str
    storage_path: str
    uploaded_at: datetime
    pdf_size_bytes: int
    ocr_method: Optional[str] = None
    ocr_worked: bool
    extraction: dict


def init_db() -> None:
    """Create tables if they do not yet exist."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Provide a SQLModel session."""
    with Session(engine) as session:
        yield session


def _document_to_response(doc: Document) -> DocumentResponse:
    """Convert a stored Document into a response model."""
    try:
        extraction = json.loads(doc.extraction_json)
    except Exception:
        extraction = {}
    return DocumentResponse(
        id=doc.id,  # type: ignore[arg-type]
        filename=doc.filename,
        stored_filename=doc.stored_filename,
        storage_path=doc.storage_path,
        uploaded_at=doc.uploaded_at,
        pdf_size_bytes=doc.pdf_size_bytes,
        ocr_method=doc.ocr_method,
        ocr_worked=doc.ocr_worked,
        extraction=extraction,
    )


app = FastAPI(title="EncargoAI Backend")

# Allow local HTML page to call the API from another origin/port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _load_system_prompt() -> str:
    """Load the ChatGPT system prompt from disk."""
    try:
        prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
        if not prompt:
            raise ValueError("System prompt file is empty.")
        return prompt
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"Missing system prompt file at {SYSTEM_PROMPT_PATH}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load system prompt: {exc}") from exc


def _extract_text_from_pdf(file_path: Path) -> Tuple[str, str]:
    """Extract text from a PDF. Prefer native text; fall back to OCR if available."""
    text = ""
    method = "pypdf"

    if PdfReader:
        try:
            reader = PdfReader(str(file_path))
            text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
            if text:
                return text, method
        except Exception:
            text = ""

    if pytesseract and convert_from_path:
        method = "pytesseract"
        try:
            images = convert_from_path(str(file_path))
            text = "\n".join(pytesseract.image_to_string(img) for img in images).strip()
            if text:
                return text, method
        except Exception:
            text = ""

    return text, method


def _count_words(text: str) -> int:
    """Simple word count."""
    return len([token for token in text.split() if token.strip()])


def _get_uploaded_path(file_name: str) -> Path:
    """Resolve an uploaded file name to a Path or raise 404."""
    file_path = UPLOAD_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return file_path


def _coerce_response_text(response: Any) -> str:
    """Extract text output from the OpenAI responses API."""
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text

    output = getattr(response, "output", None)
    if output and isinstance(output, list):
        try:
            first = output[0]
            content = getattr(first, "content", None) or first.get("content")  # type: ignore[index]
            if content and isinstance(content, list):
                piece = content[0]
                text_obj = getattr(piece, "text", None) or piece.get("text")  # type: ignore[index]
                if text_obj:
                    if hasattr(text_obj, "value"):
                        return text_obj.value  # type: ignore[return-value]
                    if isinstance(text_obj, dict) and "value" in text_obj:
                        return text_obj["value"]
                    if isinstance(text_obj, str):
                        return text_obj
        except Exception:
            pass
    raise ValueError("Unable to parse response text from OpenAI response.")


def _call_chatgpt(file_path: Path, metadata: dict) -> dict:
    """Send PDF to OpenAI responses API for extraction."""
    if OpenAI is None:
        raise HTTPException(status_code=500, detail="OpenAI SDK not installed. Install 'openai'.")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY environment variable.")

    client = OpenAI(api_key=api_key)

    sys_prompt = (
        f"{_load_system_prompt()}\n"
        f"PDF size (bytes): {metadata.get('pdf_size_bytes')}"
    )

    # Upload PDF as file input to responses API (purpose must be "assistants")
    try:
        with open(file_path, "rb") as fh:
            uploaded = client.files.create(file=fh, purpose="assistants")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to upload PDF to OpenAI: {exc}") from exc

    try:
        response = client.responses.create(
            model="gpt-4.1",
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": sys_prompt}]},
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "Extract procurement data from this PDF and return only JSON matching the schema."},
                        {"type": "input_file", "file_id": uploaded.id},
                    ],
                },
            ],
        )
        content = _coerce_response_text(response)
        print("AI raw response:\n" + content)
        return json.loads(content)
    except Exception as exc:  # pragma: no cover - network/runtime issues
        raise HTTPException(status_code=502, detail=f"ChatGPT request failed: {exc}") from exc
    finally:
        try:
            client.files.delete(uploaded.id)
        except Exception:
            pass


@app.on_event("startup")
def _startup() -> None:
    """Initialize database on startup."""
    init_db()


@app.post("/upload", response_model=DocumentResponse)
async def upload_pdf(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Accept a file upload, store it, run extraction via ChatGPT, and persist result."""

    timestamp = datetime.utcnow().isoformat()
    suffix = Path(file.filename).suffix or ""
    safe_stem = Path(file.filename).stem or "upload"
    stored_name = file.filename
    file_path = UPLOAD_DIR / stored_name
    if file_path.exists():
        stored_name = f"{safe_stem}_{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}{suffix}"
        file_path = UPLOAD_DIR / stored_name

    # write file out
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    is_pdf = suffix.lower() == ".pdf"
    text = ""
    method = None
    if is_pdf:
        text, method = await asyncio.to_thread(_extract_text_from_pdf, file_path)
        if not text:
            raise HTTPException(
                status_code=422,
                detail="Unable to extract text from PDF. Install OCR dependencies for scanned documents.",
            )
    else:
        method = "skipped (non-PDF)"

    # run ChatGPT
    preliminary = {
        "filename": stored_name,
        "uploaded_at": timestamp,
        "pdf_size_bytes": file_path.stat().st_size,
    }
    results = await asyncio.to_thread(_call_chatgpt, file_path, preliminary)

    payload = {
        "filename": file.filename,
        "uploaded_at": timestamp,
        "ocr_worked": bool(text),
        "extraction": results,
    }
    pretty = json.dumps(payload, indent=2)
    print(pretty)

    doc = Document(
        filename=file.filename,
        stored_filename=stored_name,
        storage_path=str(file_path),
        uploaded_at=datetime.fromisoformat(timestamp),
        pdf_size_bytes=file_path.stat().st_size,
        ocr_method=method,
        ocr_worked=bool(text),
        extraction_json=json.dumps(results),
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return _document_to_response(doc)


@app.post("/ocr")
async def ocr(file_name: str):
    """Run OCR/text extraction against an uploaded PDF and return text + word count."""
    file_path = _get_uploaded_path(file_name)
    if not file_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="OCR endpoint only supports PDF files.")

    text, method = await asyncio.to_thread(_extract_text_from_pdf, file_path)
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Unable to extract text from PDF. Install OCR dependencies for scanned documents.",
        )

    metadata = {
        "filename": file_name,
        "uploaded_at": datetime.utcfromtimestamp(file_path.stat().st_mtime).isoformat(),
        "pdf_size_bytes": file_path.stat().st_size,
    }
    results = await asyncio.to_thread(_call_chatgpt, file_path, metadata)

    payload = {
        "filename": file_name,
        "uploaded_at": metadata["uploaded_at"],
        "ocr_worked": bool(text),
        "extraction": results,
    }
    pretty = json.dumps(payload, indent=2)
    print(pretty)
    return Response(content=pretty, media_type="application/json")


@app.get("/documents", response_model=list[DocumentResponse])
def list_documents(session: Session = Depends(get_session)):
    """List stored documents and their parsed extractions."""
    docs = session.exec(select(Document).order_by(Document.uploaded_at.desc())).all()
    return [_document_to_response(doc) for doc in docs]


@app.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, session: Session = Depends(get_session)):
    """Fetch a single stored document."""
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _document_to_response(doc)


@app.put("/documents/{document_id}", response_model=DocumentResponse)
def update_document(document_id: int, payload: DocumentUpdate, session: Session = Depends(get_session)):
    """Update filename or extraction JSON for a stored document."""
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.filename:
        doc.filename = payload.filename
    if payload.extraction is not None:
        doc.extraction_json = json.dumps(payload.extraction)

    session.add(doc)
    session.commit()
    session.refresh(doc)
    return _document_to_response(doc)


@app.delete("/documents/{document_id}")
def delete_document(document_id: int, session: Session = Depends(get_session)):
    """Delete a stored document and its file copy."""
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # best-effort cleanup of stored PDF
    try:
        Path(doc.storage_path).unlink(missing_ok=True)
    except Exception:
        pass

    session.delete(doc)
    session.commit()
    return {"status": "deleted", "id": document_id}


@app.post("/chat")
async def chat_with_gpt(prompt: str):
    """Placeholder for ChatGPT API integration."""
    # TODO: call OpenAI API with provided prompt
    return {"status": "not implemented", "prompt": prompt}
