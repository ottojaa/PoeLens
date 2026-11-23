# PoeLens

A self-hosted companion app for Path of Exile 2 (and later Path of Exile 1). It records economy prices over time, lets you watch the items you care about, and answers price questions over MCP.

**Status:** the workspace is set up and the API, web app and desktop shell start. The price collector and accounts are next; see [ROADMAP.md](ROADMAP.md).

Planned for the first version: hourly price history from [poe.ninja](https://poe.ninja), an economy view you can configure, search across everything, per-item history charts, a watchlist, an MCP server, and invite-only accounts. It ships as a web app, an Electron desktop app and an Android app.

## Development

An Nx + Yarn 4 monorepo: `apps/backend` (Fastify API), `apps/web` (React web app and the Electron shell), `libs/shared` (Zod contracts). You need Node 20.19 or newer and Docker for the database. Yarn is pinned inside the repo, so it needs no installation: use `node .yarn/releases/yarn-4.17.1.cjs` wherever you would type `yarn`.

```sh
node .yarn/releases/yarn-4.17.1.cjs install
cp .env.example .env                       # optional: every value is also the default outside production
docker compose up -d postgres              # TimescaleDB on 127.0.0.1:5433
npx nx run @poelens/backend:migrate      # apply the migrations
npx nx serve @poelens/backend              # API on http://localhost:3100, docs at /docs
npx nx serve @poelens/web                  # web app on http://localhost:4300
npx nx run @poelens/web:serve:electron     # web dev server plus the desktop shell around it
```

The API answers `/health` with "degraded" while the database is not running, so you can start it without Docker.

Checks:

```sh
npx nx run-many -t lint typecheck          # lint and typecheck
npx nx format:check --all                  # formatting
npx nx run-many -t test                    # tests (builds @poelens/shared and the backend first)
```

See [CLAUDE.md](CLAUDE.md) for the conventions.

## Production

PoeLens runs on the home server next to reverie, the same way: host nginx and certbot in front, Docker Compose for the API and its database, and deploys over SSH. Nothing here runs by itself: each step below is run by hand on the server (or in GitHub) once.

| Piece                    | Where                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Checkout, env file, logs | `/opt/poelens` (`.env.production`, `deploy.log`)                                                                    |
| Web app (static files)   | `/opt/poelens/web`, served by nginx at https://poelens.com (`www.` redirects there)                                 |
| API                      | container `poelens-backend` on `127.0.0.1:3100`, proxied at https://api.poelens.com (reverie's backend holds 3000)  |
| Database                 | container `poelens-postgres` (TimescaleDB 2.32.1 on Postgres 17), volume `poelens_postgres_data`, no published port |
| Backups                  | `BACKUP_DIR` from `.env.production`, `/mnt/nas/poelens/backups` by default in the example                           |

### One-time setup

Needs on the server: Docker with Compose v2 (`docker compose version`), git, nginx 1.25.1 or newer (`nginx -v`; see the note in `config/nginx/poelens.com.conf` for older ones), certbot with its nginx plugin, and DNS for `poelens.com`, `www.poelens.com` and `api.poelens.com` pointing at the server (check with `dig +short poelens.com www.poelens.com api.poelens.com`). The user you run this as must be in the `docker` group, the same user reverie deploys as.

1. **Clone** the repo, which is public, to `/opt/poelens`:

    ```sh
    sudo mkdir -p /opt/poelens && sudo chown "$USER": /opt/poelens
    git clone https://github.com/ottojaa/PoeLens.git /opt/poelens
    ```

2. **Write the env file.** It holds the database password, so it never goes into git:

    ```sh
    cd /opt/poelens
    cp .env.production.example .env.production
    chmod 600 .env.production
    sed -i "s/CHANGE_ME/$(openssl rand -hex 24)/g" .env.production   # one password, in POSTGRES_PASSWORD and DATABASE_URL
    sudo mkdir -p /mnt/nas/poelens/backups && sudo chown "$USER": /mnt/nas/poelens/backups   # or the BACKUP_DIR you chose in the file
    findmnt -T /mnt/nas/poelens/backups                                 # must show the NAS, not `/`: otherwise the dumps share the database's disk
    ```

    Check the file: `grep CHANGE_ME .env.production` prints nothing, and `CORS_ORIGIN`, `COLLECTOR_*` and `BACKUP_DIR` hold what you want. Every variable is described in the example file.

3. **First deploy.** It builds the image (a few minutes), starts the database, applies the migrations, starts the backend and publishes the web files. Nothing is dumped, because no database exists yet:

    ```sh
    bash /opt/poelens/scripts/deploy.sh
    ```

    The collector starts with the backend (`COLLECTOR_ENABLED=true`), so price history begins now. Follow it with `tail -f /opt/poelens/deploy.log`; afterwards `docker logs -f poelens-backend`, and check that the API answers: `curl -s http://127.0.0.1:3100/health`.

4. **nginx.** Install both configs, which listen on port 80 only:

    ```sh
    cd /opt/poelens/config/nginx
    sudo cp poelens.com.conf api.poelens.com.conf /etc/nginx/sites-available/
    sudo ln -s /etc/nginx/sites-available/poelens.com.conf /etc/nginx/sites-enabled/
    sudo ln -s /etc/nginx/sites-available/api.poelens.com.conf /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    ```

5. **Certificates.** One certificate for the three names; certbot adds the 443 blocks and the HTTP-to-HTTPS redirects to both files and renews on its own:

    ```sh
    sudo certbot --nginx -d poelens.com -d www.poelens.com -d api.poelens.com
    ```

    Check: `curl -s https://api.poelens.com/health` answers JSON, `curl -sI https://poelens.com` is `200`, and `curl -sI https://www.poelens.com` is a `301` to `https://poelens.com/`.

6. **Daily backup (cron).** Price history cannot be fetched again, and deploys alone are too rare to be a backup. Try it once, then add it to the crontab (`crontab -e`) of the same user:

    ```sh
    /opt/poelens/scripts/backup.sh            # writes BACKUP_DIR/poelens-daily-<UTC time>.dump
    ```

    ```cron
    17 3 * * * /opt/poelens/scripts/backup.sh >> /opt/poelens/backup.log 2>&1
    ```

    This keeps the newest 14 daily dumps. Deploys take their own `poelens-predeploy-*` dump first and keep the newest 7 of those, so neither prunes the other.

    **Space:** a dump is about as large as the database. Check it with `scripts/db.sh -c "SELECT pg_size_pretty(pg_database_size(current_database()))"`. The backup directory then needs roughly 21 times that (14 daily and 7 pre-deploy dumps), and the raw archive grows by a few GB a year, so give it tens of GB. A dump on the same disk as the database volume does not survive that disk dying, which is why `BACKUP_DIR` points at the NAS.

7. **Deploying from GitHub (optional).** A key that can do nothing but deploy:

    ```sh
    ssh-keygen -t ed25519 -N '' -C poelens-deploy -f ~/poelens-deploy   # on any machine; keep the private half secret
    ```

    On the server, add one line to `~/.ssh/authorized_keys` for the user that owns `/opt/poelens`: the public key (`~/poelens-deploy.pub`) with this prefix, all on one line. Whatever the client asks for, the server then runs the deploy script:

    ```text
    command="bash /opt/poelens/scripts/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... poelens-deploy
    ```

    In the repo's Settings, Secrets and variables, Actions, add: `SSH_HOST` (the server's address as GitHub reaches it), `SSH_PORT` (`22` unless changed), `SSH_USER` (the user above) and `SSH_PRIVATE_KEY` (the whole private key file). Delete the local key files afterwards. Then Actions, Deploy, Run workflow (or `gh workflow run deploy.yml`) deploys `main`. The workflow runs only when started by hand; to deploy on every merge, add `push: { branches: [main] }` under `on:` in `.github/workflows/deploy.yml`.

