"""
Things to do:
- [] Implement support for multiple file uploads at once (send one at a time to GPT)
- [] Store Json results in a database (e.g. SQLite) for later retrieval and analysis
- [] Allow user ability to edit the data extracted by ChatGPT in case of errors
- [] Store copy of PDF in the cloud
- [] (Maybe) Allow user to select which variables to extract, or even create their own
- [] Frontend interface should work on green yellow red tier of confidence values 
    - It knows what its doing green
    - (11 x 15 --> No response should be an assumption and yellow with a note)
    - Couldnt find at all is red
"""



import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Tuple

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from functools import lru_cache

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


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Accept a PDF upload, store it, run OCR/text extraction, and return metadata."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    timestamp = datetime.utcnow().isoformat()
    file_path = UPLOAD_DIR / file.filename

    # write file out
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    text, method = await asyncio.to_thread(_extract_text_from_pdf, file_path)
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Unable to extract text from PDF. Install OCR dependencies for scanned documents.",
        )

    # run ChatGPT
    preliminary = {
        "filename": file.filename,
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
    return Response(content=pretty, media_type="application/json")


@app.post("/ocr")
async def ocr(file_name: str):
    """Run OCR/text extraction against an uploaded PDF and return text + word count."""
    file_path = _get_uploaded_path(file_name)
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


@app.post("/chat")
async def chat_with_gpt(prompt: str):
    """Placeholder for ChatGPT API integration."""
    # TODO: call OpenAI API with provided prompt
    return {"status": "not implemented", "prompt": prompt}

