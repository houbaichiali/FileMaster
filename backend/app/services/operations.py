"""Business logic: each function validates options, dispatches to a processor and builds the result."""
import shutil
from pathlib import Path

from app.core.errors import AppError
from app.core.formats import AUDIO, CONVERSIONS, IMAGE, MIME, PREVIEWABLE, VIDEO, kind_of
from app.core.security import safe_stem
from app.processors import audio, document, image, video
from app.services.jobs import Job
from app.utils import storage


def _out(job: Job, ext: str) -> Path:
    return storage.dir_for(job.id, create=True) / f"output.{ext}"


def _result(meta: dict, out: Path, ext: str, suffix: str, details: dict) -> dict:
    size, orig = out.stat().st_size, meta["size"]
    return {
        "filename": f"{safe_stem(meta['original_name'])}{suffix}.{ext}",
        "original_name": meta["original_name"],
        "format": ext,
        "mime": MIME[ext],
        "size": size,
        "original_size": orig,
        "saved_bytes": orig - size,
        "saved_percent": round((orig - size) / orig * 100, 1) if orig else 0.0,
        "previewable": ext in PREVIEWABLE,
        "details": details,
    }


def convert(job: Job, meta: dict, target: str) -> tuple[Path, dict]:
    fmt, src = meta["format"], storage.source_path(meta)
    if target not in CONVERSIONS.get(fmt, []):
        raise AppError("unsupported_conversion", 400)
    out = _out(job, target)
    kind = kind_of(fmt)
    if kind == "image":
        details = image.convert(src, out, target)
    elif kind == "document":
        details = document.convert(fmt, target, src, out)
    elif kind == "audio" or (kind == "video" and target in AUDIO):
        details = audio.convert(src, out, target, job.set_progress)
    else:
        details = video.convert(src, out, target, job.set_progress)
    return out, _result(meta, out, target, "", details)


def compress(job: Job, meta: dict, opts: dict) -> tuple[Path, dict]:
    fmt, src = meta["format"], storage.source_path(meta)
    kind, level = kind_of(fmt), opts["level"]
    target_bytes = int(opts["target_size_mb"] * 1024 * 1024) if opts.get("target_size_mb") else None
    out_fmt = opts.get("output_format") or fmt
    allowed = {"image": IMAGE, "audio": AUDIO, "video": VIDEO, "document": ["pdf"]}.get(kind, [])
    if out_fmt not in allowed or (kind == "document" and fmt != "pdf"):
        raise AppError("compress_not_supported", 422, format=fmt)
    out = _out(job, out_fmt)
    if kind == "image":
        details = image.compress(src, out, out_fmt, level, opts.get("quality"), opts.get("max_width"),
                                 opts.get("max_height"), target_bytes)
    elif kind == "document":
        details = document.compress_pdf(src, out, level, target_bytes)
    elif kind == "audio":
        details = audio.compress(src, out, fmt, level, out_fmt, opts.get("bitrate_kbps"), target_bytes, job.set_progress)
    else:
        details = video.compress(src, out, fmt, level, out_fmt, opts.get("codec"), opts.get("resolution"),
                                 opts.get("video_bitrate_kbps"), target_bytes, job.set_progress)
    if not target_bytes and out_fmt == fmt and out.stat().st_size >= meta["size"] and kind in ("image", "document"):
        shutil.copyfile(src, out)  # never hand back something larger than the original
        details["already_optimal"] = True
    return out, _result(meta, out, out_fmt, "_compressed", details)


def edit_image(job: Job, meta: dict, opts: dict) -> tuple[Path, dict]:
    if meta["kind"] != "image":
        raise AppError("unsupported_conversion", 400)
    fmt = opts.get("output_format") or meta["format"]
    if fmt not in IMAGE:
        raise AppError("unsupported_format", 400)
    out = _out(job, fmt)
    details = image.edit(storage.source_path(meta), out, fmt, opts.get("crop"), opts.get("rotate", 0.0),
                         opts.get("flip_h", False), opts.get("flip_v", False), opts.get("resize"), opts.get("quality", 92))
    return out, _result(meta, out, fmt, "_edited", details)


def trim(job: Job, meta: dict, opts: dict) -> tuple[Path, dict]:
    kind, fmt, src = meta["kind"], meta["format"], storage.source_path(meta)
    if kind not in ("audio", "video"):
        raise AppError("trim_not_supported", 400)
    out_fmt = opts.get("output_format") or fmt
    if out_fmt not in (AUDIO if kind == "audio" else VIDEO):
        raise AppError("unsupported_format", 400)
    out = _out(job, out_fmt)
    module = audio if kind == "audio" else video
    details = module.trim(src, out, fmt, out_fmt, opts["start"], opts["end"], opts.get("precise", True), job.set_progress)
    return out, _result(meta, out, out_fmt, "_trimmed", details)
