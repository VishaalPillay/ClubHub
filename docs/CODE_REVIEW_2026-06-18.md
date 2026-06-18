# ClubHub — Code Review & Status (2026-06-18)

Reviewer lens: Senior PM + technical reviewer. Scope: all uncommitted changes on `main`
(prototype deletion, new `backend/`, frontend changes, docs/ADRs). Verified by compiling the
backend, booting the FastAPI app to read its real route list, and scanning git history.

---

## Verdict

- **Architecture & foundation: strong.** This is a clean, well-reasoned re-platform.
- **Do NOT push as-is until 2 things are handled:** a leaked DB password already in git history,
  and a frontend↔backend login contract mismatch that breaks sign-in.
- **Testable now:** the backend **auth slice** (via Docker). **Not** the full app — ~30 of the
  ~33 endpoints the frontend calls don't exist in the backend yet.

---

## What's happened so far (status)

You're mid-way through your own roadmap's Phase 1–2: re-platforming from the flat MySQL
prototype to a multi-tenant PostgreSQL SaaS. **None of the new work is committed yet** — this is
exactly the pre-push moment.

Git state:
- **Staged:** deletion of the old root files (`auth.py`, `database.py`, `main.py`,
  `routes/*`, `schemas.py`, `requirements.txt`).
- **Unstaged/untracked:** the entire new `backend/`, `docker-compose.yml`, `.env.example`,
  `docs/`, README rewrite, and all frontend changes (portal, join-flow, dashboard, etc.).

**Backend (new):** complete modular skeleton — `core/` (config, db, security, deps, permissions,
exceptions), `models/` (all 11 tables), `modules/auth/` (register/login/me), Alembic baseline
migration, real-Postgres tests, seed script, Dockerfile + compose, 3 ADRs. **Only the auth slice
is wired.** The data layer is built for the *whole* app, but the API exposes only:

