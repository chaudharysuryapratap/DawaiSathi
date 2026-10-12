"""Run through stdin INSIDE the isolated API container, before/after recreation."""
import asyncio
import os
from pathlib import Path
import sys

import server

assert Path("/.dockerenv").exists(), "Run inside the isolated Docker API container"
assert os.environ.get("DB_NAME") in {"dawaisathi_dev", "dawaisathi_staging"}
assert sys.argv[1] in {"prepare", "verify"}
marker = "docker-persistence-check-v1"
paths = [Path("/app/data") / category / ".docker-persistence-check" for category in ("medicine-images", "voice-notes", "prescriptions")]


async def main():
    collection = server.db.docker_verification
    if sys.argv[1] == "prepare":
        await collection.update_one({"_id": marker}, {"$set": {"value": marker}}, upsert=True)
        for path in paths:
            path.write_text(marker, encoding="utf-8")
        print("Prepared synthetic database and three upload-volume markers")
    else:
        assert (await collection.find_one({"_id": marker}))["value"] == marker
        for path in paths:
            assert path.read_text(encoding="utf-8") == marker
        await collection.delete_one({"_id": marker})
        for path in paths:
            path.unlink()
        print("PASS: database and all three upload categories survived container recreation; synthetic markers removed")
    server.client.close()


asyncio.run(main())
