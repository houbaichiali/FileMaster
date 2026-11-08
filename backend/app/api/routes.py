import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from app.api.schemas import CompressRequest, ConvertRequest, ImageEditRequest, TrimRequest
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.formats import CONVERSIONS, MIME, PREVIEWABLE, kind_of, normalize
from app.core.security import detect_format, sanitize_filename, valid_id
from app.services import operations as ops
from app.services.jobs import get_manager
from app.utils import storage
from app.utils.ffmpeg import probe

router = APIRouter(prefix="/api")

_NO_SNIFF = {"X-Content-Type-Options": "nosniff"}


def _opt_fmt(value: str | None) -> str | None:
    return normalize(value) if value else None


@router.get("/health")
def health():
    return {"status": "ok", "ffmpeg": shutil.which(get_settings().ffmpeg_path) is not None,
            "ffprobe": shutil.which(get_settings().ffprobe_path) is not None}


@router.get("/formats")
def formats():
    s = get_settings()
    return {"conversions": CONVERSIONS, "max_upload_mb": s.max_upload_mb, "ttl_minutes": s.file_ttl_minutes,
            "levels": ["low", "medium", "high", "maximum"]}


@router.post("/upload")
async def upload(file: UploadFile):
    s = get_settings()
    name = sanitize_filename(file.filename)
    file_id = storage.new_id()
    folder = storage.dir_for(file_id, create=True)
    tmp = folder / "upload.tmp"
    try:
        size = 0
        with open(tmp, "wb") as fh:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > s.max_upload_bytes:
                    raise AppError("file_too_large", 413, max_mb=s.max_upload_mb)
                fh.write(chunk)
        if size == 0:
            raise AppError("empty_file", 422)
        fmt = detect_format(tmp, name)
        src = folder / f"source.{fmt}"
        tmp.rename(src)
        kind, info = kind_of(fmt), {}
        if kind in ("audio", "video"):
            info = probe(src)
            if kind == "video" and not info["has_video"]:
                raise AppError("no_video_stream", 422)
        elif kind == "image":
            Image.MAX_IMAGE_PIXELS = s.max_image_pixels
            try:
                with Image.open(src) as im:
                    info = {"width": im.width, "height": im.height}
            except Image.DecompressionBombError:
                raise AppError("image_too_large", 413)
            except Exception:
                raise AppError("invalid_image", 422)
            if info["width"] * info["height"] > s.max_image_pixels:
                raise AppError("image_too_large", 413)
        elif fmt == "pdf":
            import pymupdf
            try:
                with pymupdf.open(src) as doc:
                    if doc.needs_pass:
                        raise AppError("pdf_encrypted", 422)
                    info = {"pages": len(doc)}
            except AppError:
                raise
            except Exception:
                raise AppError("invalid_document", 422)
        meta = {"id": file_id, "original_name": name, "format": fmt, "kind": kind, "size": size, "info": info,
                "targets": CONVERSIONS[fmt], "previewable": fmt in PREVIEWABLE}
        storage.write_meta(file_id, meta)
        return meta
    except BaseException:
        storage.delete(file_id)
        raise


@router.get("/files/{file_id}/preview")
def preview_source(file_id: str):
    meta = storage.read_meta(valid_id(file_id))
    if meta["format"] not in PREVIEWABLE:
        raise AppError("preview_not_available", 415)
    return _serve(storage.source_path(meta), meta["format"], meta["original_name"], inline=True)


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: str):
    storage.delete(valid_id(file_id))


def _serve(path: Path, fmt: str, filename: str, inline: bool) -> FileResponse:
    headers = dict(_NO_SNIFF)
    if fmt != "pdf":
        headers["Content-Security-Policy"] = "sandbox"
    return FileResponse(path, media_type=MIME[fmt], filename=filename, headers=headers,
                        content_disposition_type="inline" if inline else "attachment")


@router.post("/convert", status_code=202)
def convert(req: ConvertRequest):
    meta = storage.read_meta(valid_id(req.file_id))
    target = normalize(req.target)
    if target not in CONVERSIONS.get(meta["format"], []):
        raise AppError("unsupported_conversion", 400)
    job = get_manager().submit("convert", lambda j: ops.convert(j, meta, target))
    return {"job_id": job.id}


@router.post("/compress", status_code=202)
def compress(req: CompressRequest):
    meta = storage.read_meta(valid_id(req.file_id))
    opts = req.model_dump(exclude={"file_id"})
    opts["output_format"] = _opt_fmt(req.output_format)
    job = get_manager().submit("compress", lambda j: ops.compress(j, meta, opts))
    return {"job_id": job.id}


@router.post("/image/edit", status_code=202)
def image_edit(req: ImageEditRequest):
    meta = storage.read_meta(valid_id(req.file_id))
    opts = req.model_dump(exclude={"file_id"})
    opts["output_format"] = _opt_fmt(req.output_format)
    job = get_manager().submit("image-edit", lambda j: ops.edit_image(j, meta, opts))
    return {"job_id": job.id}


@router.post("/trim", status_code=202)
def trim(req: TrimRequest):
    meta = storage.read_meta(valid_id(req.file_id))
    if req.end <= req.start:
        raise AppError("invalid_range", 422)
    opts = req.model_dump(exclude={"file_id"})
    opts["output_format"] = _opt_fmt(req.output_format)
    job = get_manager().submit("trim", lambda j: ops.trim(j, meta, opts))
    return {"job_id": job.id}


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    return get_manager().get(valid_id(job_id)).public()


def _finished(job_id: str):
    job = get_manager().get(valid_id(job_id))
    if job.state != "done" or job.out_path is None or not job.out_path.is_file():
        raise AppError("result_not_ready", 409)
    return job


@router.get("/jobs/{job_id}/download")
def download(job_id: str):
    job = _finished(job_id)
    return _serve(job.out_path, job.result["format"], job.result["filename"], inline=False)


@router.get("/jobs/{job_id}/preview")
def preview_result(job_id: str):
    job = _finished(job_id)
    if job.result["format"] not in PREVIEWABLE:
        raise AppError("preview_not_available", 415)
    return _serve(job.out_path, job.result["format"], job.result["filename"], inline=True)
