from fastapi.testclient import TestClient


def test_static_serving_spa_fallback_and_no_traversal(tmp_path, monkeypatch):
    site = tmp_path / "site"; (site / "assets").mkdir(parents=True)
    (site / "index.html").write_text("<html>INDEX</html>")
    (site / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("TOP-SECRET")
    monkeypatch.setenv("FILEMASTER_STATIC_DIR", str(site))
    monkeypatch.setenv("FILEMASTER_WORK_DIR", str(tmp_path / "work"))
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.main import create_app
    with TestClient(create_app()) as c:
        assert "INDEX" in c.get("/").text
        assert "INDEX" in c.get("/convert").text            # client-side route -> index.html
        assert c.get("/assets/app.js").text == "console.log(1)"
        for evil in ("/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt", "/..%2fsecret.txt"):
            assert "TOP-SECRET" not in c.get(evil).text
        assert c.get("/api/health").json()["status"] == "ok"  # API routes still win
    get_settings.cache_clear()
