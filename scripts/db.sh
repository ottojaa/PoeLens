#!/bin/bash
# Connect to the PoeLens database. Usage:
#   ./scripts/db.sh                                  # interactive psql
#   ./scripts/db.sh -c "SELECT count(*) FROM prices"
set -euo pipefail
# The role and database names come from the container's own environment, so this follows .env.production.
exec docker exec -it poelens-postgres sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "$@"
