"""FastAPI application factory."""

import mimetypes
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.modules.action_requests.router import router as action_requests_router
from app.modules.announcements.router import router as announcements_router
from app.modules.auth.router import router as auth_router
from app.modules.clubs.router import router as clubs_router
from app.modules.domains.router import router as domains_router
from app.modules.events.router import router as events_router
from app.modules.join_requests.router import router as join_requests_router
from app.modules.leaderboard.router import router as leaderboard_router
from app.modules.members.router import router as members_router
from app.modules.tasks.router import router as tasks_router
from app.modules.users.router import router as users_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="ClubHub API",
        description="Multi-tenant SaaS for running student clubs.",
        version="0.1.0",
    )

    # Explicit origins + credentials (refresh cookie lands later) — never "*" with credentials.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(auth_router)
    app.include_router(clubs_router)
    app.include_router(domains_router)
    app.include_router(members_router)
    app.include_router(join_requests_router)
    app.include_router(action_requests_router)
    app.include_router(tasks_router)
    app.include_router(leaderboard_router)
    app.include_router(announcements_router)
    app.include_router(events_router)
    app.include_router(users_router)

    # Local media (avatar uploads) — dev convenience only; the s3 backend serves
    # straight from the bucket/CDN and never hits this mount. See core/storage.py.
    if settings.STORAGE_BACKEND == "local":
        # Python 3.12's mimetypes doesn't know .webp — avatars would serve as octet-stream.
        mimetypes.add_type("image/webp", ".webp")
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)
        app.mount("/media", StaticFiles(directory=media_root), name="media")

    @app.get("/health", tags=["Health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
