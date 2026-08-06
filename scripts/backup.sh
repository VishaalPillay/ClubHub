#!/usr/bin/env bash
# Nightly database backup. Installed as root cron on the droplet:
#
#   15 3 * * *  /srv/clubhub/scripts/backup.sh >> /var/log/clubhub-backup.log 2>&1
#
# Cron gets a minimal environment and no TTY, so: absolute paths everywhere, explicit cd,
# and `exec -T` on the compose call.
#
# This covers DATA loss. DigitalOcean's weekly droplet snapshots cover BOX loss. You want
# both — they fail in different ways and neither substitutes for the other.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/clubhub}"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
# Set to an rclone remote (e.g. "r2:clubhub-backups") to replicate off-box. Strongly
# recommended: a backup that only exists on the droplet does not survive losing the droplet.
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

cd "$APP_DIR"

# shellcheck source=/dev/null
set -a && . "$APP_DIR/.env.prod" && set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M)"
OUT="$BACKUP_DIR/clubhub-$STAMP.dump"

echo "[backup] Dumping to $OUT"
# exec (not run): dump from the already-running container rather than starting a second one.
# -T: no TTY allocation, required under cron.
# -Fc: custom format — compressed, and pg_restore can do selective/parallel restores.
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$OUT"

# A zero-byte dump means the pipe succeeded while pg_dump failed. Catch it here rather
# than discovering it during a restore.
if [ ! -s "$OUT" ]; then
  echo "[backup] FAILED: dump is empty, removing" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[backup] Wrote $(du -h "$OUT" | cut -f1)"

if [ -n "$RCLONE_REMOTE" ]; then
  echo "[backup] Replicating to $RCLONE_REMOTE"
  rclone copy "$OUT" "$RCLONE_REMOTE"
fi

echo "[backup] Pruning local dumps older than $RETAIN_DAYS days"
find "$BACKUP_DIR" -name 'clubhub-*.dump' -mtime "+$RETAIN_DAYS" -delete

echo "[backup] Done."
