# ADR-0003 — Execution model: run everything inside the container

- **Status:** Accepted
- **Date:** 2026-06-18
- **Context:** ClubHub backend re-platform (Foundation + Auth slice)

## Decision

`alembic`, one-off scripts, and `pytest` are all run **inside the API container** via
`docker compose exec api ...`. The committed `.env` (consumed by Docker Compose) uses the
**compose-network host**:

```
DATABASE_URL=postgresql+psycopg://clubhub:clubhub@db:5432/clubhub
```

The hostname `db` only resolves on the Compose network. A `localhost:5432` URL is reserved for
**optional** host-side work and must be set explicitly there (e.g. a separate shell env var), never
committed as the default.

Schema is applied automatically on container start: `entrypoint.sh` runs `alembic upgrade head`
(after Postgres reports healthy via `depends_on` + healthcheck) and then launches `uvicorn`, so
`docker compose up` is a single command against an already-migrated database.

## Why

- A single, documented execution path avoids the "`db` doesn't resolve from my host venv" class of
  errors and keeps host vs. container DSNs from drifting.
- Auto-migrate-on-boot means the API never comes up against a tableless database.

## Consequences

- Tests need a real Postgres (see ADR-0001 rationale for jsonb / `ON CONFLICT` / `CHECK`): a
  dedicated `clubhub_test` database on the same Compose Postgres, with a transaction-rollback
  fixture per test. `testcontainers[postgres]` is the equivalent path for CI / host runs.
