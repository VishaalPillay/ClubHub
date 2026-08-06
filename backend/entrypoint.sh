#!/usr/bin/env bash
set -euo pipefail

# One-off override: `docker compose run --rm api <cmd>` runs <cmd> directly
# (e.g. alembic revision --autogenerate) without auto-migrating or starting the server.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# In production the DB credentials are injected as DISCRETE secrets (POSTGRES_HOST / USER /
# PASSWORD / ...), never as a pre-built DSN in the task definition — so the password never sits
# in plaintext anywhere but process memory. Assemble DATABASE_URL from the parts when it isn't
# already set. (Dev is unaffected: docker-compose sets DATABASE_URL explicitly.)
if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_HOST:-}" ]; then
  export DATABASE_URL="postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}?sslmode=require"
  echo "[entrypoint] Assembled DATABASE_URL from POSTGRES_* (host=${POSTGRES_HOST})"
fi

# Default (docker compose up): apply schema, then serve.
# The DB is guaranteed healthy via compose depends_on + healthcheck.
echo "[entrypoint] Running migrations: alembic upgrade head"
alembic upgrade head

# --reload watches the source tree and restarts on change — great for dev, wasteful and
# unnecessary in production (the code is baked into the image, not bind-mounted). It is
# enabled only when RELOAD=true (set by docker-compose); prod leaves it off.
RELOAD_FLAG=""
if [ "${RELOAD:-false}" = "true" ]; then
  RELOAD_FLAG="--reload"
fi

# --proxy-headers makes uvicorn trust X-Forwarded-{For,Proto} from the reverse proxy, but only
# from peers listed in --forwarded-allow-ips. That default (127.0.0.1) is wrong under compose:
# Caddy reaches this container over the Docker bridge as 172.x.x.x, so without FORWARDED_ALLOW_IPS
# uvicorn SILENTLY ignores every proxy header and request.client.host stays the bridge gateway.
# docker-compose.prod.yml sets it to "*", which is safe ONLY because port 8000 is never published
# to the host — Caddy is the sole possible peer. Publishing 8000 and keeping "*" would be a
# spoofing hole; the compose file and this flag are one unit.
#
# Deliberately NO --workers: slowapi's rate-limit counters live in-process (app/core/ratelimit.py),
# so N workers would make every configured limit N times looser with no error. One worker is a
# correctness constraint here, not a sizing choice. See ADR-0003.
echo "[entrypoint] Starting API: uvicorn app.main:app ${RELOAD_FLAG}"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}" \
  ${RELOAD_FLAG}
