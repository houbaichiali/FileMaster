import io
import pytest
from PIL import Image
import pymupdf, docx

from .conftest import upload, run, probe_file


def convert(client, path, target, name=None):
    up = upload(client, path, name)
    assert up.status_code == 200, up.text
    job = run(client, "convert", {"file_id": up.json()["id"], "target": target})
    return up.json(), job


def fetch(client, job):
    r = client.get(f"/api/jobs/{job['id']}/download")
    assert r.status_code == 200
    return r


@pytest.mark.parametrize("src,target,pil", [("photo.jpg", "png", "PNG"), ("photo.png", "jpg", "JPEG"), ("photo.png", "webp", "WEBP"),
                                              ("photo.jpg", "bmp", "BMP"), ("photo.png", "tiff", "TIFF"), ("alpha.png", "jpg", "JPEG")])
def test_image_conversions(client, samples, src, target, pil):
    _, job = convert(client, samples / src, target)
    assert job["state"] == "done", job
    r = fetch(client, job)
    img = Image.open(io.BytesIO(r.content))
    assert img.format == pil
    assert job["result"]["filename"].endswith("." + target)
    assert "attachment" in r.headers["content-disposition"]


def test_alpha_is_flattened_on_white_for_jpeg(client, samples):
    _, job = convert(client, samples / "alpha.png", "jpg")
    img = Image.open(io.BytesIO(fetch(client, job).content)).convert("RGB")
    r, g, b = img.getpixel((10, 10))
    assert r > 240 and 100 < g < 160  # red at 50% over white


def test_txt_docx_pdf_roundtrip(client, samples):
    _, job = convert(client, samples / "note.txt", "docx")
    assert job["state"] == "done"
    d = docx.Document(io.BytesIO(fetch(client, job).content))
    assert "Bonjour le monde" in [p.text for p in d.paragraphs]
    _, job = convert(client, samples / "note.txt", "pdf")
    pdf = pymupdf.open(stream=fetch(client, job).content, filetype="pdf")
    assert "Bonjour le monde" in pdf[0].get_text() and "é è à" in pdf[0].get_text()


def test_docx_to_txt_and_pdf(client, samples):
    _, job = convert(client, samples / "report.docx", "txt")
    text = fetch(client, job).text
    assert "Titre du document" in text and "gras et italique" in text and "A1\tB1" in text
    _, job = convert(client, samples / "report.docx", "pdf")
    assert job["state"] == "done"
    pdf = pymupdf.open(stream=fetch(client, job).content, filetype="pdf")
    page_text = pdf[0].get_text()
    assert "Titre du document" in page_text and "A2" in page_text and "gras" in page_text


def test_pdf_to_txt_and_docx(client, samples):
    _, job = convert(client, samples / "doc.pdf", "txt")
    assert "Hello PDF world" in fetch(client, job).text
    _, job = convert(client, samples / "doc.pdf", "docx")
    d = docx.Document(io.BytesIO(fetch(client, job).content))
    assert any("Hello PDF world" in p.text for p in d.paragraphs)


def test_scanned_pdf_has_no_text(client, samples):
    _, job = convert(client, samples / "scan.pdf", "txt")
    assert job["state"] == "error" and job["error"]["code"] == "no_text_in_pdf"


@pytest.mark.parametrize("target,codec", [("mp3", "mp3"), ("flac", "flac"), ("ogg", "vorbis"), ("aac", "aac"), ("m4a", "aac")])
def test_audio_conversions(client, samples, target, codec):
    _, job = convert(client, samples / "tone.wav", target)
    assert job["state"] == "done", job
    info = probe_file(fetch(client, job).content, "." + target)
    assert info["streams"][0]["codec_name"] == codec
    assert abs(float(info["format"]["duration"]) - 3.0) < 0.3


def test_video_conversions(client, samples):
    for target, vcodec in [("webm", "vp9"), ("mkv", "h264"), ("mov", "h264")]:
        _, job = convert(client, samples / "clip.mp4", target)
        assert job["state"] == "done", (target, job)
        info = probe_file(fetch(client, job).content, "." + target)
        assert any(s["codec_name"] == vcodec for s in info["streams"] if s["codec_type"] == "video")
        assert any(s["codec_type"] == "audio" for s in info["streams"])


def test_video_to_audio_extraction(client, samples):
    _, job = convert(client, samples / "clip.mp4", "mp3")
    info = probe_file(fetch(client, job).content, ".mp3")
    assert [s["codec_type"] for s in info["streams"]] == ["audio"]
    _, job = convert(client, samples / "silent.mp4", "mp3")
    assert job["error"]["code"] == "no_audio_stream"


def test_unsupported_conversion_rejected(client, samples):
    up = upload(client, samples / "photo.png").json()
    r = client.post("/api/convert", json={"file_id": up["id"], "target": "mp3"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "unsupported_conversion"
    up = upload(client, samples / "doc.pdf").json()
    assert client.post("/api/convert", json={"file_id": up["id"], "target": "pdf"}).status_code == 400


def test_corrupt_media_is_reported(client):
    bad = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 32 + b"garbage" * 50
    r = upload(client, None, "broken.mp4", bad)
    assert r.status_code == 422 and r.json()["error"]["code"] in ("invalid_media", "probe_failed")


def test_formats_endpoint_lists_only_implemented(client):
    f = client.get("/api/formats").json()
    assert "docx" not in f["conversions"]["docx"] and "pdf" in f["conversions"]["docx"]
    assert set(f["conversions"]["pdf"]) == {"txt", "docx"}
