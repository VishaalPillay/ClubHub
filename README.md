<div align="center">

# ClubHub

**A multi-tenant SaaS for running student clubs — memberships, roles, sub-teams, tasks, gamified leaderboards, and announcements.**

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-05998b?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![SQLModel](https://img.shields.io/badge/SQLModel-+Alembic-7E56C2)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

</div>

---

## Table of contents

- [What is ClubHub?](#what-is-clubhub)
- [Architecture at a glance](#architecture-at-a-glance)
- [Multi-tenancy & request flow](#multi-tenancy--request-flow)
- [Data model](#data-model)
- [Repository layout](#repository-layout)
- [Backend structure (modular by domain)](#backend-structure-modular-by-domain)
- [Frontend structure (feature-based)](#frontend-structure-feature-based)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Conventions & guardrails](#conventions--guardrails)
- [Adding a new feature module](#adding-a-new-feature-module)
- [Roles & permissions](#roles--permissions)
- [API surface](#api-surface)
- [Migration from the prototype](#migration-from-the-prototype)
- [Roadmap](#roadmap)

---

## What is ClubHub?

ClubHub lets any student spin up a club in minutes, invite people with a shareable code, organize them into sub-teams (**domains**), assign and track work, and keep everyone engaged with a points leaderboard.

The model is multi-tenant: **one account, many clubs.** Identity is global; everything else is scoped to the club you're acting in. A public club directory lets students discover and request to join clubs across institutions.

> This README is the **development blueprint** for the rebuild. The full reasoning — tenancy strategy, gamification, security, AWS deployment, trade-offs, and the phased roadmap — lives in `SYSTEM_DESIGN.md` (internal, not committed). The frontend visual language is defined in `DESIGN-wired.md` (internal, not committed).

---

## Architecture at a glance

```mermaid
flowchart TD
    U["User browser"] -->|HTTPS| CF["CloudFront + S3<br/>Next.js frontend"]
    CF -->|/api/*| API["FastAPI app<br/>(ECS Fargate / App Runner)"]
    API --> PG[("PostgreSQL<br/>RDS / Aurora Serverless")]
    API --> OBJ[("S3<br/>uploads & avatars")]
    API --> MAIL["Amazon SES<br/>transactional email"]
    API -. "later (when needed)" .-> RD[("Redis<br/>cache + job queue")]
    RD -. .-> WK["Worker<br/>async jobs"]

    classDef ext fill:#E6F1FB,stroke:#185FA5,color:#042C53;
    classDef store fill:#E1F5EE,stroke:#0F6E56,color:#04342C;
    class CF,API,MAIL,WK ext;
    class PG,OBJ,RD store;
```

A single FastAPI service (stateless, JWT-based) talks to one PostgreSQL database using row-level `club_id` tenancy. Redis, a worker, and SES are wired in only when real load or features demand them — see `SYSTEM_DESIGN.md` §9–10.

---

## Multi-tenancy & request flow

Identity and tenancy are deliberately separated:

- The **JWT carries only the user id** — *who you are*, globally, across every club.
- The **active club is sent per request** via an `X-Club-ID` header.
- A dependency resolves *what you can do* by looking up your membership for that club.

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as FastAPI (deps)
    participant DB as PostgreSQL

    B->>API: POST /clubs/42/tasks  (Bearer JWT + X-Club-ID: 42)
    API->>API: get_current_user  (decode JWT -> user 7)
    API->>DB: SELECT role, domain_id FROM club_members WHERE user=7 AND club=42
    DB-->>API: role = lead, domain_id = 3
    API->>API: require_min_role("lead") + domain check  (pass)
    API->>DB: INSERT task (club_id = 42 from context, never from body)
    DB-->>API: task row
    API-->>B: 201 Created
```

**The golden rule:** `club_id` for any write comes from the verified context, never from the request body. A client cannot write into a club it doesn't belong to, even by lying in the payload.

---

## Data model

```mermaid
erDiagram
    USERS ||--o{ CLUB_MEMBERS : "joins"
    CLUBS ||--o{ CLUB_MEMBERS : "has"
    CLUBS ||--o{ DOMAINS : "contains"
    DOMAINS ||--o{ CLUB_MEMBERS : "groups"
    CLUBS ||--o{ TASKS : "owns"
    DOMAINS ||--o{ TASKS : "scopes"
    TASKS ||--o{ TASK_ASSIGNMENTS : "has"
    USERS ||--o{ TASK_ASSIGNMENTS : "assigned"
    CLUBS ||--o{ JOIN_REQUESTS : "receives"
    CLUBS ||--o{ ACTION_REQUESTS : "tracks"
    CLUBS ||--o{ ANNOUNCEMENTS : "publishes"
    TASKS ||--o{ POINTS_LEDGER : "credits"
    USERS ||--o{ POINTS_LEDGER : "earns"

    USERS {
        int id PK
        string email UK
        string password_hash "nullable (Google-only)"
        string google_sub "nullable"
        string institution
        string github_url
    }
    CLUBS {
        int id PK
        string code UK "shareable join code"
        int owner_id FK
        jsonb enabled_roles
        bool is_public
    }
    CLUB_MEMBERS {
        int id PK
        int user_id FK
        int club_id FK
        enum role
        int domain_id FK "nullable"
        int points "cached total"
    }
    TASKS {
        int id PK
        int club_id FK
        int domain_id FK
        enum status
        int points "weightage"
    }
    POINTS_LEDGER {
        int id PK
        int task_id FK
        int user_id FK
        int delta
    }
```

`club_members` is both the membership join table and the RBAC source of truth — your role, domain, and points live here, per club. The `points_ledger` (new) makes leaderboard awards auditable and idempotent. Full schema and indexing notes: `SYSTEM_DESIGN.md` §5.

---

## Repository layout

A monorepo with a clear backend / frontend split and shared docs at the root.

```
ClubHub/
├── README.md                  # this file
├── SYSTEM_DESIGN.md           # architecture, roadmap, trade-offs
├── DESIGN-wired.md            # frontend design system (Wired editorial)
├── docker-compose.yml         # local dev: postgres + api (+ adminer)
├── .env.example               # committed template — copy to .env
├── .gitignore
│
├── backend/                   # FastAPI service  (see below)
├── frontend/                  # Next.js app      (see below)
└── docs/
    └── adr/                   # architecture decision records
```

---

## Backend structure (modular by domain)

Each feature is a **vertical slice** — its own router, request/response schemas, and service (business logic). Cross-cutting concerns live in `core/`. SQLModel **table** definitions are centralized in `models/` to avoid circular imports between modules that share foreign keys.

```mermaid
flowchart LR
    main["app/main.py<br/>(app factory, mounts routers)"]
    subgraph mod["app/modules (features)"]
        direction TB
        m1["auth"]
        m2["clubs"]
        m3["members"]
        m4["tasks"]
        m5["leaderboard"]
        m6["...announcements, domains,<br/>join_requests, action_requests"]
    end
    subgraph core["app/core (shared infra)"]
        direction TB
        c1["config"]
        c2["db / session"]
        c3["security (JWT, hashing)"]
        c4["deps (get_club_context,<br/>require_min_role)"]
    end
    md["app/models<br/>(SQLModel tables)"]
    main --> mod
    mod --> core
    mod --> md
    core --> md
```

```
backend/
├── pyproject.toml             # deps & tooling (ruff, pytest)  [or requirements.txt]
├── Dockerfile
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/              # generated migrations (the source of truth for schema)
├── app/
│   ├── main.py                # create_app(): FastAPI instance, CORS, router mounting
│   ├── core/
│   │   ├── config.py          # pydantic-settings (DATABASE_URL, JWT_SECRET_KEY, ...)
│   │   ├── db.py              # engine + Session + get_session() dependency
│   │   ├── security.py        # hash/verify password, create/decode JWT
│   │   ├── deps.py            # get_current_user, get_club_context, require_min_role
│   │   ├── permissions.py     # ROLE_HIERARCHY + rank helpers
│   │   └── exceptions.py      # custom exceptions + handlers
│   ├── models/                # SQLModel tables (one file per aggregate)
│   │   ├── user.py
│   │   ├── club.py            # club, club_member, domain
│   │   ├── task.py            # task, task_assignment, points_ledger
│   │   ├── request.py         # join_request, action_request
│   │   └── content.py         # announcement, event
│   ├── modules/
│   │   ├── auth/              # register, login, refresh, Google OAuth
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── users/             # global profile (/me, profile fields)
│   │   ├── clubs/             # create/list/lookup, public directory
│   │   ├── join_requests/     # request -> approve flow
│   │   ├── members/           # roster, role changes, kick
│   │   ├── action_requests/   # Lead-raised promote/kick approvals
│   │   ├── domains/           # sub-team CRUD
│   │   ├── tasks/             # task CRUD, assignment, points award
│   │   ├── leaderboard/       # per-club / per-domain rankings
│   │   └── announcements/     # club & domain announcements
│   └── shared/                # tiny shared utilities (pagination, types)
├── scripts/
│   └── seed.py                # demo data (rewritten for SQLModel)
└── tests/
    ├── conftest.py            # test client + ephemeral DB fixtures
    ├── test_auth.py
    ├── test_tenancy.py        # proves cross-club isolation
    └── test_tasks.py
```

Why this shape: adding a feature touches **one folder**, the tenant guard and auth live in exactly **one place** (`core/deps.py`), and the schema is owned by Alembic — never by a destructive "drop & recreate" startup hook.

---

## Frontend structure (feature-based)

Routes stay thin (App Router), real logic lives in `features/`, and a typed API client plus a design-token layer (from `DESIGN-wired.md`) keep the UI consistent and on-brand.

```
frontend/
├── package.json
├── next.config.ts
├── tailwind.config.ts         # extends theme from src/styles/design-tokens
├── .env.local.example         # NEXT_PUBLIC_API_URL=...
└── src/
    ├── app/                   # routing only — thin pages
    │   ├── (public)/          # landing, /directory, /join/[code], /login, /register
    │   ├── (app)/             # authenticated shell (nav + club switcher)
    │   │   └── c/[clubId]/     # club-scoped: dashboard, tasks, members,
    │   │                       #   leaderboard, announcements, settings
    │   └── layout.tsx
    ├── features/              # one folder per domain: components + hooks
    │   ├── auth/
    │   ├── clubs/             # club switcher, directory, create/join
    │   ├── tasks/
    │   ├── members/
    │   ├── announcements/
    │   └── leaderboard/
    ├── components/ui/         # Wired primitives: Button, Input, StoryRow,
    │                          #   MastheadBand, HairlineRule, Kicker
    ├── lib/
    │   ├── api/               # typed axios client + per-resource endpoints
    │   │   ├── client.ts      # base axios, auth header, X-Club-ID injection
    │   │   ├── auth.ts
    │   │   ├── clubs.ts
    │   │   └── tasks.ts
    │   ├── auth/              # token store (in-memory), club context provider
    │   └── queryClient.ts     # TanStack Query setup
    ├── styles/
    │   ├── globals.css
    │   └── design-tokens.ts   # colors, type scale, spacing from DESIGN-wired.md
    └── types/                 # shared TS types mirroring API schemas
```

The **club switcher** sets the active `clubId` (URL segment `c/[clubId]`), and `lib/api/client.ts` automatically attaches both the `Authorization` and `X-Club-ID` headers to every request.

---

## Tech stack

| Layer | Technology |
|---|---|
| API | FastAPI, Uvicorn, Pydantic v2 |
| ORM / DB | **PostgreSQL 16**, SQLModel (SQLAlchemy + Pydantic), `psycopg` 3, **Alembic** migrations |
| Auth | JWT access + refresh (`python-jose`), `passlib[bcrypt]`, Google OAuth (Authlib) |
| Config | `pydantic-settings` (env-driven, no secrets in code) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Data fetching | TanStack Query + a typed Axios client |
| UI | Framer Motion, Phosphor Icons, the Wired design system |
| Local dev | Docker Compose (Postgres + API) |
| CI | GitHub Actions (lint + test on PR) |

---

## Getting started

### Prerequisites

- Docker + Docker Compose (simplest path), **or** Python 3.12 and PostgreSQL 16 locally
- Node.js 18+ for the frontend

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env          # fill in JWT_SECRET_KEY (see below)
docker compose up --build     # starts postgres + api, runs migrations
```

API at `http://localhost:8000` · Swagger at `http://localhost:8000/docs`.

### Option B — run the backend directly

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .              # or: pip install -r requirements.txt
cp ../.env.example .env
alembic upgrade head          # create/update schema (no destructive drops)
uvicorn app.main:app --reload
```

Generate a JWT secret:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

`.env` (template in `.env.example`):

```env
DATABASE_URL=postgresql+psycopg://clubhub:clubhub@localhost:5432/clubhub
JWT_SECRET_KEY=your_generated_hex_key
GOOGLE_CLIENT_ID=            # optional until OAuth is wired
GOOGLE_CLIENT_SECRET=
CORS_ORIGINS=http://localhost:3000
```

### Seed demo data

```bash
cd backend && python -m scripts.seed
```

Creates a demo club (code **`TEST-2024`**) with executives and three domains. All seeded accounts use the password `password123` (e.g. `aarav@clubhub.com` = President).

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                          # http://localhost:3000
```

---

## Conventions & guardrails

- **Tenant safety:** never read `club_id` from a request body for a write — always from `get_club_context`. List/read queries are scoped through a shared helper so the filter can't be forgotten.
- **Thin routers, fat services:** routers validate + delegate; business logic lives in each module's `service.py`. Easier to test, no logic duplicated across endpoints.
- **Schema = migrations:** the database is changed only through Alembic revisions. No `create_all` / drop-and-rebuild in app startup.
- **No secrets in code:** everything sensitive comes from `core/config.py` (env). `.env` is git-ignored; `.env.example` documents the keys.
- **Permissions in one place:** role ranks and `require_min_role` live in `core/`. Endpoints declare the minimum role they need; they don't reimplement checks.
- **Tested isolation:** `tests/test_tenancy.py` scaffolds cross-club isolation — currently proves the data-model invariant (no ClubMember row leaks between clubs); HTTP-level cross-tenant denial assertions are added as each module is ported.

---

## Adding a new feature module

The structure makes this a recipe (example: "files"):

1. Add the table(s) in `app/models/` and run `alembic revision --autogenerate -m "add files"` → `alembic upgrade head`.
2. Create `app/modules/files/` with `router.py`, `schemas.py`, `service.py`.
3. Scope every query to `ctx.club_id`; declare the minimum role via `require_min_role(...)`.
4. Mount the router in `app/main.py`.
5. Add `tests/test_files.py`, including a cross-tenant denial case.
6. Frontend: add `features/files/` + `lib/api/files.ts`; drop the UI into `app/(app)/c/[clubId]/files`.

---

## Roles & permissions

Ordered low → high authority:

```
member  <  associate  <  lead  <  joint_secretary  <  secretary  <  vice_president  <  president
```

| Capability | Min role |
|---|---|
| View members, own-domain tasks, announcements; update own task status | Member |
| Assign tasks within own domain | Associate |
| Create tasks / post domain announcements / raise promote–kick requests (own domain) | Lead |
| Approve join & action requests; promote up to Lead; create events | Joint-Secretary / Secretary |
| Create/edit domains; edit club; post global announcements | Vice-President |
| Full control (auto-assigned to the club creator) | President |

A President picks which roles a club uses via `enabled_roles`. Actions a Lead can't perform directly (promotions, kicks) flow through the **action-request** approval queue.

---

## API surface

All club-scoped endpoints require two headers: `Authorization: Bearer <token>` and `X-Club-ID: <id>`. Auth, club creation, `/clubs/my`, `/clubs/directory`, `/clubs/lookup`, and `/clubs/join` need only the bearer token.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/google/login` · `GET /auth/google/callback` · `GET /auth/me` |
| Profile | `GET /me` · `PUT /me` |
| Clubs | `POST /clubs` · `GET /clubs/my` · `GET /clubs/directory` · `GET /clubs/lookup?code=` · `GET /clubs/{id}` · `PUT /clubs/{id}` |
| Joining | `POST /clubs/join` · `GET /clubs/pending` · `DELETE /clubs/join/{rid}` · `GET /clubs/{id}/requests` · `PUT /clubs/{id}/requests/{rid}/approve` `/reject` |
| Members | `GET /clubs/{id}/members` · `PUT /clubs/{id}/members/{uid}/role` · `DELETE /clubs/{id}/members/{uid}` |
| Governance | `POST /clubs/{id}/action-requests` · `GET ...` · `PUT .../{rid}/approve` `/reject` |
| Domains | `GET/POST /clubs/{id}/domains` · `PUT/DELETE /clubs/{id}/domains/{did}` |
| Tasks | `GET/POST /clubs/{id}/tasks` · `PUT/DELETE /clubs/{id}/tasks/{tid}` · `POST /clubs/{id}/tasks/{tid}/assign` |
| Leaderboard | `GET /clubs/{id}/leaderboard?domain_id=` |
| Announcements | `GET/POST /clubs/{id}/announcements` · `PUT/DELETE /clubs/{id}/announcements/{aid}` |

Full request/response schemas are auto-documented at `/docs`.

---

## Migration from the prototype

The flat prototype is being reshaped into the structure above. Mapping:

| Prototype (delete / replace) | New home |
|---|---|
| `database.py` (raw MySQL pool + drop-and-create) | `backend/app/core/db.py` (engine/session) + `alembic/` (schema) |
| `schemas.py` (one big file) | `backend/app/modules/*/schemas.py` (per feature) + `app/models/` (tables) |
| `auth.py` | `backend/app/core/security.py` + `backend/app/core/deps.py` |
| `routes/*.py` | `backend/app/modules/*/router.py` (+ `service.py`) |
| `routes/users.py` (dead, broken) | **deleted** — replaced by `modules/auth` + `modules/users` |
| `seed.py` (MySQL, truncates) | `backend/scripts/seed.py` (SQLModel) |
| `main.py` | `backend/app/main.py` (app factory) |

Nothing is lost — every behavior moves to a clearer home, and the MySQL-specific SQL is translated to PostgreSQL (cheatsheet in `SYSTEM_DESIGN.md` §5.1).

---

## Roadmap

From prototype to deployed SaaS (full detail in [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) §15):

1. **Scaffold & re-platform** — stand up this structure; PostgreSQL + SQLModel + Alembic; port modules with centralized tenant scoping.
2. **Finish MVP** — points awarding + `points_ledger` + leaderboard endpoint; public directory; profile fields; Google OAuth + refresh tokens.
3. **Frontend** — implement the Wired design system + club switcher; wire mocked pages to the real API.
4. **Ship on AWS** — containerize, CI/CD, deploy on the free-tier path (RDS/Aurora PostgreSQL, S3 + CloudFront).
5. **Harden & monetize** — rate limiting, backups, observability; billing when there's demand.

---

<div align="center">
<sub>Built by Vis · Architecture in SYSTEM_DESIGN.md · Design system in DESIGN-wired.md</sub>
</div>
