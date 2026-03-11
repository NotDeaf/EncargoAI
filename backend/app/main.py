import asyncio
import base64
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Tuple

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response

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

app = FastAPI(title="EncargoAI Backend")


_SYSTEM_INSTRUCTIONS = (
    "You will be given a procurement PDF (base64). Return ONLY JSON with three fields: "
    "{"
    "\"ai_received_pdf\": bool, "
    "\"ai_can_read_pdf\": bool, "
    "\"ai_first_words\": string|null"
    "}. "
    "ai_first_words must be the first 10 TEXT words you read from the PDF content (space-separated, no base64 or binary). "
    "If you cannot read text from the PDF, set ai_can_read_pdf=false and ai_first_words=null. "
    "No prose or extra fields."
)


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


def _call_chatgpt(file_path: Path, metadata: dict) -> dict:
    """Send PDF to ChatGPT for extraction."""
    if OpenAI is None:
        raise HTTPException(status_code=500, detail="OpenAI SDK not installed. Install 'openai'.")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY environment variable.")

    client = OpenAI(api_key=api_key)

    pdf_b64 = base64.b64encode(file_path.read_bytes()).decode("utf-8")

    sys_prompt = (
        f"{_SYSTEM_INSTRUCTIONS}\n"
        f"PDF size (bytes): {metadata.get('pdf_size_bytes')}\n"
        "Remember: do not return base64 or binary; ai_first_words must be the first 10 readable text words."
    )

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": f"Original PDF (base64): {pdf_b64}"},
    ]

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content
        return json.loads(content)
    except Exception as exc:  # pragma: no cover - network/runtime issues
        raise HTTPException(status_code=502, detail=f"ChatGPT request failed: {exc}") from exc


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
        "ai_received_pdf": bool(results.get("ai_received_pdf")),
        "ai_can_read_pdf": bool(results.get("ai_can_read_pdf")),
        "ai_first_words": results.get("ai_first_words"),
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
        "ai_received_pdf": bool(results.get("ai_received_pdf")),
        "ai_can_read_pdf": bool(results.get("ai_can_read_pdf")),
        "ai_first_words": results.get("ai_first_words"),
    }
    pretty = json.dumps(payload, indent=2)
    print(pretty)
    return Response(content=pretty, media_type="application/json")


@app.post("/chat")
async def chat_with_gpt(prompt: str):
    """Placeholder for ChatGPT API integration."""
    # TODO: call OpenAI API with provided prompt
    return {"status": "not implemented", "prompt": prompt}

