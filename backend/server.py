from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional
import logging
import os
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="DawaiSathi API")
api_router = APIRouter(prefix="/api")

MEMBER_COLORS = ["#3B7A57", "#C67D0A", "#2B6CB0", "#8E4EC6", "#BA1A1A", "#0EA5A0"]
DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def local_date() -> str:
    return datetime.now().date().isoformat()


def time_slot(hhmm: str) -> str:
    hour = int(hhmm.split(":")[0])
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "night"


class Member(BaseModel):
    id: str
    name: str
    role: str = "member"
    color: str
    is_primary: bool = False
    created_at: str


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    role: str = Field(default="member", max_length=30)


class MemberUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=40)
    role: Optional[str] = Field(default=None, max_length=30)


class MedicineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dosage: str = Field(min_length=1, max_length=40)
    frequency: str = Field(default="Daily", max_length=30)
    times: List[str] = Field(min_length=1, max_length=6)
    instructions: str = Field(default="", max_length=180)
    quantity_total: int = Field(default=0, ge=0, le=10000)
    identification_cue: str = Field(default="", max_length=120)
    image_url: str = Field(default="", max_length=500)
    member_id: Optional[str] = None
    days: List[int] = Field(default_factory=lambda: list(DEFAULT_DAYS))


class Medicine(BaseModel):
    id: str
    name: str
    dosage: str
    frequency: str
    times: List[str]
    instructions: str
    quantity_total: int
    quantity_remaining: int
    identification_cue: str = ""
    image_url: str = ""
    active: bool = True
    member_id: Optional[str] = None
    days: List[int] = Field(default_factory=lambda: list(DEFAULT_DAYS))
    created_at: str


class MedicineUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    dosage: Optional[str] = Field(default=None, min_length=1, max_length=40)
    frequency: Optional[str] = Field(default=None, max_length=30)
    times: Optional[List[str]] = Field(default=None, min_length=1, max_length=6)
    instructions: Optional[str] = Field(default=None, max_length=180)
    quantity_total: Optional[int] = Field(default=None, ge=0, le=10000)
    quantity_remaining: Optional[int] = Field(default=None, ge=0, le=10000)
    identification_cue: Optional[str] = Field(default=None, max_length=120)
    image_url: Optional[str] = Field(default=None, max_length=500)
    member_id: Optional[str] = None
    days: Optional[List[int]] = None
    active: Optional[bool] = None


class DoseLogCreate(BaseModel):
    time: str = Field(min_length=1, max_length=10)


class DoseLog(BaseModel):
    id: str
    medicine_id: str
    medicine_name: str
    dosage: str
    time: str
    logged_at: str
    local_date: str
    member_id: Optional[str] = None


class TodayDose(BaseModel):
    dose_id: str
    medicine_id: str
    medicine_name: str
    dosage: str
    instructions: str
    time: str
    time_slot: str
    member_id: Optional[str] = None
    member_name: str = ""
    identification_cue: str = ""
    image_url: str = ""
    logged_at: Optional[str] = None
    log_id: Optional[str] = None


class TodayResponse(BaseModel):
    date: str
    doses: List[TodayDose]


class CheckupCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    doctor: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=120)
    scheduled_at: str
    notes: str = Field(default="", max_length=400)
    member_id: Optional[str] = None


class CheckupUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    doctor: Optional[str] = Field(default=None, max_length=80)
    location: Optional[str] = Field(default=None, max_length=120)
    scheduled_at: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=400)
    member_id: Optional[str] = None


class Checkup(BaseModel):
    id: str
    title: str
    doctor: str
    location: str
    scheduled_at: str
    notes: str
    member_id: Optional[str] = None
    created_at: str


class AttentionItem(BaseModel):
    id: str
    kind: str
    title: str
    detail: str
    when: str
    medicine_id: Optional[str] = None
    checkup_id: Optional[str] = None
    member_id: Optional[str] = None


class AttentionResponse(BaseModel):
    items: List[AttentionItem]


