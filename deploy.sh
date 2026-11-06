#!/usr/bin/env bash
# Deploys adxcel.amwap.dev on the server or updates an existing deployment; safe to rerun.
#   first deploy: ssh user@server 'bash -s' < deploy.sh   (clones the repo into APP_DIR)
#   update:       the same command, or ./deploy.sh inside APP_DIR; CI runs it on every push to live
# Settings (env): APP_DIR (default ~/adxcel), BRANCH (live), REPO_URL (GitHub over SSH).
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:Amwap/adxcel-testtask.git}"
BRANCH="${BRANCH:-live}"
APP_DIR="${APP_DIR:-$HOME/adxcel}"
NGINX_SITE=/etc/nginx/sites-enabled/adxcel.amwap.dev.conf

log() { printf '\n==> %s\n' "$*"; }

# 1. Code: clone on first run, otherwise force-checkout the remote branch (local edits are discarded)
if [ -d "$APP_DIR/.git" ]; then
  log "Updating $APP_DIR to origin/$BRANCH"
  old_rev=$(git -C "$APP_DIR" rev-parse HEAD)
  git -C "$APP_DIR" fetch --prune origin "$BRANCH"
  git -C "$APP_DIR" checkout -q -f -B "$BRANCH" "origin/$BRANCH"
else
  log "Cloning $REPO_URL ($BRANCH) into $APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  old_rev=
fi
cd "$APP_DIR"
git log -1 --format='    %h %s'

# 2. Backend secrets: created once, kept across updates (untracked)
if [ ! -f backend/.env ]; then
  log "Creating backend/.env with a fresh JWT_SECRET"
  sed "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" backend/.env.example > backend/.env
  chmod 600 backend/.env
fi

# 3. Build and (re)start the stack, wait until the backend is healthy
log "Building and starting containers"
docker compose up -d --build --remove-orphans --wait

# 4. Load CSVs into SQLite (incremental: unchanged files are skipped)
if [ -f backend/data/interview.X.csv ] && [ -f backend/data/interview.y.csv ]; then
  log "Syncing data"
  docker compose exec -T backend python -m scripts.sync_data
else
  log "Skipping data sync: put interview.X.csv and interview.y.csv into $APP_DIR/backend/data/ and rerun"
fi

docker image prune -f >/dev/null

# 5. Host nginx: the site is a symlink to nginx/nginx.conf, reload it when the config changed
if [ ! -e "$NGINX_SITE" ]; then
  log "Host nginx site is not linked yet, run once:"
  echo "    sudo ln -s $APP_DIR/nginx/nginx.conf $NGINX_SITE && sudo nginx -t && sudo systemctl reload nginx"
elif [ -n "$old_rev" ] && ! git diff --quiet "$old_rev" HEAD -- nginx/nginx.conf; then
  log "nginx/nginx.conf changed, reloading host nginx"
  if sudo -n nginx -t && sudo -n systemctl reload nginx; then :; else
    echo "    no passwordless sudo, reload manually: sudo nginx -t && sudo systemctl reload nginx"
  fi
fi

if [ -z "$old_rev" ]; then
  log "First deploy done. Create a user:"
  echo "    cd $APP_DIR && docker compose exec backend python -m scripts.users create admin"
fi
log "Deployed: http://adxcel.amwap.dev"
