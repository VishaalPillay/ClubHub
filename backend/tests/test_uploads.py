"""Avatar upload tests — POST /users/me/avatar (local storage backend, real Pillow path)."""

import io

import pytest
from PIL import Image

from app.core.config import settings

# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email, name="Uploader"):
    r = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _png_bytes(width=800, height=600, color=(30, 30, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def media_tmp(tmp_path, monkeypatch):
    """Point the local storage backend at a per-test temp dir."""
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    monkeypatch.setattr(settings, "MEDIA_BASE_URL", "http://testserver/media")
    return tmp_path


# ── Happy path ────────────────────────────────────────────────────────────────

def test_upload_stores_resized_webp_and_sets_url(client, media_tmp):
    token = _register(client, "up@load.com")
    r = client.post(
        "/users/me/avatar",
        files={"file": ("me.png", _png_bytes(), "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    url = r.json()["avatar_url"]
    assert url.startswith("http://testserver/media/avatars/")
    assert url.endswith(".webp")

    # The file exists on disk and was normalized to a 512x512 WebP square.
    key = url.removeprefix("http://testserver/media/")
    stored = media_tmp / key
    assert stored.is_file()
    with Image.open(stored) as img:
        assert img.format == "WEBP"
        assert img.size == (512, 512)  # center-cropped from 800x600

    # Profile reflects the new URL.
    me = client.get("/users/me", headers=_auth(token))
    assert me.json()["avatar_url"] == url


def test_reupload_gets_fresh_key_old_file_kept(client, media_tmp):
    token = _register(client, "twice@load.com")
    first = client.post(
        "/users/me/avatar",
        files={"file": ("a.png", _png_bytes(color=(0, 0, 0)), "image/png")},
        headers=_auth(token),
    ).json()["avatar_url"]
    second = client.post(
        "/users/me/avatar",
        files={"file": ("b.png", _png_bytes(color=(255, 255, 255)), "image/png")},
        headers=_auth(token),
    ).json()["avatar_url"]
    assert first != second  # content-unique keys — URLs are never reused
    old = media_tmp / first.removeprefix("http://testserver/media/")
    assert old.is_file()  # stale URLs keep resolving


# ── Rejections ─────────────────────────────────────────────────────────────────

def test_non_image_bytes_rejected(client, media_tmp):
    token = _register(client, "fake@load.com")
    r = client.post(
        "/users/me/avatar",
        files={"file": ("evil.png", b"MZ\x90\x00 not an image", "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_IMAGE"


def test_unsupported_content_type_rejected(client, media_tmp):
    token = _register(client, "gif@load.com")
    r = client.post(
        "/users/me/avatar",
        files={"file": ("a.gif", _png_bytes(), "image/gif")},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert r.json()["code"] == "UNSUPPORTED_MEDIA"


def test_oversized_upload_rejected(client, media_tmp, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    token = _register(client, "big@load.com")
    blob = b"\x00" * (1024 * 1024 + 1)  # one byte over the 1 MB cap
    r = client.post(
        "/users/me/avatar",
        files={"file": ("big.png", blob, "image/png")},
        headers=_auth(token),
    )
    assert r.status_code == 413
    assert r.json()["code"] == "FILE_TOO_LARGE"


def test_upload_requires_authentication(client, media_tmp):
    r = client.post(
        "/users/me/avatar", files={"file": ("a.png", _png_bytes(), "image/png")}
    )
    assert r.status_code == 401