class NotificationPreference(BaseModel):
    medicine_reminders: bool = True
    checkup_reminders: bool = True
    reminder_sound: bool = True
    voice_reminders: bool = False
    push_enabled: bool = False
    whatsapp_linked: bool = False
    telegram_linked: bool = False


async def ensure_primary_member() -> None:
    count = await db.members.count_documents({})
    if count == 0:
        member = {
            "id": str(uuid.uuid4()),
            "name": "You",
            "role": "Primary member",
            "color": MEMBER_COLORS[0],
            "is_primary": True,
            "created_at": now_iso(),
        }
        await db.members.insert_one(member)


async def load_medicines_map() -> dict:
    documents = await db.medicines.find({}, {"_id": 0}).to_list(500)
    return {document["id"]: document for document in documents}


async def load_members_map() -> dict:
    documents = await db.members.find({}, {"_id": 0}).to_list(200)
    return {document["id"]: document for document in documents}


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_primary_member()


@api_router.get("/")
async def root():
    return {"message": "DawaiSathi API is ready"}


@api_router.get("/members", response_model=List[Member])
async def list_members():
    await ensure_primary_member()
    documents = await db.members.find({}, {"_id": 0}).sort([("is_primary", -1), ("created_at", 1)]).to_list(200)
    return [Member(**document) for document in documents]


@api_router.post("/members", response_model=Member)
async def create_member(input: MemberCreate):
    color = MEMBER_COLORS[await db.members.count_documents({}) % len(MEMBER_COLORS)]
    document = {
        "id": str(uuid.uuid4()),
        "name": input.name.strip(),
        "role": input.role.strip() or "member",
        "color": color,
        "is_primary": False,
        "created_at": now_iso(),
    }
    await db.members.insert_one(document)
    return Member(**document)


