"""Supported formats and the conversion matrix. Only implemented conversions are listed."""

IMAGE = ["jpg", "png", "webp", "bmp", "tiff"]
DOCUMENT = ["pdf", "docx", "txt"]
AUDIO = ["mp3", "wav", "aac", "flac", "ogg", "m4a"]
VIDEO = ["mp4", "mov", "webm", "mkv"]

ALIASES = {"jpeg": "jpg", "tif": "tiff"}

MIME = {
    "jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "bmp": "image/bmp", "tiff": "image/tiff",
    "pdf": "application/pdf", "txt": "text/plain; charset=utf-8",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "mp3": "audio/mpeg", "wav": "audio/wav", "aac": "audio/aac", "flac": "audio/flac",
    "ogg": "audio/ogg", "m4a": "audio/mp4",
    "mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm", "mkv": "video/x-matroska",
}

# Formats a browser can generally preview inline.
PREVIEWABLE = {"jpg", "png", "webp", "bmp", "pdf", "mp3", "wav", "aac", "flac", "ogg", "m4a", "mp4", "webm", "mov", "mkv"}

LOSSY_AUDIO = {"mp3", "aac", "ogg", "m4a"}
LOSSLESS_AUDIO = {"wav", "flac"}


def normalize(ext: str) -> str:
    ext = ext.lower().lstrip(".")
    return ALIASES.get(ext, ext)


def kind_of(fmt: str) -> str | None:
    for kind, items in (("image", IMAGE), ("document", DOCUMENT), ("audio", AUDIO), ("video", VIDEO)):
        if fmt in items:
            return kind
    return None


def targets_for(fmt: str) -> list[str]:
    kind = kind_of(fmt)
    if kind == "image":
        return [f for f in IMAGE if f != fmt]
    if kind == "document":
        return {"pdf": ["txt", "docx"], "docx": ["pdf", "txt"], "txt": ["pdf", "docx"]}[fmt]
    if kind == "audio":
        return [f for f in AUDIO if f != fmt]
    if kind == "video":
        return [f for f in VIDEO if f != fmt] + list(AUDIO)  # audio targets = audio extraction
    return []


CONVERSIONS = {f: targets_for(f) for f in IMAGE + DOCUMENT + AUDIO + VIDEO}
