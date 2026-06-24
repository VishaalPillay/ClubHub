"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.modules.action_requests.router import router as action_requests_router
from app.modules.auth.router import router as auth_router
from app.modules.clubs.router import router as clubs_router
from app.modules.domains.router import router as domains_router
from app.modules.join_requests.router import router as join_requests_router
from app.modules.members.router import router as members_router


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

    @app.get("/health", tags=["Health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
