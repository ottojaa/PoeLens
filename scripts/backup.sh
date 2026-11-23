#!/bin/bash
# The one place that dumps the database, for the daily cron and for scripts/deploy.sh. Price history cannot be
# fetched again, so a dump is the only copy that survives a lost volume.
#
#   scripts/backup.sh                    # a "daily" dump, keeping the newest 14
#   scripts/backup.sh predeploy 7        # a "predeploy" dump, keeping the newest 7
#
# Every prefix is pruned on its own, so a deploy never deletes the daily dumps. Dumps are written to BACKUP_DIR
# (from the environment, else from /opt/poelens/.env.production, else /opt/poelens/backups) as
# poelens-<prefix>-<UTC time>.dump in pg_dump's custom format. To restore one, see "Restoring a backup" in the README.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/poelens}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env.production}"
CONTAINER="${POSTGRES_CONTAINER:-poelens-postgres}"
PREFIX="${1:-daily}"
KEEP="${2:-14}"

if ! [[ "$PREFIX" =~ ^[a-z]+$ ]] || ! [[ "$KEEP" =~ ^[1-9][0-9]*$ ]]; then
    echo "Usage: backup.sh [prefix: lowercase letters] [keep: how many dumps]" >&2
    exit 2
fi

# Reads one KEY=value line from the env file without sourcing it (nothing in there is shell code).
read_env_value() {
    [ -f "$ENV_FILE" ] || return 0
    grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true
}

BACKUP_DIR="${BACKUP_DIR:-$(read_env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"

if [ -z "$(docker ps -q --filter "name=^${CONTAINER}\$")" ]; then
    echo "ERROR: container ${CONTAINER} is not running; nothing to dump" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/poelens-${PREFIX}-$(date -u '+%Y%m%dT%H%M%SZ').dump"
# A half-written file must never look like a dump, and must not be left behind when the dump fails.
trap 'rm -f "${BACKUP_FILE}.partial"' EXIT

echo "Dumping the database to ${BACKUP_FILE}..."
docker exec "$CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' >"${BACKUP_FILE}.partial"

# A failed or interrupted pg_dump already aborts the script (set -e). Reading the archive's table of contents on top
# catches an empty or garbled file before it is kept.
docker exec -i "$CONTAINER" pg_restore --list <"${BACKUP_FILE}.partial" >/dev/null
mv "${BACKUP_FILE}.partial" "$BACKUP_FILE"
echo "Wrote $(du -h "$BACKUP_FILE" | cut -f1): ${BACKUP_FILE}"

# Keep the newest $KEEP dumps of this prefix.
ls -1t "$BACKUP_DIR"/poelens-"${PREFIX}"-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
