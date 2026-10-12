"""Update an existing staging release without replacing its secrets or volumes."""
import pathlib
import re
import subprocess
import sys

release, google_client = sys.argv[1:]
if not re.fullmatch(r"[0-9]{8}-[0-9]{2}", release):
    raise SystemExit("Invalid release identifier")
root = pathlib.Path("/opt/dawaisathi")
env = root / ".env.staging"
backup = root / f".env.before-{release}"
if backup.exists():
    raise SystemExit("Release backup already exists; inspect before retrying")
original = env.read_text()
backup.write_text(original)
backup.chmod(0o600)
updates = {
    "STAGING_API_IMAGE": f"dawaisathi-api:{release}",
    "STAGING_WEB_IMAGE": f"dawaisathi-web:{release}",
    "GOOGLE_WEB_CLIENT_ID": google_client,
}
lines = original.splitlines()
for key, value in updates.items():
    lines = [line for line in lines if not line.startswith(key + "=")]
    lines.append(f"{key}={value}")
env.write_text("\n".join(lines) + "\n")
env.chmod(0o600)
command = ["docker", "compose", "--env-file", str(env), "-f", "compose.staging.yaml", "-f", "compose.staging-images.yaml", "-f", "compose.staging-public.yaml"]
try:
    subprocess.run(command + ["config", "--quiet"], cwd=root, check=True)
    subprocess.run(command + ["up", "-d", "--no-build", "--wait", "--wait-timeout", "600"], cwd=root, check=True)
except subprocess.CalledProcessError:
    env.write_text(original)
    subprocess.run(command + ["up", "-d", "--no-build", "--wait", "--wait-timeout", "600"], cwd=root, check=True)
    raise
