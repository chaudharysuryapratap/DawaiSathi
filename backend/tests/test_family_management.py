import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

import server
from family_management import management_router


def test_secure_invitation_and_recovery_workflow():
    async def exercise():
        client = AsyncIOMotorClient(server.mongo_url, serverSelectionTimeoutMS=3000)
        database_name = f"family_management_test_{uuid.uuid4().hex}"
        db = client[database_name]
        user = {"id": "owner", "email": "owner@example.com", "name": "Owner"}
        async def authenticate():
            return user.copy()
        async def limit(_):
            pass
        app = FastAPI(); app.include_router(management_router(db, authenticate, limit))
        try:
            await db.users.insert_one(user.copy())
            await db.family_groups.insert_one({"id": "family", "name": "Test family", "owner_user_id": "owner", "user_ids": ["owner"], "member_ids": []})
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
                assert (await api.post("/api/family-management/family/members", json={"name": "Invalid role", "role": "patient"})).status_code == 422
                assert (await api.post("/api/family-management/family/members", json={"name": "Care person", "role": "care_taker"})).status_code == 200
                await db.members.delete_many({"name": "Care person"})
                await db.family_invitations.insert_one({"id": "home-invite", "family_group_id": "family", "email": "home@example.com", "used_at": None, "created_at": datetime.now(timezone.utc).isoformat(), "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "token_hash": "not-returned"})
                home_invites = (await api.get("/api/family-management/family/invites")).json()
                assert home_invites[0]["id"] == "home-invite" and home_invites[0]["status"] == "Pending" and "token_hash" not in home_invites[0]
                assert (await api.delete("/api/family-management/family/invites/home-invite")).status_code == 200
                profile = (await api.post("/api/family-management/family/members", json={"name": "Existing person", "email": "guest@example.com"})).json()
                assert (await api.post("/api/family-management/family/invites", json={"member_id": profile["id"]})).status_code == 422
                assert (await api.post("/api/family-management/family/invites", json={"member_id": profile["id"], "email": "wrong@example.com"})).status_code == 422
                invite = (await api.post("/api/family-management/family/invites", json={"email": "guest@example.com", "member_id": profile["id"]})).json()
                assert invite["code"].startswith("FAM-") and "token_hash" not in invite
                user.update(id="stranger", email="stranger@example.com")
                assert (await api.post("/api/family-management/family/invites", json={})).status_code == 403
                assert (await api.post("/api/family-management/invite/preview", json={"code": invite["code"]})).status_code == 403
                user.update(id="guest", email="guest@example.com", name="Guest")
                preview = await api.post("/api/family-management/invite/preview", json={"code": invite["code"]})
                assert preview.json()["owner_name"] == "Owner"
                assert "guest" not in (await db.family_groups.find_one({"id": "family"}))["user_ids"]
                assert (await api.post("/api/family-management/invite/accept", json={"code": invite["code"]})).status_code == 200
                assert await db.members.count_documents({"family_group_ids": "family"}) == 1
                assert (await db.members.find_one({"id": profile["id"]}))["user_id"] == "guest"
                assert (await api.post("/api/family-management/invite/accept", json={"code": invite["code"]})).status_code == 410
                user.update(id="owner", email="owner@example.com", name="Owner")
                assert (await api.put(f"/api/family-management/family/members/{profile['id']}", json={"name": "Existing person", "email": "changed@example.com"})).status_code == 422
                await db.family_groups.insert_one({"id": "shared", "owner_user_id": "other-owner", "user_ids": ["other-owner"]})
                await db.members.update_one({"id": profile["id"]}, {"$addToSet": {"family_group_ids": "shared"}})
                assert (await api.put(f"/api/family-management/family/members/{profile['id']}", json={"name": "Changed", "email": "guest@example.com"})).status_code == 403
                await db.members.update_one({"id": profile["id"]}, {"$pull": {"family_group_ids": "shared"}})
                assert (await api.get("/api/family-management/family/invites")).json()[0]["status"] == "Accepted"
                assert (await api.delete(f"/api/family-management/family/members/{profile['id']}")).status_code == 200
                assert "guest" not in (await db.family_groups.find_one({"id": "family"}))["user_ids"]
                assert len((await api.get("/api/family-management/family/deleted-members")).json()) == 1
                assert (await api.post(f"/api/family-management/family/members/{profile['id']}/restore")).status_code == 200
                assert "guest" not in (await db.family_groups.find_one({"id": "family"}))["user_ids"]
                renewed = await api.post("/api/family-management/family/invites", json={"email": "guest@example.com", "member_id": profile["id"]})
                assert renewed.status_code == 200
                pending = (await api.post("/api/family-management/family/invites", json={})).json()
                await api.delete(f"/api/family-management/family/invites/{pending['id']}")
                assert (await api.post("/api/family-management/invite/preview", json={"code": pending["code"]})).status_code == 410
                expired = (await api.post("/api/family-management/family/invites", json={})).json()
                await db.management_invites.update_one({"id": expired["id"]}, {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}})
                assert (await api.post("/api/family-management/invite/preview", json={"code": expired["code"]})).status_code == 410
                assert (await api.post("/api/family-management/invite/preview", json={"code": "invalid"})).status_code == 410
        finally:
            await client.drop_database(database_name); client.close()
    asyncio.run(exercise())
