import asyncio
from base64 import b64encode
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

import server


@pytest.fixture
def isolated_auth_database(monkeypatch):
    database_name = f"dawaisathi_test_{uuid.uuid4().hex}"
    loop = asyncio.new_event_loop()
    test_client = AsyncIOMotorClient(
        server.mongo_url,
        io_loop=loop,
        serverSelectionTimeoutMS=3000,
    )
    database = test_client[database_name]
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "AUTH_SECRET", "isolated-test-secret-" + "x" * 40)
    monkeypatch.setattr(server, "BOOTSTRAP_TOKEN", "bootstrap-test-token")

    try:
        loop.run_until_complete(server.startup_event())
        yield loop, database
    finally:
        assert database_name.startswith("dawaisathi_test_")
        loop.run_until_complete(test_client.drop_database(database_name))
        test_client.close()
        loop.close()


def test_family_invites_require_auth_are_scoped_and_one_time(isolated_auth_database):
    loop, database = isolated_auth_database

    async def exercise():
        legacy_group_id = (await database.family_groups.find_one({}, {"_id": 0}))["id"]
        legacy_medicine = {
            "id": "legacy-medicine",
            "name": "Untouched test medicine",
            "dosage": "1 tablet",
            "frequency": "Daily",
            "times": ["08:00"],
            "instructions": "",
            "quantity_total": 2,
            "quantity_remaining": 1,
            "image_url": "",
            "active": True,
            "member_id": None,
            "family_group_id": legacy_group_id,
            "days": list(server.DEFAULT_DAYS),
            "created_at": server.now_iso(),
        }
        legacy_log = {
            "id": "legacy-dose-log",
            "medicine_id": legacy_medicine["id"],
            "medicine_name": legacy_medicine["name"],
            "dosage": legacy_medicine["dosage"],
            "time": "08:00",
            "logged_at": server.now_iso(),
            "local_date": server.local_date(),
            "member_id": None,
            "family_group_id": legacy_group_id,
            "quantity_deducted": True,
        }
        await database.medicines.insert_one(legacy_medicine.copy())
        await database.dose_logs.insert_one(legacy_log.copy())
        medicine_before = await database.medicines.find_one({"id": legacy_medicine["id"]})
        log_before = await database.dose_logs.find_one({"id": legacy_log["id"]})

        async with AsyncClient(
            transport=ASGITransport(app=server.app),
            base_url="http://testserver",
        ) as client:
            unauthorized = await client.get("/api/family-groups")
            assert unauthorized.status_code == 401

            invalid_bootstrap = await client.post(
                "/api/auth/register",
                json={
                    "name": "Owner",
                    "email": "owner@example.com",
                    "password": "a-strong-test-password",
                    "bootstrap_token": "not-the-bootstrap-token",
                },
            )
            assert invalid_bootstrap.status_code == 403
            assert await database.users.count_documents({}) == 0

            owner_response = await client.post(
                "/api/auth/register",
                json={
                    "name": "Owner",
                    "email": "owner@example.com",
                    "password": "a-strong-test-password",
                    "bootstrap_token": "bootstrap-test-token",
                },
            )
            assert owner_response.status_code == 200, owner_response.text
            owner_token = owner_response.json()["access_token"]
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            assert await database.medicines.find_one({"id": legacy_medicine["id"]}) == medicine_before
            assert await database.dose_logs.find_one({"id": legacy_log["id"]}) == log_before

            groups_response = await client.get("/api/family-groups", headers=owner_headers)
            assert groups_response.status_code == 200
            existing_group_id = groups_response.json()[0]["id"]
            owned_group = await database.family_groups.find_one({"id": existing_group_id})
            assert owned_group["owner_user_id"] == owner_response.json()["user"]["id"]
            assert owner_response.json()["user"]["id"] in owned_group["user_ids"]

            create_response = await client.post(
                f"/api/family-groups/{existing_group_id}/invites",
                headers=owner_headers,
                json={"email": "member@example.com"},
            )
            assert create_response.status_code == 200, create_response.text
            invitation_token = create_response.json()["token"]

            member_response = await client.post(
                "/api/auth/register",
                json={
                    "name": "Member",
                    "email": "member@example.com",
                    "password": "another-strong-password",
                    "invitation_token": invitation_token,
                },
            )
            assert member_response.status_code == 200, member_response.text
            member_token = member_response.json()["access_token"]
            member_headers = {"Authorization": f"Bearer {member_token}"}

            image_bytes = b"\x89PNG\r\n\x1a\nimage-data"
            uploaded_image = await client.post(
                "/api/medicine-images",
                headers=owner_headers,
                json={
                    "content_type": "image/png",
                    "image_base64": b64encode(image_bytes).decode("ascii"),
                },
            )
            assert uploaded_image.status_code == 200, uploaded_image.text
            image_url = uploaded_image.json()["image_url"]
            medicine_response = await client.post(
                "/api/medicines",
                headers=owner_headers,
                json={
                    "name": "Private image medicine",
                    "dosage": "1 tablet",
                    "times": ["08:00"],
                    "family_group_id": existing_group_id,
                    "image_url": image_url,
                },
            )
            assert medicine_response.status_code == 200, medicine_response.text
            private_image = await client.get(image_url)
            assert private_image.status_code == 401
            shared_image = await client.get(image_url, headers=member_headers)
            assert shared_image.status_code == 200
            assert shared_image.content == image_bytes

            member_groups = await client.get("/api/family-groups", headers=member_headers)
            assert [group["id"] for group in member_groups.json()] == [existing_group_id]
            primary_member = await database.members.find_one(
                {"family_group_ids": existing_group_id, "is_primary": True},
                {"_id": 0},
            )
            profile_edit = await client.patch(
                f"/api/members/{primary_member['id']}",
                headers=member_headers,
                json={"name": "Unauthorized profile edit"},
            )
            assert profile_edit.status_code == 403

            inaccessible_group = await client.post(
                "/api/family-groups",
                headers=owner_headers,
                json={"name": "Owner-only group"},
            )
            assert inaccessible_group.status_code == 200
            inaccessible_group_id = inaccessible_group.json()["id"]
            denied = await client.get(
                f"/api/medicines?family_group_id={inaccessible_group_id}",
                headers=member_headers,
            )
            assert denied.status_code == 403
            cross_group_move = await client.patch(
                f"/api/medicines/{medicine_response.json()['id']}",
                headers=member_headers,
                json={"family_group_id": inaccessible_group_id},
            )
            assert cross_group_move.status_code == 403

            reused_invitation = await client.post(
                "/api/auth/register",
                json={
                    "name": "Other",
                    "email": "other@example.com",
                    "password": "third-strong-password",
                    "invitation_token": invitation_token,
                },
            )
            assert reused_invitation.status_code == 404

            owner_leave = await client.delete(
                f"/api/family-groups/{existing_group_id}/membership",
                headers=owner_headers,
            )
            assert owner_leave.status_code == 400

            member_leave = await client.delete(
                f"/api/family-groups/{existing_group_id}/membership",
                headers=member_headers,
            )
            assert member_leave.status_code == 200
            assert await database.family_groups.find_one(
                {"id": existing_group_id, "user_ids": member_response.json()["user"]["id"]}
            ) is None
            left_group_access = await client.get(
                f"/api/medicines?family_group_id={existing_group_id}",
                headers=member_headers,
            )
            assert left_group_access.status_code == 403

            login = await client.post(
                "/api/auth/login",
                json={"email": "owner@example.com", "password": "a-strong-test-password"},
            )
            assert login.status_code == 200

    loop.run_until_complete(exercise())
