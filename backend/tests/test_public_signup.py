from httpx import ASGITransport, AsyncClient
import server
from test_family_auth_isolated import isolated_auth_database


def test_independent_signup_and_first_family_are_private(isolated_auth_database):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as client:
            accounts = []
            for i in range(2):
                result = await client.post("/api/auth/register", json={"name": f"Person {i}", "email": f"person{i}@example.com", "password": "strong-test-password-123"})
                assert result.status_code == 200, result.text
                account = result.json()
                assert account["user"]["is_owner"] is False
                headers = {"Authorization": "Bearer " + account["access_token"]}
                assert (await client.get("/api/family-groups", headers=headers)).json() == []
                family = await client.post("/api/family-groups", headers=headers, json={"name": f"Private {i}"})
                assert family.status_code == 200, family.text
                own = family.json()
                assert own["member_count"] == 1
                primary = await database.members.find_one({"user_id": account["user"]["id"]})
                assert primary["family_group_ids"] == [own["id"]]
                accounts.append((headers, own["id"], primary["id"]))
            # Repeated migration/load calls must not leak new profiles into legacy groups.
            await server.ensure_family_groups()
            for headers, family_id, member_id in accounts:
                groups = (await client.get("/api/family-groups", headers=headers)).json()
                assert [g["id"] for g in groups] == [family_id]
                member = await database.members.find_one({"id": member_id})
                assert member["family_group_ids"] == [family_id]
                family = await database.family_groups.find_one({"id": family_id})
                assert family["member_ids"] == [member_id]
            legacy = await database.family_groups.find_one({"name": "My Family"})
            assert not legacy.get("user_ids")
    loop.run_until_complete(exercise())
