# Docker developer setup

Use this for a fresh clone. It does not use the existing Windows venv, node_modules,
`dawaisathi-mongo` container, local database or uploads. Each checkout uses the
`dawaisathi-dev` Compose project. Use `-p unique-name` on **every** command if you
need two developer stacks on the same machine, and adjust host ports first.

## Requirements

- Git and access to the private GitHub repository.
- Docker Desktop running Linux containers; Docker Compose 2.24.4+ (v5 also works).
- Python 3.11+ only for the secret initializer/check script, not the app runtime.
- Enough memory for Expo bundling; 4 GB available to Docker is a practical starting point.

## First run (PowerShell, macOS or Linux)

```sh
git clone https://github.com/chaudharysuryapratap/DawaiSathi.git
cd DawaiSathi
python scripts/init-docker.py dev
docker compose --env-file .env.docker up -d --build --wait --wait-timeout 600
python scripts/check-docker.py http://localhost:18081 --api-url http://localhost:18000
```

Use `python3` where `python` is unavailable. Open **http://localhost:18081**.
API/docs: http://localhost:18000/docs. All published developer ports bind to
loopback; this is not a public or phone-accessible staging service.

The initializer creates ignored `.env.docker` with random independent database,
JWT and bootstrap secrets. It refuses to overwrite it. Never commit or share it.
Do not run `docker compose config` without `--quiet` in public logs: resolved
configuration contains secrets. On Windows restrict the file to your own account;
POSIX chmod alone does not guarantee Windows ACL protection.

MongoDB has authentication, no published port and a private network. The API uses
the environment's database administrator credential for compatibility with the
isolated-test fixtures; this is not a least-privilege production database setup.
Database and all three upload categories persist in project-specific named volumes.

## Create your first local account

Use the app's create-account flow and the private `DAWAISATHI_BOOTSTRAP_TOKEN`
from **your** `.env.docker` for the first owner. Use a test email and a password
of at least 12 characters. Do not send this token to the team. Each developer
creates their own local owner; subsequent accounts need family invitations.
Never import personal medical records into team testing.

## Make changes

```sh
docker compose --env-file .env.docker up --watch
```

Compose Watch syncs frontend changes for Expo refresh, syncs/restarts backend
Python changes, and rebuilds when dependency manifests change. Container files
are not host bind mounts, so Linux node_modules never overwrite Windows files.
Stop Watch with Ctrl+C; the stack can be restarted with the first-run command.
Do not put secrets in source folders that are synced. Existing `.env` files and
upload/cache directories are excluded. Use Compose environment configuration.

## Verify before a pull request

```sh
docker compose --env-file .env.docker exec -T frontend sh -c 'node --test scripts/*.test.cjs && yarn tsc --noEmit'
docker compose --env-file .env.docker --profile test run --build --rm tests
python scripts/check-docker.py http://localhost:18081 --api-url http://localhost:18000
```

The selected backend suite uses uniquely named disposable `dawaisathi_test_*`
databases in **this stack**. Do not point it at personal/staging/production MongoDB.
The GitHub workflow repeats these checks but has not run until pushed to GitHub.

## Stop / inspect

```sh
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 80 api frontend
docker compose --env-file .env.docker down
```

`down` preserves records/uploads. **Do not add `-v`** unless you intentionally want
to erase this stack's database and uploaded files. Changing `MONGO_PASSWORD`
after the database volume is initialized does not rotate the database password.
Keep the environment file with the matching volume and perform explicit credential
rotation rather than deleting data to fix a connection error.

Dependencies: frontend uses frozen `yarn.lock`; backend direct runtime versions
are pinned separately in `backend/requirements-docker.txt`. Base images and
transitive Python dependencies can still change; promote tested image digests
for releases rather than claiming bit-for-bit reproducible source rebuilds.

See [staging and team handoff](STAGING.md) for tester distribution. Native camera,
voice and haptics require device testing; Docker web verification is not APK QA.