@api_router.patch("/members/{member_id}", response_model=Member)
async def update_member(member_id: str, input: MemberUpdate):
    updates = input.model_dump(exclude_none=True)
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if not updates:
        raise HTTPException(status_code=400, detail="No changes supplied")
    result = await db.members.update_one({"id": member_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    document = await db.members.find_one({"id": member_id}, {"_id": 0})
    return Member(**document)


@api_router.delete("/members/{member_id}")
async def remove_member(member_id: str):
    document = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Member not found")
    if document.get("is_primary"):
        raise HTTPException(status_code=400, detail="Primary member cannot be removed")
    await db.members.delete_one({"id": member_id})
    await db.medicines.update_many({"member_id": member_id}, {"$set": {"member_id": None}})
    return {"ok": True}


@api_router.get("/medicines", response_model=List[Medicine])
async def list_medicines(active_only: bool = True, member_id: Optional[str] = None):
    query: dict = {}
    if active_only:
        query["active"] = True
    if member_id is not None:
        query["member_id"] = member_id
    documents = await db.medicines.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Medicine(**document) for document in documents]


@api_router.post("/medicines", response_model=Medicine)
async def create_medicine(input: MedicineCreate):
    if not input.times:
        raise HTTPException(status_code=422, detail="Add at least one reminder time")
    days = input.days or list(DEFAULT_DAYS)
    document = {
        "id": str(uuid.uuid4()),
        "name": input.name.strip(),
        "dosage": input.dosage.strip(),
        "frequency": input.frequency.strip() or "Daily",
        "times": input.times,
        "instructions": input.instructions.strip(),
        "quantity_total": input.quantity_total,
        "quantity_remaining": input.quantity_total,
        "identification_cue": input.identification_cue.strip(),
        "image_url": input.image_url.strip(),
        "active": True,
        "member_id": input.member_id,
        "days": days,
        "created_at": now_iso(),
    }
    await db.medicines.insert_one(document)
    return Medicine(**document)


@api_router.patch("/medicines/{medicine_id}", response_model=Medicine)
async def update_medicine(medicine_id: str, input: MedicineUpdate):
    updates = input.model_dump(exclude_unset=True)
    for field in ("name", "dosage", "instructions", "identification_cue", "image_url"):
        if field in updates and isinstance(updates[field], str):
            updates[field] = updates[field].strip()
    if not updates:
        raise HTTPException(status_code=400, detail="No changes supplied")
    result = await db.medicines.update_one({"id": medicine_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    document = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    return Medicine(**document)


@api_router.post("/medicines/{medicine_id}/refill", response_model=Medicine)
async def refill_medicine(medicine_id: str, quantity: int = Query(..., ge=1, le=10000)):
    medicine = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    new_quantity = int(medicine.get("quantity_remaining", 0)) + quantity
    new_total = max(int(medicine.get("quantity_total", 0)), new_quantity)
    await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": {"quantity_remaining": new_quantity, "quantity_total": new_total}},
    )
    document = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    return Medicine(**document)


@api_router.delete("/medicines/{medicine_id}")
async def archive_medicine(medicine_id: str):
    result = await db.medicines.update_one({"id": medicine_id, "active": True}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"ok": True}


@api_router.post("/medicines/{medicine_id}/restore", response_model=Medicine)
async def restore_medicine(medicine_id: str):
    result = await db.medicines.update_one({"id": medicine_id, "active": False}, {"$set": {"active": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not archived")
    document = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    return Medicine(**document)


def _dose_matches_day(medicine: dict, weekday: int) -> bool:
    days = medicine.get("days") or list(DEFAULT_DAYS)
    return weekday in days


@api_router.get("/today", response_model=TodayResponse)
async def today(member_id: Optional[str] = None):
    today_value = local_date()
    weekday = datetime.now().weekday()
    medicine_query: dict = {"active": True}
    if member_id is not None:
        medicine_query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    medicines = await db.medicines.find(medicine_query, {"_id": 0}).to_list(500)
    logs = await db.dose_logs.find({"local_date": today_value}, {"_id": 0}).to_list(600)
    log_index = {(log["medicine_id"], log["time"]): log for log in logs}
    members_map = await load_members_map()
    doses: List[TodayDose] = []
    for medicine in medicines:
        if not _dose_matches_day(medicine, weekday):
            continue
        member = members_map.get(medicine.get("member_id") or "")
        for time in medicine.get("times", []):
            log = log_index.get((medicine["id"], time))
            doses.append(
                TodayDose(
                    dose_id=f'{medicine["id"]}:{today_value}:{time}',
                    medicine_id=medicine["id"],
                    medicine_name=medicine["name"],
                    dosage=medicine["dosage"],
                    instructions=medicine.get("instructions", ""),
                    time=time,
                    time_slot=time_slot(time),
                    member_id=medicine.get("member_id"),
                    member_name=member.get("name", "") if member else "",
                    identification_cue=medicine.get("identification_cue", ""),
                    image_url=medicine.get("image_url", ""),
                    logged_at=log.get("logged_at") if log else None,
                    log_id=log.get("id") if log else None,
                )
            )
    doses.sort(key=lambda dose: dose.time)
    return TodayResponse(date=today_value, doses=doses)


@api_router.post("/medicines/{medicine_id}/dose", response_model=DoseLog)
async def log_dose(medicine_id: str, input: DoseLogCreate):
    medicine = await db.medicines.find_one({"id": medicine_id, "active": True}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    date_value = local_date()
    existing = await db.dose_logs.find_one(
        {"medicine_id": medicine_id, "time": input.time, "local_date": date_value}, {"_id": 0}
    )
    if existing:
        return DoseLog(**existing)
    document = {
        "id": str(uuid.uuid4()),
        "medicine_id": medicine_id,
        "medicine_name": medicine["name"],
        "dosage": medicine["dosage"],
        "time": input.time,
        "logged_at": now_iso(),
        "local_date": date_value,
        "member_id": medicine.get("member_id"),
    }
    await db.dose_logs.insert_one(document)
    if int(medicine.get("quantity_remaining", 0)) > 0:
        await db.medicines.update_one({"id": medicine_id}, {"$inc": {"quantity_remaining": -1}})
    return DoseLog(**document)


@api_router.delete("/medicines/{medicine_id}/dose")
async def undo_dose(medicine_id: str, time: str = Query(...), date: Optional[str] = None):
    date_value = date or local_date()
    result = await db.dose_logs.find_one_and_delete(
        {"medicine_id": medicine_id, "time": time, "local_date": date_value}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Dose log not found")
    await db.medicines.update_one(
        {"id": medicine_id, "quantity_remaining": {"$lt": 10000}},
        {"$inc": {"quantity_remaining": 1}},
    )
    return {"ok": True}


@api_router.get("/doses/history", response_model=List[DoseLog])
async def dose_history(
    limit: int = Query(default=200, ge=1, le=500),
    member_id: Optional[str] = None,
    medicine_id: Optional[str] = None,
    date: Optional[str] = None,
):
    query: dict = {}
    if member_id is not None:
        query["member_id"] = member_id
    if medicine_id is not None:
        query["medicine_id"] = medicine_id
    if date is not None:
        query["local_date"] = date
    documents = await db.dose_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(limit)
    return [DoseLog(**document) for document in documents]


@api_router.get("/checkups", response_model=List[Checkup])
async def list_checkups(member_id: Optional[str] = None):
    query: dict = {}
    if member_id is not None:
        query["member_id"] = member_id
    documents = await db.checkups.find(query, {"_id": 0}).sort("scheduled_at", 1).to_list(200)
    return [Checkup(**document) for document in documents]


@api_router.post("/checkups", response_model=Checkup)
async def create_checkup(input: CheckupCreate):
    try:
        datetime.fromisoformat(input.scheduled_at.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid scheduled_at (use ISO format)") from e
    document = {
        "id": str(uuid.uuid4()),
        "title": input.title.strip(),
        "doctor": input.doctor.strip(),
        "location": input.location.strip(),
        "scheduled_at": input.scheduled_at,
        "notes": input.notes.strip(),
        "member_id": input.member_id,
        "created_at": now_iso(),
    }
    await db.checkups.insert_one(document)
    return Checkup(**document)


@api_router.patch("/checkups/{checkup_id}", response_model=Checkup)
async def update_checkup(checkup_id: str, input: CheckupUpdate):
    updates = input.model_dump(exclude_unset=True)
    for field in ("title", "doctor", "location", "notes"):
        if field in updates and isinstance(updates[field], str):
            updates[field] = updates[field].strip()
    if "scheduled_at" in updates and updates["scheduled_at"]:
        try:
            datetime.fromisoformat(updates["scheduled_at"].replace("Z", "+00:00"))
        except ValueError as e:
            raise HTTPException(status_code=422, detail="Invalid scheduled_at") from e
    if not updates:
        raise HTTPException(status_code=400, detail="No changes supplied")
    result = await db.checkups.update_one({"id": checkup_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Checkup not found")
    document = await db.checkups.find_one({"id": checkup_id}, {"_id": 0})
    return Checkup(**document)


@api_router.delete("/checkups/{checkup_id}")
async def remove_checkup(checkup_id: str):
    result = await db.checkups.delete_one({"id": checkup_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Checkup not found")
    return {"ok": True}


@api_router.get("/notifications/preferences", response_model=NotificationPreference)
async def notification_preferences():
    document = await db.settings.find_one({"id": "notifications"}, {"_id": 0})
    if not document:
        return NotificationPreference()
    document.pop("id", None)
    return NotificationPreference(**document)


@api_router.put("/notifications/preferences", response_model=NotificationPreference)
async def save_notification_preferences(input: NotificationPreference):
    payload = input.model_dump()
    await db.settings.update_one(
        {"id": "notifications"},
        {"$set": {**payload, "id": "notifications"}},
        upsert=True,
    )
    return NotificationPreference(**payload)


@api_router.get("/attention", response_model=AttentionResponse)
async def attention():
    today_value = local_date()
    weekday = datetime.now().weekday()
    now = datetime.now()
    items: List[AttentionItem] = []
    medicines_map = await load_medicines_map()
    members_map = await load_members_map()
    logs = await db.dose_logs.find({"local_date": today_value}, {"_id": 0}).to_list(600)
    log_index = {(log["medicine_id"], log["time"]) for log in logs}
    for medicine in medicines_map.values():
        if not medicine.get("active", True):
            continue
        if not _dose_matches_day(medicine, weekday):
            continue
        for time in medicine.get("times", []):
            if (medicine["id"], time) in log_index:
                continue
            hour, minute = (int(value) for value in time.split(":"))
            scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            delta = (now - scheduled).total_seconds() / 60
            member = members_map.get(medicine.get("member_id") or "")
            owner = f" · {member['name']}" if member else ""
            if delta >= 180:
                items.append(
                    AttentionItem(
                        id=f"missed:{medicine['id']}:{time}:{today_value}",
                        kind="missed-dose",
                        title=f"Missed dose · {medicine['name']}",
                        detail=f"{medicine.get('dosage','')} at {time}{owner}",
                        when=scheduled.isoformat(),
                        medicine_id=medicine["id"],
                        member_id=medicine.get("member_id"),
                    )
                )
            elif delta >= 15:
                items.append(
                    AttentionItem(
                        id=f"late:{medicine['id']}:{time}:{today_value}",
                        kind="late-dose",
                        title=f"Late dose · {medicine['name']}",
                        detail=f"{medicine.get('dosage','')} was due at {time}{owner}",
                        when=scheduled.isoformat(),
                        medicine_id=medicine["id"],
                        member_id=medicine.get("member_id"),
                    )
                )
        if int(medicine.get("quantity_remaining", 0)) <= 3 and int(medicine.get("quantity_total", 0)) > 0:
            member = members_map.get(medicine.get("member_id") or "")
            owner = f" · {member['name']}" if member else ""
            items.append(
                AttentionItem(
                    id=f"refill:{medicine['id']}",
                    kind="refill",
                    title=f"Refill soon · {medicine['name']}",
                    detail=f"{medicine.get('quantity_remaining', 0)} left{owner}",
                    when=now.isoformat(),
                    medicine_id=medicine["id"],
                    member_id=medicine.get("member_id"),
                )
            )
    upcoming_horizon = now + timedelta(hours=48)
    checkups = await db.checkups.find({}, {"_id": 0}).to_list(200)
    for checkup in checkups:
        try:
            scheduled = datetime.fromisoformat(checkup["scheduled_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        except (KeyError, ValueError):
            continue
        if now <= scheduled <= upcoming_horizon:
            member = members_map.get(checkup.get("member_id") or "")
            owner = f" · {member['name']}" if member else ""
            items.append(
                AttentionItem(
                    id=f"checkup:{checkup['id']}",
                    kind="checkup",
                    title=f"Upcoming checkup · {checkup['title']}",
                    detail=f"{scheduled.strftime('%a %d %b · %H:%M')}{owner}",
                    when=checkup["scheduled_at"],
                    checkup_id=checkup["id"],
                    member_id=checkup.get("member_id"),
                )
            )
    items.sort(key=lambda item: item.when)
    return AttentionResponse(items=items)


@api_router.get("/upcoming-checkup", response_model=Optional[Checkup])
async def upcoming_checkup(member_id: Optional[str] = None):
    now = datetime.now()
    query: dict = {}
    if member_id is not None:
        query["member_id"] = member_id
    documents = await db.checkups.find(query, {"_id": 0}).sort("scheduled_at", 1).to_list(50)
    for document in documents:
        try:
            scheduled = datetime.fromisoformat(document["scheduled_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        except (KeyError, ValueError):
            continue
        if scheduled >= now:
            return Checkup(**document)
    return None


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
