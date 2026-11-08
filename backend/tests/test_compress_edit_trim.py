import io

import pymupdf
import pytest
from PIL import Image

from .conftest import upload, run, probe_file


def fid(client, path, name=None):
    r = upload(client, path, name)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def dl(client, job):
    r = client.get(f"/api/jobs/{job['id']}/download")
    assert r.status_code == 200
    return r.content


# ---- compression ------------------------------------------------------------------------------
def test_image_levels_are_monotonic(client, samples):
    f = fid(client, samples / "photo.jpg")
    sizes = []
    for level in ("low", "medium", "high", "maximum"):
        job = run(client, "compress", {"file_id": f, "level": level})
        assert job["state"] == "done", job
        sizes.append(job["result"]["size"])
    assert sizes == sorted(sizes, reverse=True) and sizes[-1] < sizes[0]
    assert job["result"]["saved_percent"] > 50
    assert job["result"]["original_size"] > job["result"]["size"]


def test_image_compress_resize_and_quality(client, samples):
    f = fid(client, samples / "photo.jpg")
    job = run(client, "compress", {"file_id": f, "level": "low", "max_width": 320, "quality": 50})
    img = Image.open(io.BytesIO(dl(client, job)))
    assert img.width == 320 and img.height == 240  # aspect ratio preserved
    assert job["result"]["details"]["quality"] == 50


def test_image_target_size(client, samples):
    f = fid(client, samples / "photo.jpg")
    target_mb = 0.02
    job = run(client, "compress", {"file_id": f, "level": "medium", "target_size_mb": target_mb})
    assert job["state"] == "done"
    assert job["result"]["size"] <= target_mb * 1024 * 1024
    assert job["result"]["details"]["target_reached"] is True


def test_png_compression_and_format_change(client, samples):
    f = fid(client, samples / "photo.png")
    job = run(client, "compress", {"file_id": f, "level": "high"})
    assert job["result"]["size"] < job["result"]["original_size"]
    assert Image.open(io.BytesIO(dl(client, job))).format == "PNG"
    job = run(client, "compress", {"file_id": f, "level": "medium", "output_format": "webp"})
    assert Image.open(io.BytesIO(dl(client, job))).format == "WEBP" and job["result"]["format"] == "webp"


def test_never_returns_larger_than_original(client, samples):
    f = fid(client, samples / "alpha.png")
    job = run(client, "compress", {"file_id": f, "level": "low"})
    assert job["result"]["size"] <= job["result"]["original_size"]


def test_bmp_and_text_compression_not_supported(client, samples, tmp_path):
    bmp = tmp_path / "a.bmp"; Image.new("RGB", (50, 50), "red").save(bmp)
    job = run(client, "compress", {"file_id": fid(client, bmp), "level": "low"})
    assert job["error"]["code"] == "compress_not_supported"
    job = run(client, "compress", {"file_id": fid(client, samples / "note.txt"), "level": "low"})
    assert job["error"]["code"] == "compress_not_supported"


def test_pdf_compression(client, samples):
    f = fid(client, samples / "doc.pdf")
    sizes = {}
    for level in ("low", "high", "maximum"):
        job = run(client, "compress", {"file_id": f, "level": level})
        assert job["state"] == "done", job
        data = dl(client, job)
        assert "Hello PDF world" in pymupdf.open(stream=data, filetype="pdf")[0].get_text()
        sizes[level] = job["result"]["size"]
    assert sizes["maximum"] <= sizes["low"]


def test_pdf_target_size(client, samples):
    f = fid(client, samples / "doc.pdf")
    original = client.get(f"/api/files/{f}/preview").content.__len__()
    job = run(client, "compress", {"file_id": f, "level": "low", "target_size_mb": original / 1024 / 1024 * 0.9})
    assert job["state"] == "done" and "target_reached" in job["result"]["details"]


