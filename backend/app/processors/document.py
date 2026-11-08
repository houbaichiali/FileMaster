"""Document conversion (PDF / DOCX / TXT) and PDF compression.

Limitations (also surfaced in the UI and README):
 * DOCX -> PDF is a text-and-structure rendering (headings, bold/italic/underline, tables, alignment);
   images, headers/footers and custom fonts are not reproduced.
 * PDF -> DOCX / TXT extracts text only; scanned (image-only) PDFs contain no text and are rejected.
"""
import html
import re
import shutil
from pathlib import Path

import docx
import pymupdf
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.core.errors import AppError

_XML_ILLEGAL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")


def read_text_file(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def _clean(text: str) -> str:
    return _XML_ILLEGAL.sub("", text)


def _open_pdf(path: Path) -> pymupdf.Document:
    try:
        doc = pymupdf.open(path)
    except Exception:
        raise AppError("invalid_document", 422)
    if doc.needs_pass:
        doc.close()
        raise AppError("pdf_encrypted", 422)
    return doc


def _open_docx(path: Path) -> "docx.document.Document":
    try:
        return docx.Document(str(path))
    except Exception:
        raise AppError("invalid_document", 422)


# ---- extraction -------------------------------------------------------------------------------
def pdf_to_txt(src: Path, out: Path) -> dict:
    doc = _open_pdf(src)
    pages = [p.get_text("text").strip() for p in doc]
    doc.close()
    if not any(pages):
        raise AppError("no_text_in_pdf", 422)
    out.write_text("\n\n".join(pages) + "\n", encoding="utf-8")
    return {"pages": len(pages)}


def pdf_to_docx(src: Path, out: Path) -> dict:
    doc = _open_pdf(src)
    d = docx.Document()
    found = False
    for index, page in enumerate(doc):
        if index:
            d.add_page_break()
        for block in page.get_text("blocks", sort=True):
            if block[6] != 0:
                continue
            text = _clean(" ".join(block[4].split()))
            if text:
                found = True
                d.add_paragraph(text)
    pages = len(doc)
    doc.close()
    if not found:
        raise AppError("no_text_in_pdf", 422)
    d.save(str(out))
    return {"pages": pages}


def docx_to_txt(src: Path, out: Path) -> dict:
    d = _open_docx(src)
    lines: list[str] = []
    for child in d.element.body.iterchildren():
        if child.tag.endswith("}p"):
            lines.append(Paragraph(child, d).text)
        elif child.tag.endswith("}tbl"):
            for row in Table(child, d).rows:
                lines.append("\t".join(c.text.strip() for c in row.cells))
    out.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return {}


def txt_to_docx(src: Path, out: Path) -> dict:
    d = docx.Document()
    for line in read_text_file(src).splitlines():
        d.add_paragraph(_clean(line))
    d.save(str(out))
    return {}


# ---- PDF rendering (HTML -> PDF through PyMuPDF Story) ------------------------------------------
_CSS = "body{font-family:sans-serif;font-size:11pt;line-height:1.35} h1{font-size:20pt} h2{font-size:16pt} " \
       "h3{font-size:13pt} td{padding:3pt;border:0.5pt solid #444} table{border-collapse:collapse}"


def _html_to_pdf(body: str, out: Path) -> int:
    story = pymupdf.Story(html=f"<html><body>{body}</body></html>", user_css=_CSS)
    media = pymupdf.paper_rect("a4")
    where = media + (54, 54, -54, -54)
    writer = pymupdf.DocumentWriter(str(out))
    pages, more = 0, 1
    while more:
        dev = writer.begin_page(media)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
        pages += 1
        if pages > 2000:
            break
    writer.close()
    return pages


def txt_to_pdf(src: Path, out: Path) -> dict:
    lines = read_text_file(src).splitlines() or [""]
    body = "".join(f"<p style='margin:0'>{html.escape(l) or '&nbsp;'}</p>" for l in lines)
    return {"pages": _html_to_pdf(body, out)}


def _para_html(p: Paragraph) -> str:
    style = (p.style.name or "") if p.style is not None else ""
    runs = []
    for r in p.runs:
        text = html.escape(r.text).replace("\n", "<br/>").replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
        if not text:
            continue
        if r.bold:
            text = f"<b>{text}</b>"
        if r.italic:
            text = f"<i>{text}</i>"
        if r.underline:
            text = f"<u>{text}</u>"
        runs.append(text)
    inner = "".join(runs)
    align = {1: "center", 2: "right", 3: "justify"}.get(int(p.alignment) if p.alignment is not None else -1, "left")
    if style == "Title":
        return f"<h1 style='text-align:{align}'>{inner or '&nbsp;'}</h1>"
    m = re.match(r"Heading (\d)", style)
    if m:
        return f"<h{min(int(m.group(1)), 3)} style='text-align:{align}'>{inner or '&nbsp;'}</h{min(int(m.group(1)), 3)}>"
    if style.startswith("List") and inner:
        inner = "&bull;&nbsp;" + inner
    return f"<p style='margin:0 0 4pt 0;text-align:{align}'>{inner or '&nbsp;'}</p>"


def docx_to_pdf(src: Path, out: Path) -> dict:
    d = _open_docx(src)
    parts = []
    for child in d.element.body.iterchildren():
        if child.tag.endswith("}p"):
            parts.append(_para_html(Paragraph(child, d)))
        elif child.tag.endswith("}tbl"):
            rows = []
            for row in Table(child, d).rows:
                rows.append("<tr>" + "".join(f"<td>{html.escape(c.text.strip()) or '&nbsp;'}</td>" for c in row.cells) + "</tr>")
            parts.append("<table>" + "".join(rows) + "</table><p>&nbsp;</p>")
    return {"pages": _html_to_pdf("".join(parts) or "<p>&nbsp;</p>", out)}


def convert(src_fmt: str, target: str, src: Path, out: Path) -> dict:
    fn = {("pdf", "txt"): pdf_to_txt, ("pdf", "docx"): pdf_to_docx, ("docx", "txt"): docx_to_txt,
          ("docx", "pdf"): docx_to_pdf, ("txt", "docx"): txt_to_docx, ("txt", "pdf"): txt_to_pdf}.get((src_fmt, target))
    if fn is None:
        raise AppError("unsupported_conversion", 400)
    return fn(src, out)


# ---- PDF compression ----------------------------------------------------------------------------
# level -> (dpi threshold, dpi target, JPEG quality); None = structural optimisation only
PDF_LEVELS = {"low": None, "medium": (200, 150, 80), "high": (150, 110, 65), "maximum": (110, 72, 45)}
_ORDER = ["low", "medium", "high", "maximum"]


def _compress_once(src: Path, out: Path, level: str) -> None:
    doc = _open_pdf(src)
    try:
        params = PDF_LEVELS[level]
        if params:
            thr, tgt, q = params
            doc.rewrite_images(dpi_threshold=thr, dpi_target=tgt, quality=q)
        doc.save(str(out), garbage=4, deflate=True, clean=True)
    except AppError:
        raise
    except Exception:
        raise AppError("processing_failed", 422)
    finally:
        doc.close()


def compress_pdf(src: Path, out: Path, level: str, target_bytes: int | None = None) -> dict:
    if target_bytes:
        used = "low"
        for lvl in _ORDER:
            used = lvl
            _compress_once(src, out, lvl)
            if out.stat().st_size <= target_bytes:
                return {"level": lvl, "target_reached": True}
        return {"level": used, "target_reached": False}
    _compress_once(src, out, level)
    return {"level": level}
