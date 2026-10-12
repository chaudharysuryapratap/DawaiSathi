# Google Cloud staging

## Current release, 12 October 2026

Release `20261012-01` is live at **https://dawaisathi-staging-34-100-169-52.sslip.io**.
Application source: `a007d3519b99ac80f1d3bcc730bc9dee6cdd96db`, published on
`chaudharysuryapratap-android-securestore-startup-error` in GitHub.

- Public email signup, family onboarding sheets with the two-minute no-family
  reminder, direct Google entry on Welcome, bounded Google token clock tolerance,
  and family name formatting are included.
- Existing-account Google linking still requires the one-time existing password.
  The Google web client is configured; interactive staging Google login has not
  been verified in this release.
- Existing staging database, media and secrets were retained. The previous image
  references are preserved in root-only `/opt/dawaisathi/.env.before-20261012-01`.
- Both Linux amd64 images built successfully; six isolated backend tests,
  TypeScript checks and three setup reminder tests passed.
- All four remote containers are healthy. Public HTTPS home, Profile/Checkups
  deep links, database readiness, anonymous API rejection and the exact new web
  bundle were verified after deployment. Authenticated browser flows were not
  rerun.
- API image config: `sha256:839c9f385e3e11e53215f72099c5fe6833a54076836e719f095abb1352876d7c`.
- Web image config: `sha256:d3f4259e3c0b74af670dbf214ce80c797aeda3ba892218320ed660cca6e177d0`.
- Transferred archive SHA256: `e2dd879289387238c7b67a81305740ea98dab63c3ba52226c2b31117e40dd816`.

For updates, `update-release.py` preserves the environment before changing image
references and restores the previous release automatically if Compose fails.
The initial installation record below is historical.

## Initial deployment state, 10 October 2026

- Created project: `dawaisathi-staging`, display name **DawaiSathi Staging**.
- The billing verification warning is no longer shown after the owner verified.
- The inspected billing account had INR 14,398.32 available credit, ending
  4 January 2027. It is a **paid** account, not a charge-proof trial. Monitor the
  live balance, usage and expiry; this observed credit balance is not a cost cap.
- Public staging: **https://dawaisathi-staging-34-100-169-52.sslip.io**.
- Created `dawaisathi-staging-vm` in `asia-south1-a`: on-demand `e2-medium`,
  Debian 12, 50 GB balanced boot disk with `autoDelete=false`, static IP
  `34.100.169.52`, Shielded VM secure boot/vTPM/integrity enabled, no service account.
- Custom VPC `dawaisathi-staging-vpc`, subnet `10.86.0.0/24`; only public TCP
  80/443 and IAP-source SSH 22 are allowed. MongoDB/API/web have no published ports.
- Owner approved temporary third-party sslip.io DNS and public web access.
  DNS, valid TLS, HTTPS redirect, deep links, database readiness and anonymous
  rejection verified from the VM and developer computer. Browser displays registration.
  No owned domain or independent mobile-network check is claimed.
- The owner must complete first registration; authenticated care flows, backup
  restore, Android APK and GitHub invitations are **not yet verified/completed**.
- The owner explicitly deferred the Android APK. No Expo source upload, signing
  setup or build was started; keep the prepared configuration for later.
- Google Cloud CLI authentication was explicitly approved and completed: its normal
  OAuth flow requests broad account-level Cloud Platform, Compute, App Engine,
  SQL and reauthentication access, with offline credentials. Do not bypass this
  decision by using another login flow. Credentials stay in the dedicated local
  Docker volume, SSH keys in `dawaisathi-gcloud-ssh`; neither is on the app VM.
  Official SSH-ready CLI digest: `sha256:cde9dbd556000c21c08449d8e5828904ef91e690bec95207f71fa6a6685922c9`.
  No service-account keys were created.

## Checked cost and safeguards

Use an on-demand `e2-medium` in Mumbai (`asia-south1-a`), Debian 12, a 50 GB
balanced persistent boot disk, and one static external IPv4. E2 medium has 4 GiB
RAM and shared CPU; build API/web images locally, not on this VM. The console
estimated USD 29.38/month compute and USD 1.20 per 10 GB balanced disk in Mumbai.
For 50 GB, plus approximately USD 3.65/month IPv4, the base estimate is USD 39.03/month
at 730 hours, before traffic, snapshots, taxes and currency conversion. This is
an estimate, not a cap. No GPU, GKE,
load balancer, NAT gateway or committed-use purchase is needed.

Use a dedicated custom VPC/subnet, not the unrelated default project's network:

- Public TCP 80/443 only for the reverse proxy, restricted by the VM's staging tag.
- SSH TCP 22 only from Google's IAP range `35.235.240.0/20`, with OS Login.
- No public MongoDB, API, Metro or Docker socket.
- No attached VM service account or Cloud API scopes are required by the app.
- Enable Shielded VM secure boot, vTPM and integrity monitoring.
- Retain the boot/data disk on VM deletion and label resources for staging.

