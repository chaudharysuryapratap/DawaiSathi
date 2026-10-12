# Docker verification — 10 October 2026

Verified locally on Windows Docker Desktop with Linux containers, Docker Engine
29.8.1 and Compose v5.5.1. Clean images installed dependencies without using the
host venv/node_modules. Existing `dawaisathi-mongo` and host ports 8000/8081 were
not replaced, stopped or imported into the new environments.

| Check | Observed result |
| --- | --- |
| Developer Compose configuration | Valid; independent project, secrets and named volumes |
| Staging and HTTPS override configuration | Valid with placeholder hostname/contact; no certificate requested |
| Backend clean install | Passed; `pip check` found no broken requirements |
| Frontend frozen-lockfile clean install | Passed; existing dependency/peer warnings remain |
| Developer services | Mongo, API, frontend healthy; web at localhost:18081, API at localhost:18000 |
| Local staging services | Mongo, API, Nginx healthy; exported web at localhost:18088 |
| Frontend regression in container | 105 passed, 0 failed |
| Container TypeScript check | Passed |
| Selected backend regression in container | 13 passed; existing multipart/lifespan deprecation warnings remain |
| HTTP checks, both stacks | Home and Profile/Checkups deep links return HTML; database readiness succeeds; protected family API returns 401 without a token |
| Browser staging boot | Welcome and email sign-in screen render; no browser error logs observed in this entry flow |
| Browser API connection | Synthetic invalid credentials return “Email or password is incorrect”, not a network error; no account created |
| Staging security headers | `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` verified after correction |
| Persistence, both stacks | Synthetic DB record plus markers in medicine-images, voice-notes and prescriptions survived Mongo/API container recreation; markers then removed |
| Secrets and ports | Generated env files ignored by Git; separate JWT secrets; new MongoDB ports not published; staging API not published |
| GCP prebuilt release override | Compose validation passed with local image tags and placeholder hostname; no build sections or private service ports; only edge 80/443 published |
| GCP Debian startup script | `bash -n` passed; executed successfully on the new Debian 12 VM |

These initial local checks were followed by the approved GCP deployment and
external checks recorded below. Local validation alone was not treated as proof
of public deployment.

Commands used:

```sh
python scripts/init-docker.py dev
python scripts/init-docker.py staging
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.staging -f compose.staging.yaml config --quiet
docker compose --env-file .env.docker up -d --build --wait --wait-timeout 600
docker compose --env-file .env.staging -f compose.staging.yaml up -d --build --wait --wait-timeout 600
docker run --rm --network none dawaisathi-dev-frontend sh -c 'node --test scripts/*.test.cjs && yarn tsc --noEmit'
docker compose --env-file .env.docker --profile test run --build --rm tests
python scripts/check-docker.py http://localhost:18081 --api-url http://localhost:18000
python scripts/check-docker.py http://localhost:18088
```

PowerShell persistence rehearsal for development (same sequence also ran with the
staging env/Compose file):

```powershell
Get-Content scripts/check-persistence.py -Raw | docker compose --env-file .env.docker exec -T api python - prepare
docker compose --env-file .env.docker up -d --force-recreate --wait --wait-timeout 120 mongo api
Get-Content scripts/check-persistence.py -Raw | docker compose --env-file .env.docker exec -T api python - verify
```

The persistence script refuses host execution and database names other than the
two new isolated environments. It writes/removes only its synthetic verification
markers, not medical records. Persistence checks are not backup/restore tests.

## Problems encountered

- The initial backend image build hit a PyPI download read timeout. The Dockerfile
  now uses a longer timeout/retries and a build-cache mount; the retry completed.
- A host readiness-test invocation from the repository root could not resolve
  `server`; rerunning from `backend` passed. Container tests run from `/app`.
- Security-header checking caught Nginx's child `add_header` inheritance behavior;
  cache policy was moved to a server-level map so security headers are retained.

## Not yet verified or delivered

- Authenticated public tester flows and independent mobile-network access.
- Android APK generation/installation, iOS, native permissions/haptics/audio/camera.
- Full authenticated browser CRUD tour or external Google/messaging delivery.
- Compose Watch live-edit behavior, teammate-machine fresh clone, CI execution on
  GitHub, backup restore, vulnerability audit, load testing or production hardening.
- GitHub collaborator access: usernames/permissions have not been supplied.

## GCP deployment verified, 10 October 2026

- Approved separate project `dawaisathi-staging`, Mumbai `e2-medium`, retained
  50 GB balanced disk, static IP `34.100.169.52`, custom VPC/subnet, Shielded VM.
- Verified public TCP 80/443 only; SSH restricted to IAP `35.235.240.0/20`;
  no VM service account; no MongoDB/API/Metro ports published.
- Official Google CLI authenticated with explicit consent; credentials and SSH
  keys stay in dedicated local Docker volumes, not the VM/repository.
- Built API/web release `20261010-01` locally; transferred and checked SHA256s
  over IAP. No local records/media/environment files copied. Fresh VM secrets.
- VM Docker 29.9.0, Compose 5.6.0; API, web and MongoDB healthy, Caddy serving TLS.
- `python scripts/check-docker.py https://dawaisathi-staging-34-100-169-52.sslip.io`
  passed both from the VM and Windows host. HTTP returns 308 to HTTPS.
- Chrome loaded live registration screen using valid TLS; no certificate bypass.
- Initial check ran before Caddy finished certificate issuance and failed;
  subsequent checks passed. One CLI image omitted SSH; switched to Google's
  official SSH-ready `slim` image, pinned by digest. No TLS checks were disabled.
- Project-only INR 4,000 monthly gross budget excludes credits, with actual
  50/80/100% and forecast 100% alerts. This is not a spending cap.

Paid staging infrastructure now exists. The owner deferred the APK; no EAS build
or Expo source upload has been started. Owner
registration and authenticated QA remain a human handoff; bootstrap finalization
is prepared but has not run. Backups/restore remain unconfigured/unverified.
Setup changes remain local, not committed/pushed. Existing README/screenshots
were preserved. See [GCP release record](../deploy/gcp/README.md).
