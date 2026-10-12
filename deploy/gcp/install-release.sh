#!/usr/bin/env bash
# First deployment only. No credentials are present in this file or arguments.
set -euo pipefail
[[ $EUID == 0 && -n ${SUDO_USER:-} ]] || { echo 'Run using sudo over IAP SSH.' >&2; exit 1; }
[[ $# == 4 ]] || { echo 'Expected release, image SHA256, config SHA256, hostname.' >&2; exit 1; }
release=$1
[[ $release =~ ^[A-Za-z0-9._-]+$ ]] || exit 1
[[ $2 =~ ^[A-Fa-f0-9]{64}$ && $3 =~ ^[A-Fa-f0-9]{64}$ ]] || exit 1
transfer_dir=$(getent passwd "$SUDO_USER" | cut -d: -f6)
[[ -d $transfer_dir && -f /opt/dawaisathi/bootstrap-ready ]] || exit 1
[[ ! -e /opt/dawaisathi/.env.staging ]] || { echo 'Existing staging environment preserved.' >&2; exit 1; }
cd "$transfer_dir"
printf '%s  %s\n' "$2" "images-$release.tar" "$3" "config-$release.tar.gz" | sha256sum --check
docker image load --input "images-$release.tar"
tar -xzf "config-$release.tar.gz" -C /opt/dawaisathi
cd /opt/dawaisathi
python3 deploy/gcp/configure-stage.py "$4" "$release"
stack=(docker compose --env-file .env.staging -f compose.staging.yaml -f compose.staging-images.yaml -f compose.staging-public.yaml)
"${stack[@]}" config --format json | python3 -c '
import json,sys
c=json.load(sys.stdin); s=c["services"]
assert all(not s[n].get("ports") for n in ("mongo","api","web"))
assert all(not s[n].get("build") for n in ("api","web"))
assert {p["published"] for p in s["edge"]["ports"]} == {"80","443"}
print("PASS: only edge ports 80/443 published; no server-side app build")
'
"${stack[@]}" up -d --no-build --wait --wait-timeout 600
"${stack[@]}" ps
python3 scripts/check-docker.py "https://$4"