Public access and the temporary hostname were approved. A separate project does
not mean a separate billing account. Created monthly INR 4,000 budget
`1d1a5df0-0a20-44f8-afed-010d139bb73b`, filtered to project `833715154627`, excluding
all credits. Actual-spend alerts: 50%, 80%, 100%; forecast alert: 100%; default
billing IAM recipients retained. Alerts do not stop charges. Credit expiry:
4 January 2027. Disks/IP remain chargeable when the VM is stopped.

## Deployed release 20261010-01

Source base: `dbeb8c34c1703b782e5615fabd5da127e7bde0c3` **plus uncommitted local Docker,
readiness and staging configuration changes**. This is not a published GitHub release.

- API image ID: `sha256:4b62f3ae2c8ce7aeabf218c69c690212e4595ac69c54147553a26c3bf5f4cd68`
- Web image ID: `sha256:7959ea3194828c1a81bba5a03667c4ebf98224e7291579511823e24dd1a707a1`
- Transferred image archive SHA256: `b4ee250feffc04d5ffeb7ae5367705a42e8e27b5df8786cc0ab9a2b4723bca43`
- Installed config archive SHA256: `c6ef896d14573b754ea75646d07ab3bc888d12d451b2f0337afa3f5270780052`
- Server directory `/opt/dawaisathi` and environment file are root-only.
- No local database, media, dotenv file or cloud credentials were transferred.
- Certificates use no personal contact email. The first smoke attempt ran before
  certificate issuance completed; subsequent verified TLS checks passed without bypasses.

`gcloud.ps1` wraps the official image with dedicated credential/SSH volumes and a
read-only repository mount. `install-release.sh` validates archive hashes, refuses
to overwrite an existing staging environment, and asserts port/build isolation.
Owner setup is a human credential-entry step. After owner registration, run the
reviewed `finalize-owner.py` on the server: it checks for exactly one owner, clears
only the bootstrap token, recreates the API and repeats smoke checks.

## Release path

1. Authenticate Google's official CLI image, keeping its credentials in the
   dedicated local `dawaisathi-gcloud-config` Docker volume, not Git or the app VM.
   Pin the image digest used for the deployment. No credentials are present in
   the runtime app images.
2. Confirm the target project, billing link, exact regional cost and approved
   public/SSH firewall scope. Provision only the approved resources. Supply
   `deploy/gcp/bootstrap.sh` as the new Debian VM's startup script.
3. Build the Linux amd64 API and web release locally, using the final HTTPS
   `EXPO_PUBLIC_APP_URL`, and tag both with an immutable release identifier.
   Record source revision, dirty diff, image IDs and checksums. Do not represent
   uncommitted local code as a published GitHub release.
4. Transfer the two Docker images and the Compose/deploy/init/check files using
   IAP SSH/SCP. Do not transfer local `.env*`, databases, uploads, credentials,
   Git history, dependency caches or screenshots. Load images on the server.
5. Generate a **new** `.env.staging` on that VM using `scripts/init-docker.py`.
   Privately set the HTTPS `APP_URL`, `STAGING_DOMAIN`,
   `STAGING_API_IMAGE` and `STAGING_WEB_IMAGE`. No certificate-contact email is sent.
   No local secrets
   should be reused. Make the deployment directory and environment file private.
6. Point the approved DNS hostname at the static IP and start without building:

```sh
sudo docker compose --env-file .env.staging \
  -f compose.staging.yaml -f compose.staging-images.yaml \
  -f compose.staging-public.yaml config --quiet
sudo docker compose --env-file .env.staging \
  -f compose.staging.yaml -f compose.staging-images.yaml \
  -f compose.staging-public.yaml up -d --no-build --wait --wait-timeout 600
python3 scripts/check-docker.py https://YOUR_APPROVED_HOSTNAME
```

7. Confirm the effective configuration has no build sections, no Mongo/API ports
   and only 80/443 published. Verify public TLS, redirect, entry, deep links and
   unauthenticated rejection from outside the VM, then authenticated disposable
   test flows. A container's healthy flag alone is not end-to-end verification.
8. The owner performs first registration privately. Clear the server bootstrap
   token after that succeeds and recreate **only** the API with the same release
   configuration. Empty bootstrap tokens fail closed for a fresh database.
9. Back up database plus media, rehearse restore and verify a real Android APK
   before describing either as completed. Keep this environment synthetic-only.

See [the staging handoff guide](../../docs/STAGING.md) for account invitations,
APK configuration, rollback and backups. Expo cloud build quota/billing is
separate from Google Cloud credits. No EAS build is started by these files.

References: [Google CLI container](https://docs.cloud.google.com/sdk/docs/downloads-docker),
[OS Login](https://docs.cloud.google.com/compute/docs/oslogin/set-up-oslogin),
[IAP TCP forwarding](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding),
[Docker Debian install](https://docs.docker.com/engine/install/debian/).
