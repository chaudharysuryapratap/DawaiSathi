"""Family-scoped prescription storage. No automatic medicine creation or OCR."""
import base64
import binascii
import uuid
from datetime import date
from pathlib import Path

import pymupdf
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool


class PrescriptionMedicine(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    dosage: str = Field(default="", max_length=200)
    timing: str = Field(default="", max_length=500)
    instructions: str = Field(default="", max_length=2000)


class PrescriptionPage(BaseModel):
    id: str | None = None
    name: str = Field(default="Prescription", max_length=200)
    content_type: str = ""
    base64: str | None = Field(default=None, max_length=14000000)


class PrescriptionInput(BaseModel):
    revision: int = Field(default=0, ge=0)
    family_group_id: str
    member_id: str
    prescription_date: date
    doctor: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=5000)
    medicines: list[PrescriptionMedicine] = Field(default_factory=list, max_length=100)
    pages: list[PrescriptionPage] = Field(default_factory=list, max_length=20)
    archived: bool = False


def decode_page(page):
    """Validate actual content and render a real first-page preview."""
    types = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}
    if page.content_type not in types:
        raise HTTPException(422, "Choose a JPEG, PNG, WebP or PDF file")
    try:
        raw = base64.b64decode(page.base64 or "", validate=True)
        if not raw or len(raw) > 10 * 1024 * 1024:
            raise ValueError("File must be between 1 byte and 10 MB")
        if page.content_type == "application/pdf" and not raw.startswith(b"%PDF"):
            raise ValueError("Not a PDF")
        with pymupdf.open(stream=raw, filetype=types[page.content_type]) as document:
            if document.is_encrypted or not 1 <= document.page_count <= 50:
                raise ValueError("Choose an unlocked file with at most 50 pages")
            first = document[0]
            scale = min(1.5, 900 / max(first.rect.width, first.rect.height))
            preview = first.get_pixmap(matrix=pymupdf.Matrix(scale, scale)).tobytes("png")
            return raw, preview, document.page_count, types[page.content_type]
    except (ValueError, RuntimeError, binascii.Error) as error:
        raise HTTPException(422, "We could not read this file. Try another image or PDF, or add the prescription manually.") from error


