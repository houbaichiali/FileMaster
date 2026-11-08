"""Filename sanitising and content-based (magic number) format detection.

The browser-supplied filename and MIME type are never trusted: the real format is derived from
file contents, and the extension must agree with it.
"""
import re
import unicodedata
import zipfile
from pathlib import Path

from .errors import AppError
from .formats import normalize, kind_of

_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def valid_id(value: str) -> str:
    if not isinstance(value, str) or not _ID_RE.match(value):
        raise AppError("not_found", 404)
    return value


def sanitize_filename(name: str | None, fallback: str = "file") -> str:
    """Return a safe display name (no path components, no control chars, bounded length)."""
    name = (name or "").replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFC", name)
    name = "".join(ch for ch in name if unicodedata.category(ch)[0] != "C")
    name = re.sub(r"[<>:\"|?*]", "_", name).strip(" .")
    if not name:
        name = fallback
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    stem = stem[:100] or fallback
    return f"{stem}.{ext[:10]}" if ext else stem


def safe_stem(name: str) -> str:
    stem = Path(sanitize_filename(name)).stem
    return stem or "file"


def _sniff(path: Path, ext: str) -> str | None:
    with open(path, "rb") as fh:
        head = fh.read(4096)
    if len(head) < 4:
        return None
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head[:2] == b"BM" and len(head) > 14:
        return "bmp"
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    if b"%PDF-" in head[:1024]:
        return "pdf"
    if head[:4] == b"fLaC":
        return "flac"
    if head[:4] == b"OggS":
        return "ogg"
    if head[:3] == b"ID3":
        return "mp3"
    if head[0] == 0xFF and head[1] & 0xF6 == 0xF0:
        return "aac"
    if head[0] == 0xFF and head[1] & 0xE0 == 0xE0 and head[1] & 0x06 != 0x00:
        return "mp3"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand == b"qt  ":
            return "mov"
        if brand in (b"M4A ", b"M4B ", b"M4P "):
            return "m4a"
        return "m4a" if ext == "m4a" else "mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm" if b"webm" in head[:64] else "mkv"
    if head[:4] == b"PK\x03\x04":
        try:
            with zipfile.ZipFile(path) as zf:
                if "word/document.xml" in zf.namelist():
                    return "docx"
        except zipfile.BadZipFile:
            return None
        return None
    if ext == "txt" and b"\x00" not in head:
        return "txt"
    return None


def detect_format(path: Path, filename: str) -> str:
    """Return the verified format, or raise AppError if unsupported / extension mismatch."""
    ext = normalize(Path(filename).suffix)
    detected = _sniff(path, ext)
    if detected is None or kind_of(detected) is None:
        raise AppError("unsupported_type", 415)
    if ext != detected:
        # Same container family: a .mp4 may legitimately be an audio-only m4a, and vice versa.
        if {ext, detected} <= {"mp4", "m4a"}:
            return ext
        raise AppError("extension_mismatch", 415)
    return detected
