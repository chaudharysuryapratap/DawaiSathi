import asyncio
import base64
import uuid

import httpx
import pymupdf
import pytest
from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

import server
from prescriptions import PrescriptionPage, decode_page, prescription_router


def pdf_page():
    with pymupdf.open() as document:
        document.new_page().insert_text((30, 30), "Disposable prescription test")
        document.new_page()
        return PrescriptionPage(name="test.pdf", content_type="application/pdf", base64=base64.b64encode(document.tobytes()).decode())


def test_pdf_preview_counts_pages_and_rejects_unreadable_files():
    raw, preview, count, extension = decode_page(pdf_page())
    assert count == 2 and extension == "pdf" and raw.startswith(b"%PDF")
    assert preview.startswith(b"\x89PNG")
    with pytest.raises(HTTPException):
        decode_page(PrescriptionPage(content_type="application/pdf", base64="bm90IGEgcGRm"))


def test_storage_permissions_archive_and_file_deletion(tmp_path):
    async def exercise():
        client = AsyncIOMotorClient(server.mongo_url, serverSelectionTimeoutMS=3000)
        name = f"prescription_test_{uuid.uuid4().hex}"
        db, user = client[name], {"id": "owner"}
        async def authenticate():
            return user
        app = FastAPI()
        app.include_router(prescription_router(db, authenticate, tmp_path))
        try:
            await db.family_groups.insert_many([{"id": "family", "user_ids": ["owner"]}, {"id": "other", "user_ids": ["stranger"]}])
            await db.members.insert_one({"id": "patient", "family_group_ids": ["family"]})
            payload = {"family_group_id": "family", "member_id": "patient", "prescription_date": "2026-10-08", "doctor": "Test doctor", "medicines": [{"name": "Test medicine"}], "pages": [pdf_page().model_dump()]}
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
                created = await api.post("/api/prescriptions", json=payload)
                assert created.status_code == 200, created.text
                record = created.json()
                assert record["pages"][0]["page_count"] == 2 and "file" not in record["pages"][0]
                assert await db.medicines.count_documents({}) == 0
                assert (await api.get(record["pages"][0]["preview_url"])).content.startswith(b"\x89PNG")
                assert (await api.get(record["pages"][0]["url"])).content.startswith(b"%PDF")
                record["archived"] = True
                record = (await api.put(f"/api/prescriptions/{record['id']}", json=record)).json()
                assert record["archived"]
                record["archived"] = False
                record = (await api.put(f"/api/prescriptions/{record['id']}", json=record)).json()
                assert not record["archived"]
                assert (await api.get("/api/prescriptions?family_group_id=other")).status_code == 403
                user["id"] = "stranger"
                assert (await api.get(record["pages"][0]["url"])).status_code == 403
                assert (await api.delete(f"/api/prescriptions/{record['id']}")).status_code == 403
                user["id"] = "owner"
                forged = {**record, "pages": [{"id": "foreign-page"}]}
                assert (await api.put(f"/api/prescriptions/{record['id']}", json=forged)).status_code == 422
                assert (await api.delete(f"/api/prescriptions/{record['id']}")).status_code == 200
                assert not list(tmp_path.iterdir())
        finally:
            await client.drop_database(name)
            client.close()
    asyncio.run(exercise())
