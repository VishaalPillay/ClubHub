"""Rate limiting — brute-force protection for auth + join-code endpoints (SYSTEM_DESIGN §11.4).

A single in-process limiter (slowapi). This is correct for exactly one API container — which is
a structural property of the deployment, not a coincidence (ADR-0003). Counts are per-process, so
a second worker or a second container silently doubles every configured limit; point slowapi at a
shared store (Redis) before scaling out. Requests are keyed by client IP — read from the
X-Forwarded-For header, because behind a reverse proxy `request.client.host` is the proxy.

Endpoints opt in with `@limiter.limit(...)`; the RateLimitExceeded handler in main.py maps a
breach onto the standard error envelope ({"detail", "code": "RATE_LIMITED"}, HTTP 429). Tests set
`limiter.enabled = False` (see tests/conftest.py) so the suite isn't throttled.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def client_ip(request: Request) -> str:
    """Client IP, taken as the RIGHTMOST X-Forwarded-For hop, else the peer.

    Rightmost, not leftmost: the last entry is the one our own proxy appended and is the only
    hop we can vouch for. Everything to its left is attacker-supplied — a caller sending
    `X-Forwarded-For: 1.2.3.4` could otherwise mint an unlimited number of fresh rate-limit
    buckets and walk straight past the brute-force protection on /auth/login.

    The Caddyfile additionally REPLACES the inbound header (`header_up X-Forwarded-For
    {remote_host}`), so in practice there is exactly one hop and leftmost == rightmost. This
    is defence in depth for the day that stops being true.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if hops:
            return hops[-1]
    return get_remote_address(request)


limiter = Limiter(
    key_func=client_ip,
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=True,  # emit X-RateLimit-* headers so clients can self-throttle
)