@pytest.mark.parametrize("level,bitrate", [("low", 192), ("maximum", 64)])
def test_audio_compression_levels(client, samples, level, bitrate):
    f = fid(client, samples / "tone.wav")
    job = run(client, "compress", {"file_id": f, "level": level, "output_format": "mp3"})
    assert job["state"] == "done" and job["result"]["details"]["bitrate_kbps"] == bitrate
    info = probe_file(dl(client, job), ".mp3")
    assert abs(int(info["format"]["bit_rate"]) / 1000 - bitrate) < 15
    assert job["result"]["size"] < job["result"]["original_size"] / 5


def test_wav_resample_and_target_size(client, samples):
    f = fid(client, samples / "tone.wav")
    job = run(client, "compress", {"file_id": f, "level": "maximum"})
    info = probe_file(dl(client, job), ".wav")
    assert info["streams"][0]["sample_rate"] == "22050" and info["streams"][0]["channels"] == 1
    job = run(client, "compress", {"file_id": f, "level": "low", "target_size_mb": 0.05})
    assert job["error"]["code"] == "target_size_needs_lossy"
    job = run(client, "compress", {"file_id": f, "level": "low", "target_size_mb": 0.05, "output_format": "mp3"})
    assert job["result"]["size"] <= 0.05 * 1024 * 1024


def test_video_compression_levels_and_target(client, samples):
    f = fid(client, samples / "clip.mp4")
    job = run(client, "compress", {"file_id": f, "level": "maximum"})
    assert job["state"] == "done", job
    info = probe_file(dl(client, job), ".mp4")
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    assert video["height"] == 360  # never upscales
    job = run(client, "compress", {"file_id": f, "level": "medium", "resolution": 180, "codec": "h265"})
    info = probe_file(dl(client, job), ".mp4")
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    assert video["height"] == 180 and video["codec_name"] == "hevc"
    original = job["result"]["original_size"]
    target = original * 0.5 / 1024 / 1024
    job = run(client, "compress", {"file_id": f, "level": "medium", "target_size_mb": target})
    assert job["state"] == "done" and job["result"]["size"] < original


def test_video_codec_container_mismatch(client, samples):
    f = fid(client, samples / "clip.mp4")
    job = run(client, "compress", {"file_id": f, "level": "low", "codec": "vp9"})
    assert job["error"]["code"] == "codec_incompatible"
    job = run(client, "compress", {"file_id": f, "level": "low", "output_format": "webm"})
    assert job["state"] == "done" and job["result"]["format"] == "webm"


# ---- image editor ------------------------------------------------------------------------------
def edit(client, f, **kw):
    return run(client, "image/edit", {"file_id": f, **kw})


def test_crop_resize_rotate(client, samples):
    f = fid(client, samples / "photo.png")
    job = edit(client, f, crop={"x": 100, "y": 100, "width": 200, "height": 150})
    img = Image.open(io.BytesIO(dl(client, job)))
    assert img.size == (200, 150)
    job = edit(client, f, crop={"x": 0, "y": 0, "width": 640, "height": 480}, resize={"width": 320})
    assert Image.open(io.BytesIO(dl(client, job))).size == (320, 240)
    job = edit(client, f, rotate=90)
    assert Image.open(io.BytesIO(dl(client, job))).size == (480, 640)
    job = edit(client, f, rotate=45, output_format="png")
    w, h = Image.open(io.BytesIO(dl(client, job))).size
    assert abs(w - (640 + 480) * 0.7071) < 3 and abs(h - w) < 3
    assert job["result"]["filename"] == "photo_edited.png"


def test_flip_changes_pixels_and_crop_is_clamped(client, samples):
    f = fid(client, samples / "photo.png")
    orig = Image.open(samples / "photo.png").convert("RGB")
    job = edit(client, f, flip_h=True)
    flipped = Image.open(io.BytesIO(dl(client, job))).convert("RGB")
    assert flipped.getpixel((0, 0)) == orig.getpixel((639, 0))
    job = edit(client, f, crop={"x": 600, "y": 400, "width": 500, "height": 500})
    assert Image.open(io.BytesIO(dl(client, job))).size == (40, 80)


