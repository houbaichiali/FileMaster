import io
import subprocess
import time
import wave
import math
import struct

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def tmp_work(tmp_path_factory):
    return tmp_path_factory.mktemp("work")


@pytest.fixture()
def client(tmp_work, monkeypatch):
    monkeypatch.setenv("FILEMASTER_WORK_DIR", str(tmp_work))
    monkeypatch.setenv("FILEMASTER_MAX_UPLOAD_MB", "20")
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.main import create_app
    with TestClient(create_app()) as c:
        yield c
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def samples(tmp_path_factory):
    d = tmp_path_factory.mktemp("samples")
    from PIL import Image, ImageDraw
    import docx, pymupdf
    # image (gradient + noise-like pattern so JPEG has something to compress)
    img = Image.new("RGB", (640, 480))
    px = img.load()
    for x in range(640):
        for y in range(480):
            px[x, y] = ((x * 255) // 640, (y * 255) // 480, ((x * y) // 300) % 256)
    ImageDraw.Draw(img).rectangle((100, 100, 300, 250), outline=(255, 255, 255), width=5)
    img.save(d / "photo.jpg", quality=95)
    img.save(d / "photo.png")
    rgba = Image.new("RGBA", (200, 100), (255, 0, 0, 128)); rgba.save(d / "alpha.png")
    # wav: 3 s stereo sine
    with wave.open(str(d / "tone.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100)
        frames = b"".join(struct.pack("<hh", int(8000 * math.sin(2 * math.pi * 440 * i / 44100)),
                                      int(8000 * math.sin(2 * math.pi * 660 * i / 44100))) for i in range(44100 * 3))
        w.writeframes(frames)
    # video: 3 s test pattern + sine
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=3",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-shortest", str(d / "clip.mp4")], check=True)
    # video without audio
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=2",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(d / "silent.mp4")], check=True)
    # documents
    (d / "note.txt").write_text("Bonjour le monde\nDeuxième ligne avec accents: é è à\n\nFin.", encoding="utf-8")
    doc = docx.Document()
    doc.add_heading("Titre du document", 1)
    p = doc.add_paragraph("Texte normal avec "); p.add_run("gras").bold = True; p.add_run(" et "); p.add_run("italique").italic = True
    t = doc.add_table(rows=2, cols=2); t.cell(0, 0).text = "A1"; t.cell(0, 1).text = "B1"; t.cell(1, 0).text = "A2"; t.cell(1, 1).text = "B2"
    doc.save(d / "report.docx")
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "Hello PDF world, this is searchable text.", fontsize=14)
    page.insert_image(pymupdf.Rect(72, 120, 520, 450), filename=str(d / "photo.png"))
    pdf.save(d / "doc.pdf")
    # image-only pdf (scanned)
    scan = pymupdf.open(); sp = scan.new_page(); sp.insert_image(pymupdf.Rect(0, 0, 400, 300), filename=str(d / "photo.png")); scan.save(d / "scan.pdf")
    return d


def upload(client, path, name=None, content=None):
    data = content if content is not None else path.read_bytes()
    r = client.post("/api/upload", files={"file": (name or path.name, data, "application/octet-stream")})
    return r


def wait_job(client, job_id, timeout=120):
    end = time.time() + timeout
    while time.time() < end:
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["state"] in ("done", "error"):
            return j
        time.sleep(0.15)
    raise TimeoutError("job did not finish")


def run(client, endpoint, payload):
    r = client.post(f"/api/{endpoint}", json=payload)
    assert r.status_code == 202, r.text
    return wait_job(client, r.json()["job_id"])


def probe_file(data: bytes, suffix: str):
    import json, tempfile, os
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data); name = f.name
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", name],
                             capture_output=True, check=True).stdout
        return json.loads(out)
    finally:
        os.unlink(name)
