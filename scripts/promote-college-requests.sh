#!/usr/bin/env bash
# Weekly auto-promotion of college_requests into the public `colleges` table. Installed as
# root cron on the droplet:
#
#   30 3 * * 0  /srv/clubhub/scripts/promote-college-requests.sh >> /var/log/clubhub-promote.log 2>&1
#
# WHY THIS EXISTS
# CollegeSelect's "Can't find your college?" flow (frontend/src/features/auth/CollegeSelect.tsx)
# logs a missing college to college_requests, but the requesting user's own typed name is used
# immediately regardless — nothing about that POST helps the NEXT person searching for the same
# college. This job is what actually grows the dropdown: it promotes any pending request with
# enough distinct requesters (COLLEGE_PROMOTION_THRESHOLD, app/core/config.py) into `colleges`,
# which the frontend merges into the curated list on every fetch — no redeploy needed.
#
# See backend/app/scripts/promote_college_requests.py for the fuzzy-dedupe + junk-name logic.
# It's a `docker compose run` (not `exec`), matching entrypoint.sh's one-off-tooling path
# (CLAUDE.md) — a fresh container that execs the script directly and skips auto-migrate + serve.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/clubhub}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

cd "$APP_DIR"

echo "[promote] Running college_requests promotion pass"
docker compose -f "$COMPOSE_FILE" run --rm api python -m app.scripts.promote_college_requests

echo "[promote] Done."
