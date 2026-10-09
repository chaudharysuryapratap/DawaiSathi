from httpx import ASGITransport, AsyncClient
import server
from test_family_auth_isolated import isolated_auth_database  # noqa: F401


def test_profile_password_and_login_id_roundtrip(isolated_auth_database):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            account = await client.post("/api/auth/register", json={"name": "Settings test", "email": "settings@example.com", "password": "old-test-password-123", "bootstrap_token": "bootstrap-test-token"})
            assert account.status_code == 200, account.text
            headers = {"Authorization": "Bearer " + account.json()["access_token"]}
            preferences = (await client.get("/api/notifications/preferences", headers=headers)).json()
            assert preferences["eye_drop_reminders"] is True
            preferences["eye_drop_reminders"] = False
            saved = await client.put("/api/notifications/preferences", headers=headers, json=preferences)
            assert saved.status_code == 200, saved.text
            restored = (await client.get("/api/notifications/preferences", headers=headers)).json()
            assert restored["eye_drop_reminders"] is False
            assert restored["medicine_reminders"] is True
            assert restored["checkup_reminders"] is True
            assert (await client.patch("/api/auth/me", json={"name": "No auth"})).status_code == 401
            assert (await client.put("/api/auth/password", headers=headers, json={"current_password": "wrong", "new_password": "new-test-password"})).status_code == 403
            assert (await client.put("/api/auth/password", headers=headers, json={"current_password": "old-test-password-123", "new_password": "short"})).status_code == 422
            changed = await client.put("/api/auth/password", headers=headers, json={"current_password": "old-test-password-123", "new_password": "new-test-password"})
            assert changed.status_code == 200, changed.text
            assert (await client.post("/api/auth/login", json={"email": "settings@example.com", "password": "old-test-password-123"})).status_code == 401
            assert (await client.post("/api/auth/login", json={"email": "settings@example.com", "password": "new-test-password"})).status_code == 200
            updated = await client.patch("/api/auth/me", headers=headers, json={"name": "Updated name", "email": "changed@example.com"})
            assert updated.status_code == 200, updated.text
            assert updated.json()["name"] == "Updated name"
            assert "password_hash" not in updated.json()
            assert (await client.get("/api/auth/me", headers=headers)).json()["email"] == "changed@example.com"
            assert (await client.post("/api/auth/login", json={"email": "changed@example.com", "password": "new-test-password"})).status_code == 200
            assert (await client.post("/api/auth/login", json={"email": "settings@example.com", "password": "new-test-password"})).status_code == 401
            await database.users.insert_one({"id": "other", "email": "occupied@example.com"})
            assert (await client.patch("/api/auth/me", headers=headers, json={"email": "occupied@example.com"})).status_code == 409
            assert (await client.patch("/api/auth/me", headers=headers, json={"name": "  "})).status_code == 422
    loop.run_until_complete(exercise())
