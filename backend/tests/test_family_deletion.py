from datetime import timedelta

from httpx import ASGITransport, AsyncClient

import server
from test_family_auth_isolated import isolated_auth_database  # noqa: F401


async def setup_family(client):
    owner = await client.post("/api/auth/register", json={
        "name": "Owner", "email": "owner@example.com", "password": "synthetic-password-123",
        "bootstrap_token": "bootstrap-test-token",
    })
    assert owner.status_code == 200, owner.text
    headers = {"Authorization": f"Bearer {owner.json()['access_token']}"}
    group = (await client.get("/api/family-groups", headers=headers)).json()[0]
    code = (await client.get(f"/api/family-groups/{group['id']}/join-code", headers=headers)).json()["code"]
    guest = await client.post("/api/auth/register", json={
        "name": "Guest", "email": "guest@example.com", "password": "synthetic-password-456", "invitation_token": code,
    })
    assert guest.status_code == 200, guest.text
    guest_headers = {"Authorization": f"Bearer {guest.json()['access_token']}"}
    return headers, guest_headers, group, code


def test_family_delete_blocks_access_and_joins_and_restore_preserves_records(isolated_auth_database):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            owner, guest, group, code = await setup_family(client)
            gid = group["id"]
            other = (await client.post("/api/family-groups", headers=owner, json={"name": "Keep me"})).json()
            invite = (await client.post(f"/api/family-groups/{gid}/invites", headers=owner, json={"email": "guest@example.com"})).json()
            medicine = await client.post("/api/medicines", headers=owner, json={
                "name": "Synthetic medicine", "dosage": "1 tablet", "times": ["08:00"], "family_group_id": gid,
            })
            assert medicine.status_code == 200, medicine.text
            mid = medicine.json()["id"]
            before = await database.medicines.find_one({"id": mid})
            accounts_before = await database.users.count_documents({})
            assert (await client.delete(f"/api/family-groups/{gid}", headers=guest)).status_code == 403
            assert (await client.delete(f"/api/family-groups/{gid}")).status_code == 401
            deleted = await client.delete(f"/api/family-groups/{gid}", headers=owner)
            assert deleted.status_code == 200, deleted.text
            assert "recover_until" in deleted.json()
            for headers in (owner, guest):
                ids = [g["id"] for g in (await client.get("/api/family-groups", headers=headers)).json()]
                assert gid not in ids
                for route in ("members", "medicines", "today", "checkups"):
                    assert (await client.get(f"/api/{route}?family_group_id={gid}", headers=headers)).status_code == 403
                assert (await client.patch(f"/api/medicines/{mid}", headers=headers, json={"name": "Blocked"})).status_code == 403
                assert (await client.get(f"/api/family-groups/{gid}/join-code", headers=headers)).status_code == 403
                assert (await client.post("/api/family-code/accept", headers=headers, json={"code": code})).status_code == 404
            assert (await client.post("/api/family-invitations/accept", headers=guest, json={"token": invite["token"]})).status_code == 404
            blocked_registration = await client.post("/api/auth/register", json={
                "name": "New", "email": "new@example.com", "password": "synthetic-password-789", "invitation_token": code,
            })
            assert blocked_registration.status_code == 404
            assert await database.users.count_documents({}) == accounts_before
            assert await database.medicines.find_one({"id": mid}) == before
            assert (await client.get("/api/family-groups/deleted", headers=guest)).json() == []
            recoverable = (await client.get("/api/family-groups/deleted", headers=owner)).json()
            assert [g["id"] for g in recoverable] == [gid]
            assert (await client.post(f"/api/family-groups/{gid}/restore", headers=guest)).status_code == 403
            assert (await client.post(f"/api/family-groups/{gid}/restore", headers=owner)).status_code == 200
            assert (await client.post(f"/api/family-groups/{gid}/restore", headers=owner)).status_code == 409
            assert await database.medicines.find_one({"id": mid}) == before
            assert (await client.get(f"/api/family-groups/{gid}/join-code", headers=owner)).json()["code"] == code
            assert (await client.get(f"/api/medicines?family_group_id={gid}", headers=guest)).status_code == 200
            assert other["id"] in [g["id"] for g in (await client.get("/api/family-groups", headers=owner)).json()]
            # Leaving is separate from deletion and preserves the group.
            assert (await client.delete(f"/api/family-groups/{gid}/membership", headers=guest)).status_code == 200
            assert (await client.get(f"/api/medicines?family_group_id={gid}", headers=guest)).status_code == 403
            assert not (await database.family_groups.find_one({"id": gid})).get("deleted_at")

    loop.run_until_complete(exercise())


