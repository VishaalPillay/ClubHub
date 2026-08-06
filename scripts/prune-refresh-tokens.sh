#!/usr/bin/env bash
# Weekly cleanup of the refresh_tokens table. Installed as root cron on the droplet:
#
#   45 3 * * 0  /srv/clubhub/scripts/prune-refresh-tokens.sh >> /var/log/clubhub-prune.log 2>&1
#
# WHY THIS EXISTS
# The frontend rotates its refresh token roughly every 15 minutes per active session, and
# rotation INSERTs a new row while only marking the old one revoked. Nothing ever deletes.
# That is ~2,880 rows per active user per month, growing forever.
#
# READ BEFORE CHANGING THE WINDOW — this is a security trade, not housekeeping.
# rotate_refresh_token (backend/app/modules/auth/service.py) checks `revoked_at` BEFORE it
# checks `expires_at`. That ordering is what turns a replayed token into REFRESH_REUSED and
# revokes every session for the user. Delete a revoked row too early and the same replay
# degrades to a quiet INVALID_REFRESH — the attack still fails, but it stops being detected
# and stops burning the attacker's other stolen sessions.
#
# expires_at < now() - 7 days keeps every row for its full 30-day validity plus a week of
# grace, so detection is intact across the entire window in which a stolen token could
# plausibly be replayed. Shortening it silently weakens ADR-0002.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/clubhub}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
GRACE="${GRACE:-7 days}"

cd "$APP_DIR"

# shellcheck source=/dev/null
set -a && . "$APP_DIR/.env.prod" && set +a

echo "[prune] Deleting refresh_tokens expired more than $GRACE ago"
docker compose -f "$COMPOSE_FILE" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c \
  "DELETE FROM refresh_tokens WHERE expires_at < now() - interval '$GRACE';"

echo "[prune] Done."
