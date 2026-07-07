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

echo "[entrypoint] Starting API: uvicorn app.main:app ${RELOAD_FLAG}"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 ${RELOAD_FLAG}
