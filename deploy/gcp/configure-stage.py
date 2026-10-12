"""Initialize a NEW VM's private environment; never print or replace secrets."""
import argparse
from pathlib import Path
import subprocess
import sys
import re

parser = argparse.ArgumentParser()
parser.add_argument("hostname")
parser.add_argument("release")
args = parser.parse_args()
if not re.fullmatch(r"[a-z0-9][a-z0-9.-]+[a-z0-9]", args.hostname) or not re.fullmatch(r"[A-Za-z0-9._-]+", args.release):
    raise SystemExit("Expected a DNS hostname and a simple immutable release identifier.")
root = Path(__file__).resolve().parents[2]
target = root / ".env.staging"
if target.exists():
    raise SystemExit("Existing staging environment preserved; update it explicitly.")
subprocess.run([sys.executable, str(root / "scripts/init-docker.py"), "staging"], check=True)
settings = dict(line.split("=", 1) for line in target.read_text().splitlines() if line and not line.startswith("#"))
settings.update(
    APP_URL=f"https://{args.hostname}",
    STAGING_DOMAIN=args.hostname,
    STAGING_API_IMAGE=f"dawaisathi-staging-api:{args.release}",
    STAGING_WEB_IMAGE=f"dawaisathi-staging-web:{args.release}",
)
target.write_text("# Private staging credentials. Never commit.\n" + "".join(f"{key}={value}\n" for key, value in settings.items()))
target.chmod(0o600)
print("Configured private VM environment; secrets were not printed.")
