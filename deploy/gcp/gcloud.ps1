# Official CLI only; account credentials and SSH keys stay in dedicated volumes.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$cliImage = 'gcr.io/google.com/cloudsdktool/google-cloud-cli@sha256:cde9dbd556000c21c08449d8e5828904ef91e690bec95207f71fa6a6685922c9'
docker run --rm -v dawaisathi-gcloud-config:/root/.config/gcloud -v dawaisathi-gcloud-ssh:/root/.ssh -v "${repoRoot}:/workspace:ro" $cliImage gcloud @args
exit $LASTEXITCODE