def test_edit_format_change_and_non_image(client, samples):
    f = fid(client, samples / "photo.png")
    job = edit(client, f, output_format="jpeg", quality=70)
    assert Image.open(io.BytesIO(dl(client, job))).format == "JPEG"
    job = edit(client, fid(client, samples / "tone.wav"), rotate=90)
    assert job["state"] == "error"


# ---- trimming ------------------------------------------------------------------------------------
def test_audio_trim_precise(client, samples):
    f = fid(client, samples / "tone.wav")
    job = run(client, "trim", {"file_id": f, "start": 0.5, "end": 2.0})
    assert job["state"] == "done", job
    info = probe_file(dl(client, job), ".wav")
    assert abs(float(info["format"]["duration"]) - 1.5) < 0.05
    job = run(client, "trim", {"file_id": f, "start": 1, "end": 2.5, "output_format": "mp3"})
    info = probe_file(dl(client, job), ".mp3")
    assert abs(float(info["format"]["duration"]) - 1.5) < 0.15


def test_video_trim_precise_and_copy(client, samples):
    f = fid(client, samples / "clip.mp4")
    job = run(client, "trim", {"file_id": f, "start": 1.0, "end": 2.5})
    assert job["state"] == "done", job
    info = probe_file(dl(client, job), ".mp4")
    assert abs(float(info["format"]["duration"]) - 1.5) < 0.15
    assert job["result"]["details"]["mode"] == "precise"
    job = run(client, "trim", {"file_id": f, "start": 0, "end": 2, "precise": False})
    assert job["state"] == "done" and job["result"]["details"]["mode"] == "copy"


def test_trim_validation(client, samples):
    f = fid(client, samples / "clip.mp4")
    assert run(client, "trim", {"file_id": f, "start": 1, "end": 99})["error"]["code"] == "invalid_range"
    r = client.post("/api/trim", json={"file_id": f, "start": 2, "end": 1})
    assert r.status_code == 422
    job = run(client, "trim", {"file_id": fid(client, samples / "photo.png"), "start": 0, "end": 1})
    assert job["error"]["code"] == "trim_not_supported"


# ---- lifecycle -------------------------------------------------------------------------------------
def test_preview_range_requests_and_headers(client, samples):
    f = fid(client, samples / "clip.mp4")
    r = client.get(f"/api/files/{f}/preview", headers={"Range": "bytes=0-99"})
    assert r.status_code == 206 and len(r.content) == 100
    assert r.headers["content-type"] == "video/mp4" and "inline" in r.headers["content-disposition"]
    docx_id = fid(client, samples / "report.docx")
    assert client.get(f"/api/files/{docx_id}/preview").status_code == 415


def test_cleanup_and_delete(client, samples, tmp_work):
    import os, time
    from app.utils import storage
    f = fid(client, samples / "photo.png")
    job = run(client, "convert", {"file_id": f, "target": "jpg"})
    assert client.delete(f"/api/files/{f}").status_code == 204
    assert client.get(f"/api/files/{f}/preview").status_code == 404
    # failed jobs leave nothing behind
    bad = run(client, "trim", {"file_id": fid(client, samples / "clip.mp4"), "start": 1, "end": 99})
    assert not (tmp_work / bad["id"]).exists()
    # expired directories are removed
    old = tmp_work / ("a" * 32); old.mkdir(); (old / "x").write_text("x")
    os.utime(old, (time.time() - 7200, time.time() - 7200))
    assert storage.cleanup_expired(60) >= 1 and not old.exists()
    assert client.get(f"/api/jobs/{job['id']}/download").status_code == 200  # fresh job survives


def test_download_before_ready_and_no_path_leak(client, samples):
    r = client.get("/api/jobs/" + "1" * 32 + "/download")
    assert r.status_code == 404
    f = fid(client, samples / "photo.png")
    job = run(client, "convert", {"file_id": f, "target": "webp"})
    assert "/tmp" not in str(job) and "output." not in str(job["result"].get("filename", "")).replace("photo.webp", "")
