# ADR-0002 — Auth token contract

- **Status:** Accepted (with interim deviations noted below)
- **Date:** 2026-06-18
- **Context:** ClubHub backend re-platform (Foundation + Auth slice). Implements SYSTEM_DESIGN §11.1.

## Target decision (final state)

- The **access token** is a short-lived JWT carrying only the user id (`sub`). It is returned in the
  **JSON body** of `POST /auth/login` (and `POST /auth/register`) and sent back by the client on
  every request as `Authorization: Bearer <token>`. The client holds it **in memory**, never in
  `localStorage`.
- The **refresh token** (deferred to a later step) will be a long-lived, opaque/rotating token
  delivered as an **httpOnly, Secure, SameSite cookie**, exchanged at `POST /auth/refresh` and
  revoked at `POST /auth/logout`.
- Because the refresh cookie is cross-origin (frontend on a different origin than the API), CORS is
  configured **from day one** with **explicit allowed origins** and **`allow_credentials=True`**.
  We never combine `allow_origins=["*"]` with credentials.

## Why

- Decided now so `/auth/login` and the future typed frontend API client are built once, not twice.
- Access-in-memory + refresh-in-httpOnly-cookie removes both the 8-hour-exposure window and the
  `localStorage` XSS risk of the prototype.

## Scope of the current chunk

This chunk ships **access-token-only** (no refresh, no Google OAuth). The contract above does not
change when refresh/OAuth land later.

## Known interim deviations (resolve when refresh tokens land)

1. **Token storage — `localStorage` (interim).** Until `POST /auth/refresh` exists there is no way
   to re-authenticate after a page reload without either storing the token or requiring a fresh login.
   The frontend stores the access token in `localStorage` (`clubhub_token`) as an interim measure.
   Once the httpOnly refresh cookie ships, the access token moves to in-memory and `localStorage` is
   cleared.

2. **TTL — 8 hours (interim).** `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8` is the current setting.
   This is intentionally long while there is no refresh endpoint — a short-lived token with no
   refresh path would log users out mid-session. Drop to 15–60 min once refresh is implemented.

3. **Login accepts JSON body.** The endpoint uses a Pydantic `LoginIn(email, password)` model (not
   `OAuth2PasswordRequestForm`). The Swagger "Authorize" button does not auto-populate from this
   endpoint; use "Try It Out" in `/docs` to test login interactively.
