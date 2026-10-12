"""After human registration, invalidate the bootstrap code without rotating secrets."""
import os
from pathlib import Path
import subprocess

root = Path("/opt/dawaisathi")
if os.geteuid() != 0:
    raise SystemExit("Run using sudo on the staging VM.")
stack = ["docker", "compose", "--env-file", ".env.staging", "-f", "compose.staging.yaml", "-f", "compose.staging-images.yaml", "-f", "compose.staging-public.yaml"]
check = """import asyncio, server
async def main():
    print(await server.db.users.count_documents({'is_owner': True}))
asyncio.run(main())
"""
result = subprocess.run(stack + ["exec", "-T", "api", "python", "-c", check], cwd=root, check=True, capture_output=True, text=True)
if result.stdout.strip() != "1":
    raise SystemExit("Expected exactly one registered owner; bootstrap code was NOT changed.")
target = root / ".env.staging"
lines = target.read_text().splitlines()
settings = dict(line.split("=", 1) for line in lines if line and not line.startswith("#"))
origin = settings.get("APP_URL", "")
if not origin.startswith("https://"):
    raise SystemExit("Expected the approved HTTPS origin; environment preserved.")
if not any(line.startswith("DAWAISATHI_BOOTSTRAP_TOKEN=") for line in lines):
    raise SystemExit("Bootstrap setting absent; environment preserved.")
target.write_text("\n".join("DAWAISATHI_BOOTSTRAP_TOKEN=" if line.startswith("DAWAISATHI_BOOTSTRAP_TOKEN=") else line for line in lines) + "\n")
target.chmod(0o600)
subprocess.run(stack + ["up", "-d", "--no-build", "--no-deps", "--force-recreate", "--wait", "api"], cwd=root, check=True)
subprocess.run(["python3", "scripts/check-docker.py", origin], cwd=root, check=True)
print("Owner verified; setup code disabled; API healthy. Other secrets preserved.")