```
POST /auth/register   POST /auth/login   GET /auth/me   GET /health
```
(verified from the running app's OpenAPI schema)

**Frontend:** built against the *target* multi-tenant API — portal, onboarding club-creation,
dashboard, tasks, domains, members, announcements, join/action requests. It calls ~30 endpoints.

## How well has the plan unfolded?

Very well on engineering quality; the gap is **sequencing**. The README reads as if the whole
system exists, and the frontend is wired for the full API — but the backend is at the
foundation+auth stage. So the blueprint and the data model are "complete," while the runnable
surface is just auth. That's a fine place to be *if* it's understood; the risk is mistaking the
blueprint for working software.

---

## Critical issues — fix before pushing

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 1 | Security | **DB password `<REDACTED>` is committed in git history** (in `database.py` as `os.getenv("DB_PASSWORD", "<REDACTED>")`, across several commits incl. HEAD — and `main` is already on `origin`). Deleting the file now does **not** remove it from history. | **Rotate that password now** (anywhere it's reused). To purge it from the remote, scrub history with `git filter-repo`/BFG and force-push. The old JWT secret lived only in a local `.env` and was never committed — good. |
| 2 | Correctness | **Login is broken end-to-end.** Backend `/auth/login` expects **form-encoded** `username`+`password` (`OAuth2PasswordRequestForm`); the frontend posts **JSON** `{email, password}`. Every login (incl. the auto-login after register) returns 422. | Either send form data with `username` from the frontend, or add a JSON `LoginIn{email,password}` schema on the backend. Tests pass only because they use form data. |

## High / consistency issues

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 3 | Security | **Token stored in `localStorage`** (`clubhub_token`) — directly contradicts ADR-0002 ("in memory, never localStorage") and re-introduces the XSS exposure that ADR set out to remove. | Move to in-memory access token + httpOnly refresh cookie as designed, **or** update ADR-0002 to record localStorage as the interim decision. Don't leave doc and code disagreeing. |
| 4 | Scope | **App is non-functional past auth.** Portal, onboarding club creation, and the whole dashboard hit endpoints that 404 (`/clubs`, `/clubs/my`, `/clubs/{id}/*`, etc.). | Expected for this slice — just track it so it isn't mistaken for a bug later. |
| 5 | Consistency | **Access-token TTL = 8h** in `config.py`, but ADR-0002 calls it "short-lived" and criticizes the prototype's "8-hour exposure window." Self-contradiction. | Drop to ~15–60 min when refresh lands; note the interim until then. |
| 6 | Contract | `register` returns no token (`MeOut`), but ADR-0002 says the token is returned in the register body too. Frontend works around it with a follow-up login (itself broken — see #2). | Align ADR or endpoint. |
| 7 | Docs | README prominently links `SYSTEM_DESIGN.md` and `DESIGN-wired.md`, but both are **gitignored and never committed** → broken links on GitHub. | Commit them, or remove/soften the links and mark them internal. |
| 8 | Tests | `test_tenancy.py` is a **scaffold** (data-model check only), but the README claims it "asserts a member of club A can never read or write club B's data." Oversells coverage. | Flesh it out to HTTP-level cross-tenant denials when club modules land; soften the README claim until then. |
| 9 | Tests | Test fixture builds schema with `SQLModel.metadata.create_all()`, **not** Alembic — migration/model drift wouldn't be caught, despite "schema is owned by Alembic." | Run `alembic upgrade head` in the fixture, or add a CI check that autogenerate yields no diff. |
| 10 | Ops | `entrypoint.sh` default runs `uvicorn --reload` (dev-only) as the container command. | Fine for local; switch off `--reload` for the AWS/prod image. |
| 11 | Docs | Dockerfile uses `python:3.12-slim` while README/badge says "3.11+". | Cosmetic; align the docs. |

## What looks good

- Clean vertical-slice structure; **one** place for tenancy (`core/deps.py`) and RBAC
  (`core/permissions.py`). Adding a feature touches one folder.
- **Alembic-owned schema**; no destructive `create_all`/drop-on-startup — fixes a real prototype foot-gun.
- `bcrypt<4.1` pin correctly dodges the passlib 1.7.4 breakage. Nice attention to detail.
- Idempotent `points_ledger` with `UNIQUE(task_id, user_id)`; thoughtful composite indexes for the leaderboard.
- ADRs written for the decisions that actually matter (enum storage, token contract, execution model). Mature.
- `.gitignore` correctly excludes `.env`, `venv/`, caches; the local `.env` is untracked.
- Backend compiles cleanly and the app constructs (verified).

---

## Can you test it now?

**Backend auth slice — yes.**
```bash
cp .env.example .env          # set JWT_SECRET_KEY=$(python -c "import secrets;print(secrets.token_hex(32))")
docker compose up --build     # postgres + api, auto-migrates on boot
# Swagger: http://localhost:8000/docs   Health: http://localhost:8000/health
docker compose exec api pytest                 # auth tests + tenancy scaffold
docker compose exec api python -m scripts.seed # demo club TEST-2024, pwd password123
```
Login from Swagger works (it sends form data). Login *from the frontend* will not (issue #2).

**Full app end-to-end — no.** Frontend login is broken, and everything past auth has no backend yet.

---

## Next logical step (recommended order)

1. **Rotate the leaked password** (#1) — it's already public on `origin`.
2. **Fix login** (#2) — smallest change that makes the frontend reach an authenticated state.
3. **Reconcile token storage with ADR-0002** (#3) — pick a side, make doc and code agree.
4. **Build the `clubs` module next** — it unblocks the immediate post-login flows the frontend
   already has: `POST /clubs`, `/clubs/my`, `/clubs/pending`, `/clubs/lookup`, `/clubs/join`
   (portal + onboarding). Then `members` → `join_requests` → `tasks`/`leaderboard`.
5. Add CI (lint + pytest on PR) before the surface grows — the structure is ready for it.

## Pushing to GitHub

Committing this WIP on a branch is reasonable — but **#1 (rotate + ideally scrub history) is a
hard gate**, and I'd either fix #2 or commit it as a documented known-issue so future-you knows
login is intentionally ahead of the backend. Everything else can follow as normal commits.
