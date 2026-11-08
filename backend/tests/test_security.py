import pytest
from app.core.errors import AppError
from app.core.security import detect_format, sanitize_filename, valid_id
from .conftest import upload


def test_sanitize_filename_removes_paths_and_control_chars():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\evil.png") == "evil.png"
    assert sanitize_filename("we\x00ird\nname.jpg") == "weirdname.jpg"
    assert sanitize_filename("") == "file"
    assert sanitize_filename("a" * 500 + ".png").endswith(".png") and len(sanitize_filename("a" * 500 + ".png")) < 120
    assert "<" not in sanitize_filename("<script>.png")


@pytest.mark.parametrize("bad", ["../x", "abc", "G" * 32, "0" * 31, "0" * 32 + "/..", ""])
def test_ids_are_validated(bad):
    with pytest.raises(AppError):
        valid_id(bad)


def test_real_format_comes_from_content(tmp_path, samples):
    fake = tmp_path / "x.jpg"
    fake.write_bytes((samples / "photo.png").read_bytes())
    with pytest.raises(AppError) as e:
        detect_format(fake, "x.jpg")
    assert e.value.code == "extension_mismatch"
    exe = tmp_path / "evil.png"
    exe.write_bytes(b"MZ\x90\x00" + b"\x00" * 100)
    with pytest.raises(AppError) as e:
        detect_format(exe, "evil.png")
    assert e.value.code == "unsupported_type"


def test_upload_rejects_unsupported_and_mismatched(client, samples):
    assert upload(client, None, "evil.png", b"MZ\x90\x00" + b"A" * 200).status_code == 415
    assert upload(client, samples / "photo.png", "renamed.jpg").json()["error"]["code"] == "extension_mismatch"
    assert upload(client, None, "empty.txt", b"").json()["error"]["code"] == "empty_file"
    assert upload(client, None, "bin.txt", b"abc\x00def").status_code == 415
    assert upload(client, None, "noext", b"hello").status_code == 415


def test_upload_size_limit(client):
    big = b"%PDF-1.4\n" + b"0" * (21 * 1024 * 1024)
    r = upload(client, None, "big.pdf", big)
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


def test_upload_name_is_sanitised_and_no_path_leak(client, samples):
    r = upload(client, samples / "photo.png", "../../../tmp/photo.png")
    assert r.status_code == 200
    body = r.json()
    assert body["original_name"] == "photo.png"
    assert "/" not in str(body) .replace("image/", "")  # no filesystem paths in response


def test_unknown_ids_and_traversal(client):
    assert client.get("/api/jobs/..%2F..%2Fetc").status_code in (404, 422)
    assert client.get("/api/files/" + "0" * 32 + "/preview").status_code == 404
    assert client.get("/api/jobs/" + "0" * 32).status_code == 404
    assert client.post("/api/convert", json={"file_id": "../../x", "target": "png"}).status_code in (404, 422)


def test_invalid_request_body(client):
    r = client.post("/api/trim", json={"file_id": "0" * 32, "start": -1, "end": 5})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"
    r = client.post("/api/compress", json={"file_id": "0" * 32, "level": "extreme"})
    assert r.status_code == 422


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.json()["ffmpeg"] is True
