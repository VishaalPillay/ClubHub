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