def prescription_router(db, authenticate, media_root: Path):
    router = APIRouter(dependencies=[Depends(authenticate)])

    async def group_access(group_id, user):
        if not await db.family_groups.find_one({"id": group_id, "user_ids": user["id"], "deleted_at": {"$exists": False}}):
            raise HTTPException(403, "You do not have access to this family group")

    async def record_access(record_id, user):
        record = await db.prescriptions.find_one({"id": record_id}, {"_id": 0})
        if not record:
            raise HTTPException(404, "Prescription not found")
        await group_access(record["family_group_id"], user)
        return record

    def remove_files(pages):
        for page in pages:
            for key in ("file", "preview"):
                # Only server-generated basenames inside this dedicated directory.
                path = (media_root / page[key]).resolve()
                if path.parent == media_root.resolve():
                    path.unlink(missing_ok=True)

    def public(record):
        return {**record, "pages": [{k: v for k, v in page.items() if k not in ("file", "preview")} for page in record["pages"]]}

    @router.get("/api/prescriptions")
    async def listing(family_group_id: str, user=Depends(authenticate)):
        await group_access(family_group_id, user)
        records = await db.prescriptions.find({"family_group_id": family_group_id}, {"_id": 0}).sort("prescription_date", -1).to_list(1000)
        return [public(record) for record in records]

    @router.post("/api/prescription-preview")
    async def preview_page(input: PrescriptionPage):
        _, preview, count, _ = await run_in_threadpool(decode_page, input)
        return {"page_count": count, "preview_url": "data:image/png;base64," + base64.b64encode(preview).decode()}

    async def save(input, user, record_id=None):
        existing = await record_access(record_id, user) if record_id else None
        await group_access(input.family_group_id, user)
        if existing and existing["family_group_id"] != input.family_group_id:
            raise HTTPException(422, "A prescription cannot be moved between families")
        if existing and input.revision != existing.get("revision", 0):
            raise HTTPException(409, "This prescription changed on another device. Reopen it before editing.")
        if sum(len(page.base64 or "") for page in input.pages) > 40 * 1024 * 1024:
            raise HTTPException(422, "Keep each prescription below 30 MB in total")
        if not await db.members.find_one({"id": input.member_id, "family_group_ids": input.family_group_id}):
            raise HTTPException(422, "Choose a member of this family")
        pages, created = [], []
        try:
            for page in input.pages:
                if page.id:
                    stored = next((p for p in (existing or {}).get("pages", []) if p["id"] == page.id), None)
                    if not stored:
                        raise HTTPException(422, "Page does not belong to this prescription")
                    pages.append(stored)
                else:
                    raw, preview, count, extension = await run_in_threadpool(decode_page, page)
                    page_id = str(uuid.uuid4())
                    stored = {"id": page_id, "name": page.name, "content_type": page.content_type, "page_count": count, "file": f"{page_id}.{extension}", "preview": f"{page_id}.png", "url": f"/api/prescriptions/{record_id or 'pending'}/pages/{page_id}", "preview_url": ""}
                    created.append(stored)
                    media_root.mkdir(parents=True, exist_ok=True)
                    await run_in_threadpool((media_root / stored["file"]).write_bytes, raw)
                    await run_in_threadpool((media_root / stored["preview"]).write_bytes, preview)
                    pages.append(stored)
            record_id = record_id or str(uuid.uuid4())
            for page in pages:
                page["url"] = f"/api/prescriptions/{record_id}/pages/{page['id']}"
                page["preview_url"] = page["url"] + "/preview"
            record = {**input.model_dump(exclude={"pages"}), "prescription_date": input.prescription_date.isoformat(), "id": record_id, "pages": pages}
            record["revision"] = input.revision + 1
            if existing:
                result = await db.prescriptions.replace_one({"id": record_id, "revision": input.revision}, record)
                if not result.matched_count:
                    raise HTTPException(409, "This prescription changed. Reopen it before editing.")
            else:
                await db.prescriptions.insert_one(record.copy())
        except Exception:
            await run_in_threadpool(remove_files, created)
            raise
        removed = [p for p in (existing or {}).get("pages", []) if p["id"] not in {x["id"] for x in pages}]
        await run_in_threadpool(remove_files, removed)
        return public(record)

    @router.post("/api/prescriptions")
    async def create(input: PrescriptionInput, user=Depends(authenticate)):
        return await save(input, user)

    @router.put("/api/prescriptions/{record_id}")
    async def update(record_id: str, input: PrescriptionInput, user=Depends(authenticate)):
        return await save(input, user, record_id)

    @router.delete("/api/prescriptions/{record_id}")
    async def delete(record_id: str, user=Depends(authenticate)):
        record = await record_access(record_id, user)
        await db.prescriptions.delete_one({"id": record_id})
        await run_in_threadpool(remove_files, record["pages"])
        return {"deleted": True}

    @router.get("/api/prescriptions/{record_id}/pages/{page_id}")
    @router.get("/api/prescriptions/{record_id}/pages/{page_id}/preview")
    async def media(record_id: str, page_id: str, request: Request, user=Depends(authenticate)):
        record = await record_access(record_id, user)
        page = next((p for p in record["pages"] if p["id"] == page_id), None)
        if not page:
            raise HTTPException(404, "Page not found")
        if request.url.path.endswith("/preview"):
            return FileResponse(media_root / page["preview"], media_type="image/png", headers={"Cache-Control": "private, no-store"})
        return FileResponse(media_root / page["file"], media_type=page["content_type"], filename=page["name"], headers={"Cache-Control": "private, no-store"})

    return router
