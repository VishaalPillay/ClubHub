# ADR-0002 — Auth token contract

- **Status:** Accepted — **target state implemented** (refresh tokens landed 2026-07-03; see addendum)
- **Date:** 2026-06-18 (addendum 2026-07-03)
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

## Known interim deviations — RESOLVED 2026-07-03 (kept for history)

1. ~~**Token storage — `localStorage` (interim).**~~ Resolved: the access token now lives only in
   memory (`frontend/src/lib/auth/tokenStore.ts`); sessions survive reloads via the refresh cookie
   (`AuthProvider` calls `/auth/refresh` on boot). No `clubhub_token` in `localStorage` anymore.

2. ~~**TTL — 8 hours (interim).**~~ Resolved: `ACCESS_TOKEN_EXPIRE_MINUTES = 15`; the axios client
   silently refreshes on 401 and retries the original request (single-flight).

3. **Login accepts JSON body** (unchanged, intentional). The endpoint uses a Pydantic
   `LoginIn(email, password)` model (not `OAuth2PasswordRequestForm`). The Swagger "Authorize"
   button does not auto-populate from this endpoint; use "Try It Out" in `/docs` to test login
   interactively.

## Addendum (2026-07-03) — refresh-token implementation details

- **Opaque, rotating tokens.** `secrets.token_urlsafe(48)`; only the **SHA-256 hash** is stored
  (`refresh_tokens` table: `user_id`, `token_hash` unique, `expires_at`, `revoked_at`). High-entropy
  random secrets don't need a slow hash — sha256, not bcrypt.
- **Rotation on every `POST /auth/refresh`**: the presented token row is revoked and a replacement
  is issued in the same transaction; the response sets the new cookie + returns a fresh access token.
- **Reuse detection**: presenting an already-revoked token means it leaked (someone else rotated
  it) — **all** of that user's active refresh tokens are revoked and the request fails with 401
  `REFRESH_REUSED`, forcing a re-login everywhere.
- **Cookie**: `clubhub_refresh`, `httpOnly`, `SameSite=Lax`, **`Path=/auth`** (it only rides on
  auth endpoints), `Max-Age` = `REFRESH_TOKEN_EXPIRE_DAYS` (30). `POST /auth/logout` revokes the
  row and clears the cookie (204, idempotent).
- **Error codes**: 401 `NO_REFRESH_TOKEN` (no cookie), `INVALID_REFRESH` (unknown/expired),
  `REFRESH_REUSED` (reuse detected).

### Deployment checklist (before HTTPS production)

- Set **`COOKIE_SECURE=true`** in the environment. It defaults to `false` because local dev and the
  in-container test client run over plain http (Secure cookies are dropped by `http.cookiejar` and
  some browsers on non-localhost http). Any HTTPS deployment MUST set it.
- The frontend origin must appear verbatim in `CORS_ORIGINS` (credentials mode requires exact
  origins; already enforced — never `*`).

### Addendum (2026-08): deployment binding

**The domain layout is part of this contract, not a deployment detail.** `SameSite=Lax` means the
browser sends the cookie on *same-site* requests. `app.<domain>` and `api.<domain>` share the
registrable domain `<domain>`, so a `POST /auth/refresh` from the app is same-site despite being
cross-**origin** — the cookie is sent, and CORS with `allow_credentials=True` handles the rest.

This is why hosting the two halves on unrelated hosts is not an option. On `*.vercel.app` +
`*.onrender.com` both are public suffixes, so the halves are cross-site: the browser would
withhold the cookie on every refresh, `/auth/refresh` would return `NO_REFRESH_TOKEN`, and the
axios interceptor would bounce every user to `/login` **on every page reload**. No `Domain=`
attribute can fix that — you cannot set a cookie on a public suffix.

Concretely, for the current deployment:

- `COOKIE_SECURE=true`, and the cookie stays host-only (no `Domain=`) on `api.<domain>` — tighter
  than sharing it across subdomains, and sufficient because only `/auth/*` needs it.
- `CORS_ORIGINS` is **exactly** `https://app.<domain>`. The marketing landing page at the apex is
  a separate static deployment that makes zero API calls, so it is deliberately *not* an allowed
  origin.
- `samesite="lax"` in `app/modules/auth/router.py` therefore needs **no code change**. If a future
  deployment ever does split the halves across registrable domains, it needs a `COOKIE_SAMESITE`
  setting threaded through both `_set_refresh_cookie` and `delete_cookie`, set to `none` — and it
  should expect Safari's ITP to block the cookie anyway.

### Addendum (2026-08): `refresh_tokens` retention

Rotation inserts a row every ~15 minutes per active session and only ever marks the previous row
revoked, so the table grows without bound. It is now pruned weekly
(`scripts/prune-refresh-tokens.sh`):

```sql
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days';
```

**The window is a security parameter, not a housekeeping one.** `rotate_refresh_token` checks
`revoked_at` **before** `expires_at`. That ordering is what turns a replayed token into
`REFRESH_REUSED` and revokes every session for the user. Delete a revoked row too eagerly and the
same replay degrades to a quiet `INVALID_REFRESH` — the attack still fails, but it is no longer
*detected*, and it no longer burns the attacker's other stolen sessions.

Keeping rows for their full 30-day validity plus 7 days of grace preserves detection across the
entire window in which a stolen token could plausibly be replayed. Shortening it silently weakens
the reuse-detection guarantee above.
