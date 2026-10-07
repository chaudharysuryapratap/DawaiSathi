import asyncio
from base64 import b64encode
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import server


class Collection:
    def __init__(self):
        self.rows = []

    async def insert_one(self, document):
        self.rows.append(dict(document))

    async def find_one(self, query, projection=None):
        for row in self.rows:
            if all(row.get(key) in value["$in"] if isinstance(value, dict) else row.get(key) == value for key, value in query.items()):
                return dict(row)
        return None

    async def update_one(self, query, update):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                row.update(update["$set"])
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)


@pytest.fixture
def storage(monkeypatch, tmp_path):
    db = SimpleNamespace(**{name: Collection() for name in ("voice_notes", "medicines", "checkups", "eye_drop_protocols", "members")})
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "VOICE_MEDIA_ROOT", tmp_path)
    async def group(_):
        return {"id": "family"}
    monkeypatch.setattr(server, "get_family_group", group)
    return db, tmp_path


def upload(data=b"\x00\x00\x00\x18ftypM4A synthetic", mime="audio/mp4"):
    return asyncio.run(server.upload_voice_note(server.VoiceNoteUpload(content_type=mime, audio_base64=b64encode(data).decode()), {"id": "owner", "family_group_ids": ["family"]}))


def test_upload_and_owner_playback(storage):
    db, path = storage
    result = upload()
    filename = result["voice_note_url"].split("/")[-1]
    assert (path / filename).is_file()
    assert db.voice_notes.rows[0]["owner_user_id"] == "owner"
    response = asyncio.run(server.get_voice_note(filename, {"id": "owner"}))
    assert response.media_type == "audio/mp4"
    assert response.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize("data,mime", [(b"bad", "audio/mp4"), (b"ID3music", "text/html"), (b"x" * (server.VOICE_MAX_BYTES + 1), "audio/mpeg")], ids=["mismatch", "unsupported", "too-large"])
def test_invalid_upload_does_not_write(storage, data, mime):
    with pytest.raises(HTTPException):
        upload(data, mime)
    assert not list(storage[1].iterdir())


def test_invalid_base64(storage):
    with pytest.raises(HTTPException):
        asyncio.run(server.upload_voice_note(server.VoiceNoteUpload(content_type="audio/mp4", audio_base64="!?invalid"), {"id": "owner"}))


@pytest.mark.parametrize("collection", ["medicines", "checkups", "eye_drop_protocols"])
def test_family_access_requires_attached_note(storage, collection):
    db, _ = storage
    url = upload()["voice_note_url"]
    filename = url.split("/")[-1]
    reader = {"id": "relative", "family_group_ids": ["family"]}
    with pytest.raises(HTTPException):
        asyncio.run(server.get_voice_note(filename, reader))
    getattr(db, collection).rows.append({"id": "item", "voice_note_url": url, "family_group_id": "family"})
    assert asyncio.run(server.get_voice_note(filename, reader)).media_type == "audio/mp4"
    with pytest.raises(HTTPException):
        asyncio.run(server.get_voice_note(filename, {"id": "outsider", "family_group_ids": []}))
    getattr(db, collection).rows[0]["voice_note_url"] = ""
    with pytest.raises(HTTPException):
        asyncio.run(server.get_voice_note(filename, reader))


def test_all_three_records_persist_and_remove(storage):
    url = upload()["voice_note_url"]
    async def scenario():
        medicine = await server.create_medicine(server.MedicineCreate(name="Test", dosage="1", times=["08:00"], family_group_id="family", voice_note_url=url))
        checkup = await server.create_checkup(server.CheckupCreate(title="Test", scheduled_at="2026-10-07T08:00:00", family_group_id="family", voice_note_url=url))
        protocol = await server.create_protocol(server.EyeDropProtocolCreate(name="Test", start_time="08:00", steps=[server.EyeDropStepInput(medicine_name="Test", dose="1 drop", eye="both")], family_group_id="family", voice_note_url=url))
        assert medicine.voice_note_url == checkup.voice_note_url == protocol.voice_note_url == url
        assert (await server.update_medicine(medicine.id, server.MedicineUpdate(voice_note_url=""))).voice_note_url == ""
        assert (await server.update_checkup(checkup.id, server.CheckupUpdate(voice_note_url=""))).voice_note_url == ""
        assert (await server.update_protocol(protocol.id, server.EyeDropProtocolUpdate(voice_note_url=""))).voice_note_url == ""
    asyncio.run(scenario())


def test_attachment_rejects_another_users_note(storage):
    url = upload()["voice_note_url"]
    async def scenario():
        async def receive():
            import json
            return {"type": "http.request", "body": json.dumps({"voice_note_url": url}).encode()}
        request = Request({"type": "http", "method": "POST", "path": "/api/medicines", "headers": []}, receive)
        await server.validate_voice_attachment(request, {"id": "owner"})
        with pytest.raises(HTTPException):
            await server.validate_voice_attachment(request, {"id": "outsider", "family_group_ids": []})
    asyncio.run(scenario())


def test_path_traversal(storage):
    with pytest.raises(HTTPException):
        asyncio.run(server.get_voice_note("../secret.wav", {"id": "owner"}))


def test_http_contract_and_attachment_dependency(storage):
    from httpx import ASGITransport, AsyncClient
    user = {"id": "owner", "family_group_ids": ["family"]}
    async def authenticated():
        return user
    async def scoped():
        return None
    original_overrides = dict(server.app.dependency_overrides)
    server.app.dependency_overrides[server.require_authenticated_user] = authenticated
    server.app.dependency_overrides[server.authorize_request_scope] = scoped
    async def scenario():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as client:
            response = await client.post("/api/voice-notes", json={"content_type": "audio/mp4", "audio_base64": b64encode(b"\x00\x00\x00\x18ftypM4A synthetic").decode()})
            assert response.status_code == 200
            url = response.json()["voice_note_url"]
            payload = {"name": "Test", "dosage": "1 tablet", "times": ["08:00"], "family_group_id": "family", "voice_note_url": url}
            response = await client.post("/api/medicines", json=payload)
            assert response.status_code == 200
            medicine_id = response.json()["id"]
            assert response.json()["voice_note_url"] == url
            assert (await client.get(url)).status_code == 200
            assert (await client.patch(f"/api/medicines/{medicine_id}", json={"voice_note_url": None})).status_code == 422
            user["id"] = "outsider"
            user["family_group_ids"] = []
            assert (await client.get(url)).status_code == 404
            assert (await client.post("/api/medicines", json=payload)).status_code == 422
    try:
        asyncio.run(scenario())
    finally:
        server.app.dependency_overrides.clear()
        server.app.dependency_overrides.update(original_overrides)
