#!/usr/bin/env bash
# Startup script for a NEW dedicated Debian 12 VM. Contains no app credentials.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
source /etc/os-release
if [[ "$ID" != debian || "$VERSION_ID" != 12 ]]; then
  echo 'Expected a dedicated Debian 12 staging VM.' >&2
  exit 1
fi
apt-get update
apt-get install -y ca-certificates curl python3
install -m 0755 -d /etc/apt/keyrings
curl --fail --silent --show-error --retry 5 https://download.docker.com/linux/debian/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian %s stable\n' \
  "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
install -m 0755 -d /etc/docker
# Preserve any operator-supplied Docker configuration on subsequent boots.
if [[ ! -f /etc/docker/daemon.json ]]; then
  printf '%s\n' '{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}' \
    > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker
install -m 0700 -d /opt/dawaisathi
docker compose version
touch /opt/dawaisathi/bootstrap-ready
