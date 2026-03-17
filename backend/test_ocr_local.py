"""
Quick local OCR/text extraction test against the existing sample PDF.

Usage:
  python test_ocr_local.py

It will:
  - locate the sample PDF in the project root (Sales_020504_SO1041931.20251009-143613.pdf)
  - run the same _extract_text_from_pdf helper used by the API
  - print the first few characters and the detected extraction method
"""

from pathlib import Path

from app.main import _extract_text_from_pdf


def main():
    project_root = Path(__file__).parent.parent
    pdf_path = project_root / "Sales_020504_SO1041931.20251009-143613.pdf"
    if not pdf_path.exists():
        raise SystemExit(f"Sample PDF not found at {pdf_path}")

    text, method = _extract_text_from_pdf(pdf_path)
    if not text:
        raise SystemExit("No text extracted. Ensure pypdf or OCR dependencies are installed.")

    preview = text[:800].replace("\n", " ")
    print(f"Extraction method: {method}")
    print(f"Characters extracted: {len(text)}")
    print(f"Preview (first 800 chars):\n{preview}")


if __name__ == "__main__":
    main()