def test_last_family_deletion_does_not_reappear_and_recovery_expires(isolated_auth_database):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            owner, _, group, _ = await setup_family(client)
            gid = group["id"]
            assert (await client.delete(f"/api/family-groups/{gid}", headers=owner)).status_code == 200
            for _ in range(2):
                assert (await client.get("/api/family-groups", headers=owner)).json() == []
                assert (await client.get("/api/members", headers=owner)).json() == []
            await database.family_groups.update_one({"id": gid}, {"$set": {"recover_until": (server.now_utc() - timedelta(seconds=1)).isoformat()}})
            assert (await client.get("/api/family-groups/deleted", headers=owner)).json() == []
            assert (await client.post(f"/api/family-groups/{gid}/restore", headers=owner)).status_code == 409
            new = await client.post("/api/family-groups", headers=owner, json={"name": "Fresh family"})
            assert new.status_code == 200, new.text
            assert [g["id"] for g in (await client.get("/api/family-groups", headers=owner)).json()] == [new.json()["id"]]

    loop.run_until_complete(exercise())


def test_profile_removal_is_scoped_and_keeps_records_and_accounts(isolated_auth_database):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            owner, guest, group, _ = await setup_family(client)
            gid = group["id"]
            other = (await client.post("/api/family-groups", headers=owner, json={"name": "Other family"})).json()["id"]
            primary = (await client.get(f"/api/members?family_group_id={gid}", headers=owner)).json()[0]["id"]
            assert (await client.delete(f"/api/family-groups/{gid}/members/{primary}", headers=owner)).status_code == 400
            profile = (await client.post("/api/members", headers=owner, json={"name": "Synthetic profile", "family_group_id": gid})).json()["id"]
            await database.members.update_one({"id": profile}, {"$addToSet": {"family_group_ids": other}})
            collections = ("medicines", "eye_drop_protocols", "checkups", "dose_logs", "protocol_step_logs", "missed_dose_events")
            for collection in collections:
                for family in (gid, other):
                    await database[collection].insert_one({"id": f"{collection}-{family}", "family_group_id": family, "member_id": profile, "name": "Preserve", "medicine_id": family, "protocol_id": family, "event_key": family, "step_order": 1, "time": "08:00", "local_date": server.local_date()})
            assert (await client.delete(f"/api/family-groups/{gid}/members/{profile}", headers=guest)).status_code == 403
            assert (await client.delete(f"/api/family-groups/{gid}/members/{profile}", headers=owner)).status_code == 200
            for collection in collections:
                assert (await database[collection].find_one({"family_group_id": gid}))["member_id"] is None
                assert (await database[collection].find_one({"family_group_id": other}))["member_id"] == profile
                assert await database[collection].count_documents({}) == 2
            assert (await database.members.find_one({"id": profile}))["family_group_ids"] == [other]
            assert (await client.delete(f"/api/family-groups/{other}/members/{profile}", headers=owner)).status_code == 200
            await server.ensure_family_groups()
            assert (await database.members.find_one({"id": profile}))["family_group_ids"] == []
            assert await database.users.count_documents({}) == 2

    loop.run_until_complete(exercise())
