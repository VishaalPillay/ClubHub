#!/usr/bin/env bash
# Pull and roll the production stack. Run on the droplet: /srv/clubhub/scripts/deploy.sh
#
# Deliberately dumb. No registry, no secrets, no pipeline — on launch day the thing you want
# least is a deployment system that itself needs debugging. `next build` runs here, in place,
# while the site is serving; on a 2 GB droplet that is the fattest thing that will ever run
# on the box, which is why the swapfile is not optional.
#
# MOVE TO A REGISTRY-BASED PIPELINE when this OOMs, or takes the site down for more than ~60s.
# That is the trigger condition — see docs/DEPLOYMENT.md. The upgrade is: build the images in
# GitHub Actions, push to GHCR, and reduce this script to `docker compose pull && up -d`.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/clubhub}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

cd "$APP_DIR"

echo "[deploy] Fetching latest main"
git pull --ff-only

echo "[deploy] Building and rolling containers"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[deploy] Pruning dangling images"
docker image prune -f

echo "[deploy] Waiting for the API to report healthy"
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T api \
      python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health')" \
      >/dev/null 2>&1; then
    echo "[deploy] API healthy. Done."
    exit 0
  fi
  sleep 5
done

echo "[deploy] API did not become healthy in 150s. Recent logs:" >&2
docker compose -f "$COMPOSE_FILE" logs --tail 50 api >&2
exit 1
