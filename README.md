<div align="center">

# ClubHub

**A multi-tenant platform for running student clubs — memberships, roles, sub-teams, tasks, gamified leaderboards, and announcements.**

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-05998b?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

</div>

---

## What is ClubHub?

ClubHub lets any student spin up a club in minutes, invite people with a shareable code, organize them into sub-teams (**domains**), assign and track work, and keep everyone engaged with a points leaderboard.

The model is multi-tenant: **one person has one account and can belong to many clubs at once**, each with a different role. Identity is global; everything else is scoped to the club you're acting in.

> **Project status — data layer migrating MySQL → PostgreSQL.**
> The original prototype was built on MySQL. **PostgreSQL is the chosen database going forward** (see the rationale in [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) §5.1), and porting the data layer to PostgreSQL + SQLModel/SQLAlchemy + Alembic is the **current top priority (Phase 1)**. The setup below targets the PostgreSQL stack. Until the migration lands, the committed backend still imports MySQL drivers — track progress in `SYSTEM_DESIGN.md` §15.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How multi-tenancy works](#how-multi-tenancy-works)
- [Roles & permissions](#roles--permissions)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [API reference](#api-reference)
- [Seeded test data](#seeded-test-data)
- [Known issues & first fixes](#known-issues--first-fixes)
- [Roadmap](#roadmap)

---

## Features

- **Accounts & auth** — register, log in, JWT-secured sessions (bcrypt-hashed passwords).
- **Clubs** — create a club (you become President), get a shareable join code, pick which sub-roles the club uses.
- **Join flow** — preview a club by code, request to join with a desired role/domain, get approved by a Secretary+.
- **7-role hierarchy** — President, Vice-President, Secretary, Joint-Secretary, Lead, Associate, Member, with rank-aware permissions.
- **Domains (sub-teams)** — partition a club into teams; tasks and members are domain-aware.
- **Tasks** — create, assign to multiple members, set due dates, track status, scoped by role and domain.
- **Action requests** — Leads propose promote/kick actions for their domain; Secretaries authorize them.
- **Announcements** — club-wide or domain-scoped, urgent or general.
- **Member directory & points** — list members with roles, domains, and leaderboard points.
- **Events** — create/list club events (backend ready; UI in progress).

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI, Uvicorn |
| Database | **PostgreSQL 14+** via SQLModel/SQLAlchemy, with Alembic migrations *(target — migration from the MySQL prototype in progress)* |
| Auth | JWT (`python-jose`), password hashing (`passlib[bcrypt]`) |
| Validation | Pydantic |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 — themed to the **Wired** editorial design system ([`DESIGN-wired.md`](./DESIGN-wired.md)) |
| Data fetching | TanStack Query, Axios |
| UI | Framer Motion, Phosphor Icons |

---

## How multi-tenancy works

Identity and tenancy are deliberately separated:

- The **JWT carries only the user id** — it says *who you are*, globally, across every club.
- The **club you're acting in is passed per request** via an `X-Club-ID` HTTP header.
- A dependency, `get_club_context()`, looks up your membership in `club_members` for that club and resolves your **role** and **domain** for the request.

```
Authorization: Bearer <jwt>      ->  who you are        (global)
X-Club-ID: 42                    ->  which club         (per request)
                                 ->  get_club_context() ->  role, domain_id
```

This is why one login works across many clubs, and why your points/role differ per club: they live on the membership, not the user.

> **Why PostgreSQL for a multi-tenant app:** tenant isolation is the #1 risk, and Postgres lets us enforce it in depth via Row-Level Security on top of the application-level `club_id` scoping. `jsonb` (for `enabled_roles` and future per-club permission maps), richer indexing/constraints, and Aurora Serverless on AWS seal the choice.

---

## Roles & permissions

Ordered low -> high authority:

```
member  <  associate  <  lead  <  joint_secretary  <  secretary  <  vice_president  <  president
```

| Capability | Min role |
|---|---|
| View members, tasks (own domain), announcements | Member |
| Be assigned tasks, update own task status | Member |
| Assign tasks within own domain | Associate |
| Create tasks in own domain; post domain announcements; raise promote/kick requests | Lead |
| Approve join & action requests; promote up to Lead; create events | Joint-Secretary / Secretary |
| Create/edit domains; edit club; post global announcements | Vice-President |
| Full control; auto-assigned to club creator | President |

A club's President picks which of these roles are active for the club via `enabled_roles`. Sensitive actions a Lead can't perform directly (promotions, kicks) go through the **action-request** approval flow.

---

## Project structure

```
ClubHub/
├── main.py                 # FastAPI app, CORS, router mounting
├── database.py             # DB connection + schema  (migrating to PostgreSQL)
├── auth.py                 # JWT, password hashing, role dependencies
├── schemas.py              # Pydantic request/response models + enums
├── seed.py                 # Populate a demo club with test users
├── requirements.txt
├── routes/
│   ├── auth.py             # register, login, me
│   ├── clubs.py            # create/list clubs, lookup by code
│   ├── join.py             # join requests + approvals
│   ├── members.py          # member list, role updates, kick
│   ├── domains.py          # sub-team CRUD
│   ├── tasks.py            # task CRUD + assignment
│   ├── announcements.py    # club/domain announcements
│   ├── events.py           # club events
│   ├── action_requests.py  # Lead-raised promote/kick approvals
│   └── users.py            # legacy/unused -- see Known issues
├── frontend/               # Next.js app
│   └── src/app/...         # landing, register, onboarding, dashboard
├── DESIGN-wired.md         # Frontend design system (Wired editorial)
└── SYSTEM_DESIGN.md        # Full SaaS architecture & roadmap
```

---

## Getting started

> These steps target the **PostgreSQL** stack. The data-layer migration (Phase 1) is the first task; if you're running the pre-migration MySQL build, swap the Postgres steps for a local MySQL 8 instance and the legacy `DB_*` env vars.

### Prerequisites

- Python 3.10+
- PostgreSQL 14+ running locally
- Node.js 18+ (for the frontend)

### 1. Backend

```bash
# from the repo root
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the repo root (it's git-ignored — never commit it):

```env
DATABASE_URL=postgresql+psycopg://clubhub:your_password@localhost:5432/clubhub
JWT_SECRET_KEY=generate_a_32_byte_hex_key
```

Generate a strong secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Create the database and apply migrations:

```bash
createdb clubhub          # or: CREATE DATABASE clubhub;
alembic upgrade head      # creates/updates all tables (no destructive drops)
```

Run the API:

```bash
uvicorn main:app --reload
```

- API: `http://127.0.0.1:8000`
- Interactive docs (Swagger): `http://127.0.0.1:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev          # http://localhost:3000
```

### 3. (Optional) Load demo data

```bash
python seed.py
```

This populates one demo club ("Test Club") with executives and three domains. See [Seeded test data](#seeded-test-data).

---

## API reference

All club-scoped endpoints require **two headers**:

```
Authorization: Bearer <access_token>
X-Club-ID: <club_id>
```

`/auth/*`, `/clubs` (create), `/clubs/my`, `/clubs/lookup`, and `/clubs/join` need only the bearer token (no `X-Club-ID`).

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create an account (name, email, password) |
| `POST` | `/auth/login` | Public | Returns `{ access_token, token_type }` |
| `GET`  | `/auth/me` | Bearer | Current user's global profile |

### Clubs & discovery

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET`  | `/clubs/lookup?code=AB-X7K2` | Public | Preview a club + its domains by code |
| `POST` | `/clubs` | Bearer | Create a club (caller becomes President) |
| `GET`  | `/clubs/my` | Bearer | Clubs I belong to, with my role |
| `GET`  | `/clubs/pending` | Bearer | My pending join requests |
| `GET`  | `/clubs/{club_id}` | Member | Club details |
| `PUT`  | `/clubs/{club_id}` | VP+ | Update club |

### Join requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/clubs/join` | Bearer | Submit a join request by code |
| `DELETE` | `/clubs/join/{request_id}` | Owner | Withdraw your request |
| `GET`  | `/clubs/{club_id}/requests` | Sec+ | List pending requests |
| `PUT`  | `/clubs/{club_id}/requests/{id}/approve` | Sec+ | Approve (optional role override) |
| `PUT`  | `/clubs/{club_id}/requests/{id}/reject` | Sec+ | Reject |

### Members & governance

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET`  | `/clubs/{club_id}/members` | Member | List members (with points & domain) |
| `PUT`  | `/clubs/{club_id}/members/{user_id}/role` | Sec+ | Promote/demote (rank rules apply) |
| `DELETE` | `/clubs/{club_id}/members/{user_id}` | Sec+ | Remove a member |
| `POST` | `/clubs/{club_id}/action-requests` | Lead | Raise a promote/kick request |
| `GET`  | `/clubs/{club_id}/action-requests` | Sec+ | List pending action requests |
| `PUT`  | `/clubs/{club_id}/action-requests/{id}/approve` \| `/reject` | Sec+ | Resolve |

### Domains, tasks, announcements, events

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` / `POST` | `/clubs/{club_id}/domains` | Member / VP+ | List / create domains |
| `PUT` / `DELETE` | `/clubs/{club_id}/domains/{id}` | VP+ | Update / delete domain |
| `GET` / `POST` | `/clubs/{club_id}/tasks` | Member / Lead+ | List (scoped) / create |
| `PUT` / `DELETE` | `/clubs/{club_id}/tasks/{id}` | Creator / Sec+ | Edit / delete |
| `POST` | `/clubs/{club_id}/tasks/{id}/assign` | Associate+ | Replace assignees |
| `GET` / `POST` | `/clubs/{club_id}/announcements` | Member / Lead+ | List (scoped) / post |
| `PUT` / `DELETE` | `/clubs/{club_id}/announcements/{id}` | Author / VP+ | Edit / delete |
| `GET` / `POST` | `/clubs/{club_id}/events` | Member / Sec+ | List / create |
| `PUT` / `DELETE` | `/clubs/{club_id}/events/{id}` | Sec+ | Update / delete |

Full request/response schemas are auto-documented at `/docs`.

---

## Seeded test data

After `python seed.py`, all accounts use the password **`password123`**:

| Email | Role |
|---|---|
| `aarav@clubhub.com` | President |
| `priya@clubhub.com` | Vice-President |
| `rohan@clubhub.com` | Secretary |
| `neha@clubhub.com` | Joint-Secretary |
| `technical_1@clubhub.com` | Lead (Technical) |
| `technical_2@clubhub.com` | Associate (Technical) |
| `technical_4@clubhub.com` | Member (Technical) |

**Demo club join code:** `TEST-2024` · Domains: Technical, Management, Design (10 members each).

---

## Known issues & first fixes

These are the highest-value items before building further (details and rationale in [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md)):

1. **Migrate the data layer to PostgreSQL (Phase 1, top priority).** Replace `mysql-connector` with SQLModel/SQLAlchemy on `psycopg`, port the raw SQL (MySQL `ENUM`/`AUTO_INCREMENT`/`TRUNCATE`/`ON DUPLICATE KEY`/`INSERT IGNORE`/`FIELD()` → Postgres equivalents), and introduce **Alembic** migrations. While porting, centralize the tenant filter so `club_id` scoping can't be forgotten.
2. **`routes/users.py` is dead, broken code.** It imports symbols that no longer exist (`UserCreate`, `get_password_hash`) and writes columns the schema doesn't have. It isn't mounted in `main.py`. **Delete it** — `/auth` fully replaces it.
3. **Schema drift was fixed.** `clubs.enabled_roles` and `club_members.points` were used in code but missing from the schema; both have been added. (They'll be captured in the initial Alembic migration during the Postgres port.)
4. **No migrations yet.** The legacy `create_db_and_tables()` drops all tables — replaced by Alembic as part of Phase 1 so deploys never wipe data.
5. **Secrets must leave source.** Remove hardcoded DB-password defaults; load all secrets from the environment and rotate the committed `JWT_SECRET_KEY`.
6. **Points aren't awarded yet.** Leaderboard values are static seed data — completing a task credits no one. See the gamification design (points ledger) in `SYSTEM_DESIGN.md`.
7. **Performance:** the task list issues one query per task to fetch assignees (N+1); list endpoints are unbounded (no pagination).
8. **Auth hardening:** add refresh tokens, move the frontend token out of `localStorage`, and add rate limiting on `/auth/*` and `/clubs/join`.

---

## Roadmap

The path from this prototype to a deployed SaaS (multi-tenant on AWS) is detailed in **[`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md)**:

1. **Stabilize** — fix the issues above.
2. **Re-platform data layer** — **PostgreSQL** + SQLModel + Alembic, with centralized tenant scoping (and Row-Level Security as defense-in-depth).
3. **Finish MVP** — points awarding + leaderboard endpoint, public club directory, profile fields, Google OAuth.
4. **Frontend** — implement the Wired design system, wire mocked pages to the API.
5. **Ship on AWS** — containerize, CI/CD, deploy on the free-tier path (RDS/Aurora PostgreSQL).

---

<div align="center">
<sub>Built by Vis · Architecture notes in <a href="./SYSTEM_DESIGN.md">SYSTEM_DESIGN.md</a> · Design system in <a href="./DESIGN-wired.md">DESIGN-wired.md</a></sub>
</div>
