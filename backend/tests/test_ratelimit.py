"""Rate limiting fires on the auth endpoints (SYSTEM_DESIGN §11.4).

The suite disables the limiter (see conftest's autouse `_disable_rate_limit`), because every
test shares one client IP and would otherwise trip the limits. Here we re-enable it to prove a
burst of requests from a single client is throttled with the standard error envelope.
"""

import pytest

from app.core.config import settings
from app.core.ratelimit import limiter


@pytest.fixture()
def rate_limited():
    # Start from a clean counter, enable, and always restore disabled+clean afterwards.
    if hasattr(limiter, "reset"):
        limiter.reset()
    limiter.enabled = True
    yield
    limiter.enabled = False
    if hasattr(limiter, "reset"):
        limiter.reset()


def test_login_is_rate_limited(client, rate_limited):
    limit = int(settings.RATE_LIMIT_AUTH.split("/")[0])  # e.g. "10/minute" -> 10
    bad = {"email": "nobody@example.com", "password": "wrong-pass"}

    statuses = [client.post("/auth/login", json=bad).status_code for _ in range(limit + 2)]

    # Early requests reach the handler (bad creds -> not 429); once over the limit, we get 429.
    assert statuses[0] != 429, statuses
    assert 429 in statuses, statuses

    # A throttled response uses our error envelope with the stable machine code.
    throttled = client.post("/auth/login", json=bad)
    assert throttled.status_code == 429
    assert throttled.json()["code"] == "RATE_LIMITED"


def test_prepended_forwarded_for_hop_does_not_reset_the_bucket(client, rate_limited):
    """Prepending a forged X-Forwarded-For hop must not mint a fresh rate-limit bucket.

    This models the production header shape: a proxy appends the peer address it actually saw,
    so the RIGHTMOST hop is the trustworthy one and everything left of it is caller-supplied.
    Keying on the leftmost hop (the old behaviour) would let an attacker walk straight past the
    brute-force limit on /auth/login by rotating a fake value on each request.

    Note what this does NOT claim: if no trusted proxy appends a hop at all, the whole header is
    attacker-controlled and no key function can help. That case is closed by the Caddyfile, which
    REPLACES the header (`header_up X-Forwarded-For {remote_host}`) rather than appending to it.
    """
    limit = int(settings.RATE_LIMIT_AUTH.split("/")[0])
    bad = {"email": "nobody@example.com", "password": "wrong-pass"}
    peer = "203.0.113.9"  # what the proxy appends for this caller

    # Burn the caller's budget.
    for _ in range(limit + 2):
        client.post("/auth/login", json=bad, headers={"X-Forwarded-For": peer})

    # Same caller, now prepending a forged hop to look like someone else.
    spoofed = client.post(
        "/auth/login", json=bad, headers={"X-Forwarded-For": f"1.2.3.4, {peer}"}
    )
    assert spoofed.status_code == 429, "forged leading hop reset the rate-limit bucket"
    assert spoofed.json()["code"] == "RATE_LIMITED"