### Everyday deploys

Merge to `main`, then run `bash /opt/poelens/scripts/deploy.sh` on the server (or the workflow). In order, it:

1. resets the checkout to `origin/main` and builds the images (the running site is untouched);
2. dumps the database (`poelens-predeploy-*`), aborting the deploy if the dump fails;
3. starts the database and **applies the migrations before the new backend starts**, so a collector never polls against an old schema. The old backend runs against the new schema for a few seconds, so a migration must not remove what the running code still reads (see the database-conventions skill);
4. starts the backend and waits for its health check (any HTTP 200 from `/health`, even `degraded`; a backend that never answers fails the deploy);
5. only then swaps in the new web files.

A deploy that fails stops at that step and prints why; `/opt/poelens/deploy.log` has the whole run. The script file itself is replaced by the reset, so a change to `deploy.sh` takes effect on the deploy after the one that brought it in.

Useful commands, from `/opt/poelens`:

```sh
./scripts/db.sh                                   # psql in the database
./scripts/db.sh -c "SELECT count(*) FROM prices"
docker logs --tail 100 -f poelens-backend
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

The build also emits `reparse.js` next to `migrate.js` (`apps/backend/dist/apps/backend/src/db/`) once the collector has one. Run it the way deploys run migrations:
`docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --no-deps backend node apps/backend/dist/apps/backend/src/db/reparse.js`.

To give the database more memory or CPUs than the first start tuned it for (`TS_TUNE_MEMORY`, `TS_TUNE_NUM_CPUS` are read only when the volume is first created), run `docker exec poelens-postgres timescaledb-tune --yes --memory 4GB --cpus 4 --conf-path /var/lib/postgresql/data/postgresql.conf`, then `docker restart poelens-postgres`.

### Restoring a backup

A TimescaleDB database has to be restored with its extension in "restore mode": create the database, create the extension, call `timescaledb_pre_restore()`, run `pg_restore`, call `timescaledb_post_restore()`. Do it inside the database container, which is the same pinned image the dump came from (restoring into a different TimescaleDB version can fail). A dump written by `pg_dump` prints a warning about circular foreign keys on `continuous_agg`; that is TimescaleDB's own catalog and is harmless in a full restore.

Rehearse a restore into a scratch database first. It is safe to do at any time and touches nothing else:

```sh
cd /opt/poelens
DUMP=/mnt/nas/poelens/backups/poelens-daily-<time>.dump     # the dump to restore
DB=poelens_restore                                          # a scratch name, so the live database is untouched
dbexec() { docker exec -i -e DB="$DB" poelens-postgres sh -c "$1"; }   # runs a command in the database container

