"""Rate limiting — brute-force protection for auth + join-code endpoints (SYSTEM_DESIGN §11.4).

A single in-process limiter (slowapi). This is correct for one Fargate task; if you scale to
multiple tasks, point slowapi at a shared store (Redis) so counts are global. Requests are keyed
by client IP — read from the X-Forwarded-For header first, because in production the app sits
behind an ALB and `request.client.host` would otherwise be the load balancer, not the caller.

Endpoints opt in with `@limiter.limit(...)`; the RateLimitExceeded handler in main.py maps a
breach onto the standard error envelope ({"detail", "code": "RATE_LIMITED"}, HTTP 429). Tests set
`limiter.enabled = False` (see tests/conftest.py) so the suite isn't throttled.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def client_ip(request: Request) -> str:
    """Best-effort client IP: the first X-Forwarded-For hop (set by the ALB), else the peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=client_ip,
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=True,  # emit X-RateLimit-* headers so clients can self-throttle
)
