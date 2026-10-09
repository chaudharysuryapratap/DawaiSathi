from httpx import ASGITransport, AsyncClient
import server
from test_family_auth_isolated import isolated_auth_database  # noqa: F401


def test_inbox_requests_are_scoped_persistent_idempotent_and_not_marked_sent(isolated_auth_database, monkeypatch):
    loop, database = isolated_auth_database

    async def alerts(group):
        return server.AttentionResponse(items=[server.AttentionItem(
            id="missed:test:08:00:2026-10-09", kind="missed-dose", title="Missed dose · Test medicine",
            detail="1 tablet at 08:00", when="2026-10-09T08:00:00", medicine_id="test", family_group_id=group)])

    monkeypatch.setattr(server, "attention", alerts)

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            response = await client.post("/api/auth/register", json={"name": "Inbox test", "email": "inbox@example.com", "password": "test-password-123", "bootstrap_token": "bootstrap-test-token"})
            assert response.status_code == 200
            headers = {"Authorization": "Bearer " + response.json()["access_token"]}
            group = (await client.get("/api/family-groups", headers=headers)).json()[0]["id"]
            assert (await client.get("/api/inbox", params={"family_group_id": group})).status_code == 401
            assert (await client.get("/api/inbox", headers=headers, params={"family_group_id": ""})).status_code in {403, 422}
            assert (await client.get("/api/inbox", headers=headers, params={"family_group_id": "another-family"})).status_code == 403
            items = (await client.get("/api/inbox", headers=headers, params={"family_group_id": group})).json()["items"]
            assert items[0]["can_resend"] is True
            payload = {"family_group_id": group, "attention_id": items[0]["id"], "request_id": "same-request"}
            sent = await client.post("/api/inbox/resend", headers=headers, json=payload)
            assert sent.status_code == 200, sent.text
            assert sent.json()["delivery_status"] == "pending"
            assert sent.json()["can_resend"] is False
            again = await client.post("/api/inbox/resend", headers=headers, json=payload)
            assert again.json()["id"] == sent.json()["id"]
            assert await database.reminder_requests.count_documents({}) == 1
            restored = (await client.get("/api/inbox", headers=headers, params={"family_group_id": group})).json()["items"]
            assert any(item["id"] == sent.json()["id"] for item in restored)
            assert (await client.post("/api/inbox/resend", headers=headers, json={**payload, "request_id": "new", "attention_id": "stale"})).status_code == 409
            assert (await client.post("/api/inbox/resend", headers=headers, json={**payload, "family_group_id": "another-family"})).status_code == 403

    loop.run_until_complete(exercise())
