from datetime import datetime, timezone
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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def local_date() -> str:
    return datetime.now().date().isoformat()


class MedicineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dosage: str = Field(min_length=1, max_length=40)
    frequency: str = Field(default="Daily", max_length=30)
    times: List[str] = Field(min_length=1, max_length=6)
    instructions: str = Field(default="", max_length=180)
    quantity_total: int = Field(default=0, ge=0, le=10000)


class Medicine(BaseModel):
    id: str
    name: str
    dosage: str
    frequency: str
    times: List[str]
    instructions: str
    quantity_total: int
    quantity_remaining: int
    active: bool
    created_at: str


class MedicineUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    dosage: Optional[str] = Field(default=None, min_length=1, max_length=40)
    frequency: Optional[str] = Field(default=None, max_length=30)
    times: Optional[List[str]] = Field(default=None, min_length=1, max_length=6)
    instructions: Optional[str] = Field(default=None, max_length=180)
    quantity_total: Optional[int] = Field(default=None, ge=0, le=10000)
    quantity_remaining: Optional[int] = Field(default=None, ge=0, le=10000)


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


class TodayDose(BaseModel):
    dose_id: str
    medicine_id: str
    medicine_name: str
    dosage: str
    time: str
    instructions: str
    status: str


class TodayResponse(BaseModel):
    date: str
    doses: List[TodayDose]


def medicine_from_document(document: dict) -> Medicine:
    return Medicine(**document)


@api_router.get("/")
async def root():
    return {"message": "DawaiSathi API is ready"}


@api_router.get("/medicines", response_model=List[Medicine])
async def list_medicines(active_only: bool = True):
    query = {"active": True} if active_only else {}
    documents = await db.medicines.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [medicine_from_document(document) for document in documents]


@api_router.post("/medicines", response_model=Medicine)
async def create_medicine(input: MedicineCreate):
    if not input.times:
        raise HTTPException(status_code=422, detail="Add at least one reminder time")
    document = {
        "id": str(uuid.uuid4()),
        "name": input.name.strip(),
        "dosage": input.dosage.strip(),
        "frequency": input.frequency.strip() or "Daily",
        "times": input.times,
        "instructions": input.instructions.strip(),
        "quantity_total": input.quantity_total,
        "quantity_remaining": input.quantity_total,
        "active": True,
        "created_at": now_iso(),
    }
    await db.medicines.insert_one(document)
    return medicine_from_document(document)


@api_router.patch("/medicines/{medicine_id}", response_model=Medicine)
async def update_medicine(medicine_id: str, input: MedicineUpdate):
    updates = input.model_dump(exclude_none=True)
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if "dosage" in updates:
        updates["dosage"] = updates["dosage"].strip()
    if "instructions" in updates:
        updates["instructions"] = updates["instructions"].strip()
    if not updates:
        raise HTTPException(status_code=400, detail="No changes supplied")
    result = await db.medicines.update_one({"id": medicine_id, "active": True}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    document = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    return medicine_from_document(document)


@api_router.delete("/medicines/{medicine_id}")
async def archive_medicine(medicine_id: str):
    result = await db.medicines.update_one({"id": medicine_id, "active": True}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"ok": True}


@api_router.get("/today", response_model=TodayResponse)
async def today():
    today_value = local_date()
    medicines = await db.medicines.find({"active": True}, {"_id": 0}).to_list(100)
    logs = await db.dose_logs.find({"local_date": today_value}, {"_id": 0}).to_list(300)
    logged = {(log["medicine_id"], log["time"]) for log in logs}
    doses = []
    for medicine in medicines:
        for time in medicine.get("times", []):
            doses.append(
                TodayDose(
                    dose_id=f'{medicine["id"]}:{today_value}:{time}',
                    medicine_id=medicine["id"],
                    medicine_name=medicine["name"],
                    dosage=medicine["dosage"],
                    time=time,
                    instructions=medicine.get("instructions", ""),
                    status="taken" if (medicine["id"], time) in logged else "upcoming",
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
    }
    await db.dose_logs.insert_one(document)
    if medicine.get("quantity_remaining", 0) > 0:
        await db.medicines.update_one({"id": medicine_id}, {"$inc": {"quantity_remaining": -1}})
    return DoseLog(**document)


@api_router.get("/doses/history", response_model=List[DoseLog])
async def dose_history(limit: int = Query(default=100, ge=1, le=300)):
    documents = await db.dose_logs.find({}, {"_id": 0}).sort("logged_at", -1).to_list(limit)
    return [DoseLog(**document) for document in documents]


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