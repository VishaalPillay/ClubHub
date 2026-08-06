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

## Addendum (2026-08): production execution model

The same rule holds in production, with the same file doing the work. `docker-compose.prod.yml`
runs the stack on a single droplet, and the ops path is the `$# -gt 0` branch of `entrypoint.sh`
that was built for dev:

```bash
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
docker compose -f docker-compose.prod.yml run --rm api python -c "..."
```

Three properties are worth stating explicitly, because each one is load-bearing and each one
looks like a sizing choice while actually being a correctness constraint.

**Exactly one `api` container.** `alembic upgrade head` on boot stays safe because nothing else
can be migrating concurrently. On the earlier AWS design this property had to be *manufactured*
(`minHealthyPercent: 0`, so ECS replaces the single task in place rather than briefly running
two); under Compose it is structural. Scaling `api` to 2 replicas reintroduces the race.

**Exactly one uvicorn worker.** `entrypoint.sh` deliberately passes no `--workers`. slowapi's
rate-limit counters live in process memory (`app/core/ratelimit.py`), so N workers make every
configured limit N times looser — silently, with no error and no failing test. Add a shared
limiter backend (Redis) *before* adding a worker.

**Proxy headers must be trusted explicitly.** uvicorn runs with `--proxy-headers` and
`--forwarded-allow-ips` fed from `FORWARDED_ALLOW_IPS`. The default (`127.0.0.1`) is wrong under
Compose — Caddy reaches the container over the Docker bridge as `172.x.x.x`, so without the
override uvicorn ignores every proxy header and `request.client.host` stays the bridge gateway.
`docker-compose.prod.yml` sets `"*"`, which is safe **only** because port 8000 is never published
to the host: Caddy is the sole possible peer. That compose file and this flag are one unit —
publishing the port while keeping `"*"` would be a header-spoofing hole.

For a destructive or long-running migration, take a backup and run it deliberately before rolling
the app, rather than letting boot-time migration do it under a health-check timeout:

```bash
./scripts/backup.sh
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
docker compose -f docker-compose.prod.yml up -d --build
```
