import asyncio

from httpx import ASGITransport, AsyncClient
from test_family_auth_isolated import isolated_auth_database  # noqa: F401

import server


def test_permanent_codes_and_no_approval_join(isolated_auth_database):
    loop, database = isolated_auth_database
    async def scenario():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            owner = await client.post("/api/auth/register", json={"name": "Owner", "email": "owner@example.com", "password": "synthetic-password", "bootstrap_token": "bootstrap-test-token"})
            assert owner.status_code == 200
            owner_headers = {"Authorization": f"Bearer {owner.json()['access_token']}"}
            families = []
            for name in ("Surya", "Pratap"):
                created = await client.post("/api/family-groups", headers=owner_headers, json={"name": name})
                assert created.status_code == 200
                families.append(created.json()["id"])
            async def read_code(group_id):
                response = await client.get(f"/api/family-groups/{group_id}/join-code", headers=owner_headers)
                assert response.status_code == 200
                return response.json()["code"]
            codes = [await read_code(group_id) for group_id in families]
            assert codes[0] != codes[1]
            assert len(codes[0]) == 16
            repeated = await asyncio.gather(*(read_code(families[0]) for _ in range(5)))
            assert repeated == [codes[0]] * 5
            renamed = await client.patch(f"/api/family-groups/{families[0]}", headers=owner_headers, json={"name": "Renamed"})
            assert renamed.status_code == 200
            assert await read_code(families[0]) == codes[0]
            # Existing plaintext code never changes across a new index/startup pass.
            await database.family_groups.create_index("join_code", unique=True, sparse=True, name="uniq_family_join_code")
            assert await read_code(families[0]) == codes[0]
            assert (await client.post("/api/family-code/accept", json={"code": codes[0]})).status_code == 401

            # New account can register with a permanent code, without an email-specific invite.
            guest = await client.post("/api/auth/register", json={"name": "Guest", "email": "guest@example.com", "password": "synthetic-password", "invitation_token": "-".join(codes[0][i:i+4] for i in range(0, 16, 4)).lower()})
            assert guest.status_code == 200, guest.text
            guest_headers = {"Authorization": f"Bearer {guest.json()['access_token']}"}
            assert (await client.get(f"/api/family-groups/{families[0]}/join-code", headers=guest_headers)).status_code == 403
            assert (await client.get(f"/api/family-groups/{families[1]}/members", headers=guest_headers)).status_code == 403
            joined = await client.post("/api/family-code/accept", headers=guest_headers, json={"code": codes[1]})
            assert joined.status_code == 200
            # No approval queue, and immediate read access to the joined family.
            assert (await client.get(f"/api/family-groups/{families[1]}/members", headers=guest_headers)).status_code == 200
            assert (await client.post("/api/family-code/accept", headers=guest_headers, json={"code": codes[1]})).status_code == 200
            membership = await database.family_groups.find_one({"id": families[1]})
            assert membership["user_ids"].count(guest.json()["user"]["id"]) == 1
            # Deleted families no longer accept their old code.
            await database.family_groups.delete_one({"id": families[1]})
            assert (await client.post("/api/family-code/accept", headers=guest_headers, json={"code": codes[1]})).status_code == 404
            responses = [await client.post("/api/family-code/accept", headers=guest_headers, json={"code": "0123456789ABCDEF"}) for _ in range(14)]
            assert responses[-1].status_code == 429
            assert await read_code(families[0]) == codes[0]
    loop.run_until_complete(scenario())
