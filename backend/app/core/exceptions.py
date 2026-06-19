"""Consistent error envelope: {"detail": "...", "code": "..."} (SYSTEM_DESIGN §8.3)."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Domain error carrying an HTTP status, a message, and a stable machine code."""

    def __init__(self, status_code: int, detail: str, code: str):
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


def _envelope(status_code: int, detail: str, code: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail, "code": code})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return _envelope(exc.status_code, exc.detail, exc.code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Allow a code to be smuggled in via detail dicts; otherwise derive from status.
        detail = exc.detail
        code = "HTTP_ERROR"
        if isinstance(exc.detail, dict):
            detail = exc.detail.get("detail", "")
            code = exc.detail.get("code", code)
        elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "UNAUTHENTICATED"
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            code = "FORBIDDEN"
        elif exc.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"
        return _envelope(exc.status_code, str(detail), code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Pydantic v2: ctx["error"] carries the raw exception object, which is not
        # JSON-serializable. Stringify it before handing off to JSONResponse.
        errors = exc.errors()
        for err in errors:
            ctx = err.get("ctx")
            if ctx and isinstance(ctx.get("error"), Exception):
                ctx["error"] = str(ctx["error"])
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": errors, "code": "VALIDATION_ERROR"},
        )
