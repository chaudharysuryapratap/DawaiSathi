# Separate staging and team handoff

## Current boundary

The user selected Google Cloud using existing credits. A dedicated
`dawaisathi-staging` project now hosts **https://dawaisathi-staging-34-100-169-52.sslip.io**.
Google CLI access, temporary third-party DNS and public web exposure were approved.
Verified valid TLS, HTTP redirect, landing page, Profile/Checkups deep links,
database readiness and rejection of anonymous record access from outside the VM.
See the [GCP deployment record](../deploy/gcp/README.md) for exact resources/costs.

The owner must create the first staging account using the privately supplied setup
code, then invalidate that code. Authenticated browser workflows, mobile-network
access, backup restore, GitHub invitations and Android APK are still pending.
Existing local credentials/data were not copied. Use only synthetic test data.

## Earlier hosting comparison (checked 10 October 2026)

Google Cloud is now the selected provider because the owner has available
credits. The following comparison is retained as context, not a second hosting
purchase. The GCP record above is the current deployment plan.

For a small internal team, use one dedicated Linux VM with Docker Compose,
not the developer's laptop. A reasonable starting point is a **DigitalOcean Basic
4 GiB / 2 vCPU VM: US$24/month**, excluding tax, domain and backups. The 2 GiB /
1 vCPU option is US$12/month, but is tight for bundling Expo plus running MongoDB;
build images elsewhere if choosing that smaller option. These are sizing judgments,
not load-test results. [Official pricing](https://www.digitalocean.com/pricing/droplets).

Tradeoff: this is inexpensive and fits the Docker stack, but someone must maintain
OS patches, firewall, disk space and backups. It is single-host staging, not
high-availability production. Prefer managed app hosting plus managed MongoDB
if the team cannot operate a server; [Render pricing](https://render.com/pricing)
is an alternative to assess with database/upload-storage costs included. Do not
choose a sleeping/free web service and describe it as dependable always-on testing.

Before provisioning, confirm provider/account, region, monthly budget, hostname,
domain ownership and who will maintain it. Use only synthetic test records.

## Local staging rehearsal

```sh
python scripts/init-docker.py staging
docker compose --env-file .env.staging -f compose.staging.yaml up -d --build --wait --wait-timeout 600
python scripts/check-docker.py http://localhost:18088
```

Open http://localhost:18088. This serves an exported web bundle, **not Metro**.
Nginx serves SPA deep links and proxies `/api` to the private backend. Web API
configuration uses a relative same-origin URL, so testers never call their own
localhost. MongoDB, secrets and upload volumes are separate from development and
from the existing host app. No real data is copied. Use a separate browser profile
when testing environments to avoid account confusion.

## Public deployment after approval

1. Create the approved Linux VM, install Docker/Compose, restrict SSH to admins,
   and expose only TCP 80/443 to testers. Never expose 27017, 8000 or Metro.
2. For this GCP deployment, use the prebuilt image/checksum/IAP transfer procedure
   in `deploy/gcp/README.md`; no GitHub credential or build toolchain is needed on
   the app VM. Generate `.env.staging` **on that server**. The commands below are
   a generic source-build alternative, not the actual GCP release procedure.
3. Point the approved hostname's DNS A record at the server. Add AAAA only if IPv6
   is configured. Set these values privately in `.env.staging`:

```dotenv
APP_URL=https://staging.your-owned-domain.example
STAGING_DOMAIN=staging.your-owned-domain.example
```

These are owned-domain placeholders; the current temporary live URL is above.
No personal certificate-contact email is configured. Configure Google OAuth client
and authorized origins only if enabling Google sign-in; email/password works
without it. Client IDs are public; signing/database/bootstrap secrets are not.

4. Start the reviewed release:

```sh
docker compose --env-file .env.staging -f compose.staging.yaml -f compose.staging-public.yaml config --quiet
docker compose --env-file .env.staging -f compose.staging.yaml -f compose.staging-public.yaml up -d --build --wait --wait-timeout 600
python scripts/check-docker.py https://staging.your-owned-domain.example
```

Caddy terminates HTTPS; its certificate state persists in named volumes. DNS
and public 80/443 reachability are prerequisites for automatic TLS. The public
override removes the loopback web port. [Caddy HTTPS requirements](https://caddyserver.com/docs/automatic-https).
Do not publish any link until an external device verifies HTTPS, login, Today,
Care, History, Settings, media upload/readback and reload/deep links.

5. The owner completes first registration using the server bootstrap token.
   Remove that token from `.env.staging` afterwards and recreate `api` with
   `--force-recreate --no-deps api` using the same Compose files. Do not regenerate
   JWT/Mongo secrets. Provide testers separate invited accounts in test families;
   never share the owner's password or bootstrap token.
6. Back up both the database and `media-data` volume using an encrypted,
   access-controlled backup destination and perform a restore rehearsal before
   relying on retained data. A named volume is persistence, **not a backup**.
   Stop writes for a consistent database/media snapshot. No backup service is
   configured by this change. Monitor health, disk space and container logs.

Application login protects records, not the landing page. For a restricted pilot,
consider a VPN/access gateway compatible with both web and Android. Do not place
browser-only access middleware in front of the API without checking APK access.
No production-readiness or medical-notification delivery claim is made.

## Update / rollback

Review PRs, record the deployed commit and image IDs/digests, back up data, then
run the same build/up/check sequence. Do not deploy arbitrary unreviewed branches.
Retain previous images for rollback and restore the reviewed version with the
same volumes. Application rollback does not undo incompatible data migrations;
assess schema changes and restore requirements first. Never use `down -v` for updates.

## Android tester APK (deferred by the owner)

The owner explicitly chose to defer the APK. No source was uploaded to Expo and
no build was started. The following configuration/instructions are for later.

`frontend/eas.json` includes an internal-distribution `staging` profile producing
an APK. `APP_VARIANT=staging` gives it a separate name/package so it can coexist
with the existing app. The configuration rejects missing/non-HTTPS staging API
origins during that build. Public values are compiled into the APK, so rebuild
after changing the hostname.

After the HTTPS backend is live and the Expo account/project is approved:

1. Use EAS CLI on the developer host (not the web-serving container). Sign in to
   the team's Expo account, select/create its **staging** project and configure
   Android signing credentials. Do not reuse unreviewed production credentials.
2. Set preview-environment `EXPO_PUBLIC_BACKEND_URL` and
   `EXPO_PUBLIC_APP_URL` to the same public HTTPS staging origin, without `/api`.
   Configure Google client IDs only if needed. Never place backend secrets in EAS
   public variables. Check the selected project/account before submitting a build.
3. From `frontend`, run `eas build --platform android --profile staging`.
   This may consume build quota/credits; obtain approval before starting it.
4. Install the generated APK on a real Android device. Verify login, account
   invitation, camera, audio, haptics, font scaling, media and API behavior on
   mobile data as well as Wi-Fi. Then share its internal download link privately.

Expo internal-build download URLs are accessible to anyone holding the URL by
default. Disable unauthenticated internal-build access in the Expo project if
the pilot requires authorized Expo accounts; merely calling a link "internal"
does not make it access-controlled. App accounts remain separate from build access.

An APK profile is **not** an APK. No Android build or physical-device QA is claimed
until the build completes and installation is tested.
[Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

## Team access

- Developers: invite the supplied GitHub usernames with Write access (not Admin
  by default), use feature branches and PR review. Usernames are still needed;
  no access has been granted. Branch protection depends on GitHub plan/settings
  and has not been enabled by this change.
- Testers: receive the verified staging URL and/or APK link plus their own app
  invitation. They do not need source-repository access or infrastructure secrets.
- Bug reports: include app/build version, device/OS, steps, expected/actual result
  and sanitized screenshot. Never attach passwords, invite codes or real health data.

## Verification record

See [Docker verification](DOCKER_VERIFICATION.md) for actual commands/results and
the distinction between local rehearsal, public staging and native testing.
