"""Generate environment-specific Docker secrets without touching existing files."""
import argparse
from pathlib import Path
import secrets

parser = argparse.ArgumentParser()
parser.add_argument("environment", choices=["dev", "staging"])
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / (".env.docker" if args.environment == "dev" else ".env.staging")
settings = {
    "MONGO_PASSWORD": secrets.token_hex(32),
    "DAWAISATHI_AUTH_SECRET": secrets.token_hex(48),
    "DAWAISATHI_BOOTSTRAP_TOKEN": secrets.token_hex(32),
}
if args.environment == "staging":
    settings.update(APP_URL="http://localhost:18088", STAGING_DOMAIN="", GOOGLE_WEB_CLIENT_ID="")
try:
    with target.open("x", encoding="utf-8", newline="\n") as output:
        output.write("# Private generated secrets. Never commit or share this file.\n")
        output.writelines(f"{key}={value}\n" for key, value in settings.items())
    target.chmod(0o600)
except FileExistsError:
    raise SystemExit(f"{target.name} already exists; it was NOT changed.")
print(f"Created {target.name}. Secrets are not printed. Keep this file private.")
