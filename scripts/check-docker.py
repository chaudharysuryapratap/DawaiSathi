"""Read-only HTTP smoke checks; never registers accounts or changes care records."""
import argparse
import json
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("base_url", help="Browser origin, e.g. http://localhost:18088")
parser.add_argument("--api-url", help="Separate developer API origin, e.g. http://localhost:18000")
args = parser.parse_args()
web = args.base_url.rstrip("/")
api = (args.api_url or web).rstrip("/")


def get(url, expected=200):
    try:
        response = urllib.request.urlopen(url, timeout=60)
    except urllib.error.HTTPError as error:
        response = error
    assert response.status == expected, f"{url}: expected {expected}, got {response.status}"
    return response.read()


assert b"<html" in get(web).lower(), "Home did not return HTML"
assert b"<html" in get(web + "/settings/profile").lower(), "Deep link failed"
assert b"<html" in get(web + "/care/checkups").lower(), "Care deep link failed"
assert json.loads(get(api + ("/ready" if args.api_url else "/health")))["status"] == "ok"
get(api + "/api/family-groups", expected=401)
if not args.api_url:
    with urllib.request.urlopen(web, timeout=60) as response:
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
print("PASS: home, Profile/Checkups deep links, database readiness, protected API rejects anonymous access")
