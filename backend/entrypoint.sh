#!/usr/bin/env bash
set -euo pipefail

# One-off override: `docker compose run --rm api <cmd>` runs <cmd> directly
# (e.g. alembic revision --autogenerate) without auto-migrating or starting the server.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Default (docker compose up): apply schema, then serve.
# The DB is guaranteed healthy via compose depends_on + healthcheck.
echo "[entrypoint] Running migrations: alembic upgrade head"
alembic upgrade head

echo "[entrypoint] Starting API: uvicorn app.main:app"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
