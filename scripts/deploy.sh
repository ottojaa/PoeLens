#!/bin/bash
# Deploys origin/main on the home server. Run on the server: bash /opt/poelens/scripts/deploy.sh
# (the GitHub workflow does it over SSH). Order: build everything, dump the database, migrate, start the backend,
# and only then publish the web files, so a failed step leaves the previous site and API running together.
set -euo pipefail

# The whole script lives in a function: `git reset` below replaces this very file, and bash reads a script as it
# runs, so a file rewritten mid-run could be executed from the wrong offset. As a function it is parsed first, and
# `main "$@"; exit` on the last line stops bash from reading anything after it.
main() {
    DEPLOY_DIR="${DEPLOY_DIR:-/opt/poelens}"
    WEB_DIR="${DEPLOY_DIR}/web"
    ENV_FILE="${DEPLOY_DIR}/.env.production"
    LOG_FILE="${DEPLOY_DIR}/deploy.log"
    MIGRATE_PATH="apps/backend/dist/apps/backend/src/db/migrate.js"
    COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

    # Mirror all output to a log, so a running deploy can be followed: tail -f /opt/poelens/deploy.log
    exec > >(tee "$LOG_FILE") 2>&1
    echo "=== Deploy started: $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="

    cd "$DEPLOY_DIR"
    # Hard-reset rather than `git pull`: the server is a clean checkout of main, and local drift in a tracked file
    # would block a pull. Untracked files (.env.production, deploy.log, web/) are left alone.
    git fetch origin main
    git reset --hard origin/main

    # 1. Build. Nothing running changes yet.
    "${COMPOSE[@]}" build backend
    extract_web

    # 2. Dump the database from the running (old) container. A failed dump aborts the deploy with the old stack
    #    untouched. The only skip is the first deploy, when no database container exists yet.
    if [ -n "$(docker ps -q --filter 'name=^poelens-postgres$')" ]; then
        bash scripts/backup.sh predeploy 7
    else
        echo "No running poelens-postgres container: skipping the pre-deploy backup (first deploy)."
    fi

    # 3. Database up, then migrate BEFORE the new backend starts, so an enabled collector never polls against an old
    #    schema. The old backend (if any) keeps running on the new schema for a few seconds: migrations must stay
    #    compatible with it. `run` makes a one-off container from the new image.
    "${COMPOSE[@]}" up -d --wait postgres
    "${COMPOSE[@]}" run --rm --no-deps backend node "$MIGRATE_PATH"

    # 4. Start the new backend. --wait fails the deploy if its health check never passes.
    "${COMPOSE[@]}" up -d --wait backend

    # 5. Publish the web files, then tidy up.
    rm -rf "${WEB_DIR}.old"
    [ ! -d "$WEB_DIR" ] || mv "$WEB_DIR" "${WEB_DIR}.old"
    mv "${WEB_DIR}.new" "$WEB_DIR"
    rm -rf "${WEB_DIR}.old"
    docker image prune -f

    echo "Deploy complete"
}

# Builds the web app (the builder stage of the Dockerfile) and copies its static files to ${WEB_DIR}.new.
extract_web() {
    local cid

    docker build --target builder -t poelens-builder .

    # An extractor container left by an aborted run would block `docker rmi`, and under `set -e` that used to abort
    # the deploy before the backend restarted. Clear it first.
    docker rm -f poelens-web-extract >/dev/null 2>&1 || true
    cid=$(docker create --name poelens-web-extract poelens-builder)
    # shellcheck disable=SC2064 # $cid is meant to be expanded now
    trap "docker rm -f '$cid' >/dev/null 2>&1 || true" EXIT

    rm -rf "${WEB_DIR}.new"
    mkdir -p "${WEB_DIR}.new"
    docker cp "$cid:/app/apps/web/dist/." "${WEB_DIR}.new/"

    docker rm -f "$cid" >/dev/null 2>&1 || true
    trap - EXIT
    # Cosmetic: must never abort the deploy.
    docker rmi -f poelens-builder >/dev/null 2>&1 || true
}

main "$@"; exit
