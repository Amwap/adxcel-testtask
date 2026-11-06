#!/usr/bin/env bash
# Deploys adxcel.amwap.dev on the server or updates an existing deployment; safe to rerun.
#   first deploy: ssh user@server 'bash -s' < deploy.sh   (clones the repo into APP_DIR)
#   update:       the same command, or ./deploy.sh inside APP_DIR; CI runs it on every push to live
# Settings (env): APP_DIR (default /home/adxcel/adxcel-testtask), BRANCH (live), REPO_URL (GitHub over SSH).
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:Amwap/adxcel-testtask.git}"
BRANCH="${BRANCH:-live}"
APP_DIR="${APP_DIR:-/home/adxcel/adxcel-testtask}"
NGINX_AVAILABLE=/etc/nginx/sites-available/adxcel.amwap.dev.conf
NGINX_ENABLED=/etc/nginx/sites-enabled/adxcel.amwap.dev.conf

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

# 5. Daily DB backup at 03:00 into backend/backups/ (the cron line is added once)
if ! command -v crontab >/dev/null; then
  log "crontab not found, DB backups are not scheduled (install cron and rerun)"
elif ! crontab -l 2>/dev/null | grep -qF "$APP_DIR/backup_db.sh"; then
  log "Scheduling daily DB backup"
  { crontab -l 2>/dev/null || true
    echo "0 3 * * * $APP_DIR/backup_db.sh >> $APP_DIR/backend/logs/backup.log 2>&1"; } | crontab -
fi

# 6. Host nginx: sites-available/sites-enabled are symlinks to nginx/nginx.conf in the repo, so the checkout
#    above already updated the site; reloading needs root, so only the commands are printed
if [ ! -L "$NGINX_ENABLED" ]; then
  log "Host nginx site is not linked yet, run once:"
  echo "    sudo ln -sfn $APP_DIR/nginx/nginx.conf $NGINX_AVAILABLE"
  echo "    sudo ln -sfn $NGINX_AVAILABLE $NGINX_ENABLED"
  echo "    sudo nginx -t && sudo systemctl reload nginx"
elif [ -n "$old_rev" ] && ! git diff --quiet "$old_rev" HEAD -- nginx/nginx.conf; then
  log "nginx/nginx.conf changed, reload the host nginx:"
  echo "    sudo nginx -t && sudo systemctl reload nginx"
fi

if [ -z "$old_rev" ]; then
  log "First deploy done. Create a user:"
  echo "    cd $APP_DIR && docker compose exec -it backend python -m scripts.users create admin"
fi
log "Deployed: http://adxcel.amwap.dev"