dbexec 'createdb -U "$POSTGRES_USER" "$DB"'
dbexec 'psql -U "$POSTGRES_USER" -d "$DB" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS timescaledb" -c "SELECT timescaledb_pre_restore()"'
dbexec 'pg_restore -U "$POSTGRES_USER" -d "$DB"' <"$DUMP"
dbexec 'psql -U "$POSTGRES_USER" -d "$DB" -v ON_ERROR_STOP=1 -c "SELECT timescaledb_post_restore()"'

dbexec 'psql -U "$POSTGRES_USER" -d "$DB" -c "SELECT count(*) FROM prices"'   # compare with the live database
dbexec 'dropdb -U "$POSTGRES_USER" "$DB"'                                      # tidy up
```

A real restore (the volume is lost or the data is damaged) runs the same four steps on the live database, with the backend stopped. On a lost volume the first deploy has already created an empty database and applied the migrations, so the live database is dropped and created fresh either way:

```sh
cd /opt/poelens
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
DUMP=/mnt/nas/poelens/backups/poelens-daily-<time>.dump
dbexec() { docker exec -i poelens-postgres sh -c "$1"; }

$COMPOSE up -d --wait postgres
$COMPOSE stop backend
dbexec 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE \"$POSTGRES_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$POSTGRES_DB\""'
dbexec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS timescaledb" -c "SELECT timescaledb_pre_restore()"'
dbexec 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <"$DUMP"
dbexec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "SELECT timescaledb_post_restore()"'
$COMPOSE run --rm --no-deps backend node apps/backend/dist/apps/backend/src/db/migrate.js   # the dump may predate the deployed code
$COMPOSE up -d --wait backend
```

---

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
