#!/usr/bin/env bash
# Re-deploy ReVibe on the server: pull the latest code, rebuild, restart, wait until healthy.
# Install once, then just type `deploy` from anywhere:
#   chmod +x deploy.sh && sudo ln -sf "$PWD/deploy.sh" /usr/local/bin/deploy
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

step() { printf '\n\033[1;35m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; docker compose logs --tail 40 migrate backend web || true; exit 1; }

# State of one service's container: "healthy", "starting", "unhealthy", or "exited <code>".
state() {
  local id
  id=$(docker compose ps -aq "$1")
  [ -n "$id" ] || { echo missing; return; }
  docker inspect -f '{{if eq .State.Status "exited"}}exited {{.State.ExitCode}}{{else if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

step "Pulling the latest code"
git pull --ff-only || fail "git pull failed. Local edits on the server? See: git status"
git log --oneline -1

step "Building images (takes a few minutes)"
docker compose build

step "Restarting (database migrations run first)"
docker compose up -d --force-recreate

step "Waiting for backend and web to be healthy (up to 5 minutes)"
for _ in $(seq 60); do
  migrate=$(state migrate) backend=$(state backend) web=$(state web)
  printf '\r  migrate: %-10s backend: %-10s web: %-10s' "$migrate" "$backend" "$web"
  case "$migrate" in exited\ [1-9]*) echo; fail "Database migration failed" ;; esac
  [ "$backend" = unhealthy ] || [ "$web" = unhealthy ] && { echo; fail "A service is unhealthy"; }
  [ "$backend" = healthy ] && [ "$web" = healthy ] && break
  sleep 5
done
echo
[ "$backend" = healthy ] && [ "$web" = healthy ] || fail "Not healthy after 5 minutes"

step "Removing old unused images (frees disk space)"
docker image prune -f >/dev/null

printf '\n\033[1;32m✓ Deployed %s\033[0m  (press Ctrl+Shift+R in the browser)\n' "$(git log --oneline -1)"
