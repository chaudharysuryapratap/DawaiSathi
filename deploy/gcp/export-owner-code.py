"""Export only the one-time owner setup code to the authorized SSH user's home."""
import os
from pathlib import Path
import pwd

if os.geteuid() != 0 or not os.environ.get("SUDO_USER"):
    raise SystemExit("Run using sudo from the authorized IAP session.")
account = pwd.getpwnam(os.environ["SUDO_USER"])
settings = dict(line.split("=", 1) for line in Path("/opt/dawaisathi/.env.staging").read_text().splitlines() if line and not line.startswith("#"))
code = settings.get("DAWAISATHI_BOOTSTRAP_TOKEN")
if not code:
    raise SystemExit("Owner setup code is not active.")
target = Path(account.pw_dir) / "owner-setup-code.txt"
with target.open("x") as output:
    output.write(code + "\n")
target.chmod(0o600)
os.chown(target, account.pw_uid, account.pw_gid)
print("Created private owner-setup-code.txt; the code was not printed.")
