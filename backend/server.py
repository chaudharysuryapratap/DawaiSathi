from pymongo.errors import DuplicateKeyError
from base64 import b64decode
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from typing import Annotated, List, Literal, Optional
import bcrypt
import binascii
import hmac
import logging
import os
import secrets
import uuid
import re

import jwt
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordBearer
from pydantic import EmailStr
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
DEFAULT_CORS_ORIGINS = (
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
    "http://localhost:8082",
    "http://127.0.0.1:8082",
)
cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
    if origin.strip()
]
AUTH_SECRET = os.environ.get("DAWAISATHI_AUTH_SECRET")
BOOTSTRAP_TOKEN = os.environ.get("DAWAISATHI_BOOTSTRAP_TOKEN")
GOOGLE_WEB_CLIENT_ID = os.environ.get("GOOGLE_WEB_CLIENT_ID", "").strip()
MEDIA_ROOT = Path(
    os.environ.get("DAWAISATHI_MEDIA_DIR", ROOT_DIR / "data" / "medicine-images")
).resolve()
MAX_MEDICINE_IMAGE_BYTES = 5 * 1024 * 1024
MEDICINE_IMAGE_TYPES = {
    "image/jpeg": ("jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": ("png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        "webp",
        lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    ),
}

app = FastAPI(title="DawaiSathi API")
ACTIVE_FAMILY = {"deleted_at": {"$exists": False}}
FAMILY_RECOVERY_DAYS = 30
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def require_authenticated_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    if not AUTH_SECRET or len(AUTH_SECRET.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Sign in to access DawaiSathi",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = jwt.decode(token, AUTH_SECRET, algorithms=["HS256"])
        user_id = claims.get("sub")
    except jwt.PyJWTError as error:
        raise HTTPException(
            status_code=401,
            detail="Your session is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Your session is no longer valid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    groups = await db.family_groups.find(
        {"user_ids": user["id"], **ACTIVE_FAMILY},
        {"_id": 0, "id": 1},
    ).to_list(100)
    user["family_group_ids"] = [group["id"] for group in groups]
    request.state.user = user
    return user


async def authorize_request_scope(
    request: Request,
    user: dict = Depends(require_authenticated_user),
) -> None:
    path_params = request.path_params
    if request.method == "GET" and request.url.path == "/api/family-groups/deleted":
        return  # The handler lists only this account's recoverable families.
    if request.method == "POST" and request.url.path.endswith("/restore") and path_params.get("family_group_id"):
        group = await db.family_groups.find_one({"id": path_params["family_group_id"], "owner_user_id": user["id"]})
        if not group:
            raise HTTPException(status_code=403, detail="Only the family owner can restore this group")
        return
    query_group_id = request.query_params.get("family_group_id")
    group_id = path_params.get("family_group_id") or query_group_id
    payload = {}
    if request.method in {"POST", "PUT", "PATCH"}:
        try:
            payload = await request.json()
        except (ValueError, RuntimeError):
            payload = {}
        if isinstance(payload, dict):
            group_id = payload.get("family_group_id") or group_id

    if group_id:
        group = await db.family_groups.find_one(
            {"id": group_id, "user_ids": user["id"], **ACTIVE_FAMILY},
            {"_id": 0},
        )
        if not group:
            raise HTTPException(status_code=403, detail="You do not have access to this family group")
        if path_params.get("member_id"):
            member = await db.members.find_one({"id": path_params["member_id"], "family_group_ids": group_id})
            if not member:
                raise HTTPException(status_code=404, detail="Member not found in this family")
            if request.method == "DELETE" and group.get("owner_user_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Only the family owner can remove a profile")
        if path_params.get("family_group_id") and request.method == "PATCH":
            if group.get("owner_user_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Only the family owner can rename this group")
        if path_params.get("family_group_id") and request.url.path.endswith("/invites"):
            if group.get("owner_user_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Only the family owner can invite people")
        member_id = payload.get("member_id")
        if member_id and not await db.members.find_one(
            {"id": member_id, "family_group_ids": group_id},
            {"_id": 0, "id": 1},
        ):
            raise HTTPException(status_code=422, detail="Member does not belong to the selected family group")
        if not any(path_params.get(parameter) for parameter in ("medicine_id", "protocol_id", "checkup_id")):
            return

    entity_params = (
        ("medicine_id", "medicines"),
        ("protocol_id", "eye_drop_protocols"),
        ("checkup_id", "checkups"),
    )
    for parameter, collection_name in entity_params:
        entity_id = path_params.get(parameter)
        if entity_id:
            entity = await getattr(db, collection_name).find_one(
                {"id": entity_id},
                {"_id": 0, "family_group_id": 1},
            )
            if not entity:
                raise HTTPException(status_code=404, detail="Record not found")
            if not await db.family_groups.find_one(
                {"id": entity.get("family_group_id"), "user_ids": user["id"], **ACTIVE_FAMILY},
                {"_id": 0, "id": 1},
            ):
                raise HTTPException(status_code=403, detail="You do not have access to this family group")
            target_group_id = payload.get("family_group_id")
            if target_group_id and not await db.family_groups.find_one(
                {"id": target_group_id, "user_ids": user["id"], **ACTIVE_FAMILY},
                {"_id": 0, "id": 1},
            ):
                raise HTTPException(status_code=403, detail="You do not have access to the target family group")
            target_member_id = payload.get("member_id")
            if target_member_id and not await db.members.find_one(
                {
                    "id": target_member_id,
                    "family_group_ids": target_group_id or entity.get("family_group_id"),
                },
                {"_id": 0, "id": 1},
            ):
                raise HTTPException(status_code=422, detail="Member does not belong to the selected family group")
            return

    member_id = path_params.get("member_id")
    if member_id:
        member = await db.members.find_one(
            {"id": member_id, "family_group_ids": {"$in": user.get("family_group_ids", [])}},
            {"_id": 0, "id": 1, "family_group_ids": 1},
        )
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        if request.method in {"PATCH", "DELETE"}:
            groups = await db.family_groups.find(
                {"id": {"$in": member.get("family_group_ids", [])}},
                {"_id": 0, "owner_user_id": 1},
            ).to_list(100)
            if not groups or any(group.get("owner_user_id") != user["id"] for group in groups):
                raise HTTPException(
                    status_code=403,
                    detail="Only the owners of every associated family can edit or remove this profile",
                )
        return

    if request.url.path.endswith(("/family-invitations/accept", "/family-code/accept")):
        return
    if request.method == "GET" and request.url.path.endswith("/family-groups"):
        return
    if request.method == "POST" and request.url.path.endswith("/family-groups"):
        return
    if request.url.path.endswith("/members") and not group_id:
        return
    if request.url.path.endswith(("/medicine-images", "/voice-notes")):
        return
    if request.url.path.endswith("/notifications/preferences"):
        return
    if request.url.path.rstrip("/").endswith("/api"):
        return

    if request.method in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
        raise HTTPException(status_code=422, detail="A family group is required for this request")



VOICE_MEDIA_ROOT = Path(os.environ.get("DAWAISATHI_VOICE_MEDIA_DIR", ROOT_DIR / "data" / "voice-notes")).resolve()
VOICE_MAX_BYTES = 5 * 1024 * 1024


async def can_access_voice_note(url: str, user: dict) -> bool:
    if await db.voice_notes.find_one({"voice_note_url": url, "owner_user_id": user["id"]}):
        return True
    query = {"voice_note_url": url, "family_group_id": {"$in": user.get("family_group_ids", [])}}
    for collection in (db.medicines, db.checkups, db.eye_drop_protocols):
        if await collection.find_one(query, {"_id": 0, "id": 1}):
            return True
    return False


async def validate_voice_attachment(request: Request, user: dict = Depends(require_authenticated_user)):
    if request.method not in ("POST", "PATCH") or not request.url.path.startswith(
        ("/api/medicines", "/api/checkups", "/api/eye-drop-protocols")
    ):
        return
    try:
        body = await request.json()
    except ValueError:
        return
    if not isinstance(body, dict):
        return
    url = body.get("voice_note_url")
    if url is None or url == "":
        return
    if not isinstance(url, str) or not url.startswith("/media/voice-notes/") or not await can_access_voice_note(url, user):
        raise HTTPException(status_code=422, detail="Choose a voice note you have access to")


api_router = APIRouter(
    prefix="/api",
    dependencies=[Depends(require_authenticated_user), Depends(authorize_request_scope), Depends(validate_voice_attachment)],
)
auth_router = APIRouter(prefix="/api/auth")

MEMBER_COLORS = ["#3B7A57", "#C67D0A", "#2B6CB0", "#8E4EC6", "#BA1A1A", "#0EA5A0"]
DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6]
EYE_VALUES = {"left", "right", "both"}
TimeValue = Annotated[str, Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")]


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


def add_minutes_to_time(start: str, minutes: int) -> str:
    hour, minute = (int(value) for value in start.split(":"))
    total = hour * 60 + minute + minutes
    total = total % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


class FamilyGroup(BaseModel):
    id: str
    name: str
    owner_user_id: Optional[str] = None
    member_ids: List[str] = Field(default_factory=list)
    member_count: int = 0
    created_at: str
    updated_at: str


class FamilyGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    role: str = Field(default="member", pattern="^(member|care_taker)$")


class FamilyGroupUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class Member(BaseModel):
    id: str
    name: str
    role: str = "member"
    email: Optional[str] = None
    relationship: str = ""
    user_id: Optional[str] = None
    color: str
    is_primary: bool = False
    family_group_ids: List[str] = Field(default_factory=list)
    created_at: str


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    role: str = Field(default="member", max_length=30)
    family_group_id: Optional[str] = None


class MemberUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=40)
    role: Optional[str] = Field(default=None, max_length=30)


class MedicineCreate(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    name: str = Field(min_length=1, max_length=80)
    dosage: str = Field(min_length=1, max_length=40)
    frequency: str = Field(default="Daily", max_length=30)
    times: List[TimeValue] = Field(min_length=1, max_length=6)
    instructions: str = Field(default="", max_length=180)
    quantity_total: int = Field(default=0, ge=0, le=10000)
    identification_cue: str = Field(default="", max_length=120)
    image_url: str = Field(default="", max_length=500)
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None
    days: List[int] = Field(default_factory=lambda: list(DEFAULT_DAYS))


class Medicine(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
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
    family_group_id: Optional[str] = None
    days: List[int] = Field(default_factory=lambda: list(DEFAULT_DAYS))
    created_at: str


class MedicineUpdate(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    dosage: Optional[str] = Field(default=None, min_length=1, max_length=40)
    frequency: Optional[str] = Field(default=None, max_length=30)
    times: Optional[List[TimeValue]] = Field(default=None, min_length=1, max_length=6)
    instructions: Optional[str] = Field(default=None, max_length=180)
    quantity_total: Optional[int] = Field(default=None, ge=0, le=10000)
    quantity_remaining: Optional[int] = Field(default=None, ge=0, le=10000)
    identification_cue: Optional[str] = Field(default=None, max_length=120)
    image_url: Optional[str] = Field(default=None, max_length=500)
    member_id: Optional[str] = None
    days: Optional[List[int]] = None
    family_group_id: Optional[str] = None
    active: Optional[bool] = None


class MedicineImageUpload(BaseModel):
    content_type: str = Field(min_length=1, max_length=40)
    image_base64: str = Field(min_length=1, max_length=7_000_000)


class MedicineImageResponse(BaseModel):
    image_url: str


class AccountRegistration(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    name: str = Field(min_length=1, max_length=60)
    bootstrap_token: Optional[str] = Field(default=None, max_length=200)
    invitation_token: Optional[str] = Field(default=None, max_length=200)


class AccountLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class GoogleAccountLogin(BaseModel):
    id_token: str = Field(min_length=1, max_length=10000)
    password: Optional[str] = Field(default=None, max_length=72)
    bootstrap_token: Optional[str] = Field(default=None, max_length=200)
    invitation_token: Optional[str] = Field(default=None, max_length=200)


def verify_google_identity(token: str) -> dict:
    if not GOOGLE_WEB_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured yet. Please use email.")
    try:
        claims = google_id_token.verify_oauth2_token(
            token,
            lambda *args, **kwargs: GoogleRequest()(*args, **{**kwargs, "timeout": 10}),
            GOOGLE_WEB_CLIENT_ID,
        )
    except TransportError as error:
        raise HTTPException(status_code=503, detail="Google could not be reached. Try again.") from error
    except (ValueError, GoogleAuthError) as error:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Try again.") from error
    if not claims.get("sub") or claims.get("email_verified") is not True or not claims.get("email"):
        raise HTTPException(status_code=401, detail="A verified Google email is required.")
    return claims


class Account(BaseModel):
    id: str
    email: EmailStr
    name: str
    is_owner: bool
    created_at: str


class AccountSession(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Account


class FamilyInvitationCreate(BaseModel):
    email: EmailStr


class FamilyInvitation(BaseModel):
    email: EmailStr
    family_group_id: str
    token: str
    expires_at: str


class FamilyInvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=200)


def _account_public(user: dict) -> Account:
    return Account(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        is_owner=bool(user.get("is_owner")),
        created_at=user["created_at"],
    )


def _issue_session(user: dict) -> AccountSession:
    if not AUTH_SECRET or len(AUTH_SECRET.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Set DAWAISATHI_AUTH_SECRET to at least 32 characters")
    token = jwt.encode(
        {
            "sub": user["id"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        },
        AUTH_SECRET,
        algorithm="HS256",
    )
    return AccountSession(access_token=token, user=_account_public(user))


async def _invitation_for_token(token: str, email: str) -> dict:
    collection = db.management_invites if token.startswith("FAM-") else db.family_invitations
    invitation = await collection.find_one(
        {"token_hash": sha256(token.encode("utf-8")).hexdigest(), "used_at": None, "cancelled_at": {"$exists": False}},
        {"_id": 0},
    )
    if not invitation or (invitation.get("email") and invitation["email"] != email):
        raise HTTPException(status_code=404, detail="Invitation not found for this email")
    if datetime.fromisoformat(invitation["expires_at"]) <= now_utc():
        raise HTTPException(status_code=410, detail="This invitation has expired")
    if token.startswith("FAM-"):
        invitation["management_invite"] = True
    return invitation


class DoseLogCreate(BaseModel):
    time: TimeValue


class DoseLog(BaseModel):
    id: str
    medicine_id: str
    medicine_name: str
    dosage: str
    time: str
    logged_at: str
    local_date: str
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None


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


# ---------------------------------------------------------------------------
# Staggered eye-drop protocols
# ---------------------------------------------------------------------------


class EyeDropStepInput(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=80)
    dose: str = Field(default="1 drop", max_length=40)
    eye: str = Field(default="both", max_length=10)


class EyeDropStep(BaseModel):
    order: int
    medicine_name: str
    dose: str
    eye: str


class EyeDropProtocolCreate(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    name: str = Field(min_length=1, max_length=80)
    start_time: str = Field(min_length=1, max_length=10)
    interval_minutes: int = Field(default=5, ge=1, le=180)
    steps: List[EyeDropStepInput] = Field(min_length=1, max_length=12)
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None
    days: List[int] = Field(default_factory=lambda: list(DEFAULT_DAYS))


class EyeDropProtocolUpdate(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    start_time: Optional[str] = Field(default=None, min_length=1, max_length=10)
    interval_minutes: Optional[int] = Field(default=None, ge=1, le=180)
    steps: Optional[List[EyeDropStepInput]] = Field(default=None, min_length=1, max_length=12)
    member_id: Optional[str] = None
    days: Optional[List[int]] = None
    family_group_id: Optional[str] = None
    active: Optional[bool] = None


class EyeDropProtocol(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    id: str
    name: str
    start_time: str
    interval_minutes: int
    steps: List[EyeDropStep]
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None
    days: List[int]
    active: bool = True
    created_at: str


class ProtocolStepLog(BaseModel):
    id: str
    protocol_id: str
    protocol_name: str
    step_order: int
    medicine_name: str
    dose: str
    eye: str
    time: str
    logged_at: str
    local_date: str
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None


class MissedDoseEvent(BaseModel):
    id: str
    event_key: str
    source_type: Literal["medicine", "protocol_step"]
    medicine_id: Optional[str] = None
    protocol_id: Optional[str] = None
    protocol_name: Optional[str] = None
    step_order: Optional[int] = None
    medicine_name: str
    dosage: str
    time: str
    detected_at: str
    local_date: str
    member_id: Optional[str] = None
    family_group_id: str


class TodayProtocolStep(BaseModel):
    order: int
    medicine_name: str
    dose: str
    eye: str
    time: str
    logged_at: Optional[str] = None
    log_id: Optional[str] = None


class TodayProtocol(BaseModel):
    protocol_id: str
    name: str
    start_time: str
    end_time: str
    interval_minutes: int
    time_slot: str
    member_id: Optional[str] = None
    member_name: str = ""
    steps: List[TodayProtocolStep]


class TodayResponse(BaseModel):
    date: str
    doses: List[TodayDose]
    protocols: List[TodayProtocol] = Field(default_factory=list)
    missed_doses: List[MissedDoseEvent] = Field(default_factory=list)


class CheckupCreate(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    title: str = Field(min_length=1, max_length=120)
    doctor: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=120)
    scheduled_at: str
    notes: str = Field(default="", max_length=400)
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None


class CheckupUpdate(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    doctor: Optional[str] = Field(default=None, max_length=80)
    location: Optional[str] = Field(default=None, max_length=120)
    scheduled_at: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=400)
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None


class Checkup(BaseModel):
    voice_note_url: str = Field(default="", max_length=500)
    id: str
    title: str
    doctor: str
    location: str
    scheduled_at: str
    notes: str
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None
    created_at: str


class AttentionItem(BaseModel):
    id: str
    kind: str
    title: str
    detail: str
    when: str
    medicine_id: Optional[str] = None
    checkup_id: Optional[str] = None
    protocol_id: Optional[str] = None
    member_id: Optional[str] = None
    family_group_id: Optional[str] = None


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
            "family_group_ids": [],
            "created_at": now_iso(),
        }
        await db.members.insert_one(member)


async def ensure_family_groups() -> None:
    await ensure_primary_member()
    first_group = await db.family_groups.find_one({}, {"_id": 0}, sort=[("created_at", 1)])
    if not first_group:
        now = now_iso()
        first_group = {
            "id": str(uuid.uuid4()),
            "name": "My Family",
            "member_ids": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.family_groups.insert_one(first_group)

    default_group_id = first_group["id"]
    if first_group.get("deleted_at"):
        return  # Never migrate records into a deleted family or recreate it.
    await db.members.update_many(
        {"family_group_ids": {"$exists": False}},
        {"$set": {"family_group_ids": [default_group_id]}},
    )
    await db.members.update_many(
        {"family_group_ids": {"$size": 0}, "explicit_membership": {"$ne": True}},
        {"$set": {"family_group_ids": [default_group_id]}},
    )
    member_ids = [
        doc["id"]
        for doc in await db.members.find(
            {"family_group_ids": default_group_id},
            {"_id": 0, "id": 1},
        ).to_list(500)
    ]
    await db.family_groups.update_one(
        {"id": default_group_id},
        {"$set": {"member_ids": member_ids, "updated_at": now_iso()}},
    )

    for collection in ("medicines", "eye_drop_protocols", "checkups", "dose_logs", "protocol_step_logs"):
        await db[collection].update_many(
            {"family_group_id": {"$exists": False}},
            {"$set": {"family_group_id": default_group_id}},
        )


async def get_family_group(group_id: str) -> dict:
    group = await db.family_groups.find_one({"id": group_id, **ACTIVE_FAMILY}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Family group not found")
    return group


async def default_family_group_id() -> str:
    await ensure_family_groups()
    group = await db.family_groups.find_one(ACTIVE_FAMILY, {"_id": 0}, sort=[("created_at", 1)])
    if not group:
        raise HTTPException(status_code=500, detail="Family group is not configured")
    return group["id"]


async def load_medicines_map(family_group_id: Optional[str] = None) -> dict:
    query = {"family_group_id": family_group_id} if family_group_id else {}
    documents = await db.medicines.find(query, {"_id": 0}).to_list(500)
    return {document["id"]: document for document in documents}


async def load_members_map(family_group_id: Optional[str] = None) -> dict:
    query = {"family_group_ids": family_group_id} if family_group_id else {}
    documents = await db.members.find(query, {"_id": 0}).to_list(200)
    return {document["id"]: document for document in documents}


def _dose_matches_day(medicine: dict, weekday: int) -> bool:
    days = medicine.get("days") or list(DEFAULT_DAYS)
    return weekday in days


def _sanitize_eye(value: str) -> str:
    normalised = (value or "both").strip().lower()
    return normalised if normalised in EYE_VALUES else "both"


def _build_protocol_steps(inputs: List[EyeDropStepInput]) -> List[dict]:
    return [
        {
            "order": index + 1,
            "medicine_name": step.medicine_name.strip(),
            "dose": step.dose.strip() or "1 drop",
            "eye": _sanitize_eye(step.eye),
        }
        for index, step in enumerate(inputs)
    ]


def _created_after_scheduled(document: dict, scheduled: datetime) -> bool:
    try:
        created = datetime.fromisoformat(document["created_at"].replace("Z", "+00:00"))
    except (KeyError, TypeError, ValueError):
        return True
    if created.tzinfo is not None:
        created = created.astimezone().replace(tzinfo=None)
    return created > scheduled


async def record_missed_doses(
    family_group_id: str,
    at: Optional[datetime] = None,
) -> List[MissedDoseEvent]:
    current = at or datetime.now()
    if current.tzinfo is not None:
        current = current.astimezone().replace(tzinfo=None)
    date_value = current.date().isoformat()
    weekday = current.weekday()
    threshold = timedelta(hours=3)

    medicines = await db.medicines.find(
        {"family_group_id": family_group_id, "active": True},
        {"_id": 0},
    ).to_list(500)
    dose_logs = await db.dose_logs.find(
        {"family_group_id": family_group_id, "local_date": date_value},
        {"_id": 0, "medicine_id": 1, "time": 1},
    ).to_list(1000)
    taken_doses = {(entry["medicine_id"], entry["time"]) for entry in dose_logs}

    for medicine in medicines:
        if not _dose_matches_day(medicine, weekday):
            continue
        for time_value in medicine.get("times", []):
            if (medicine["id"], time_value) in taken_doses:
                continue
            hour, minute = (int(value) for value in time_value.split(":"))
            scheduled = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if current <= scheduled or _created_after_scheduled(medicine, scheduled):
                continue
            event_key = f"medicine:{medicine['id']}:{time_value}:{date_value}"
            document = {
                "id": str(uuid.uuid4()),
                "event_key": event_key,
                "source_type": "medicine",
                "medicine_id": medicine["id"],
                "protocol_id": None,
                "protocol_name": None,
                "step_order": None,
                "medicine_name": medicine["name"],
                "dosage": medicine.get("dosage", ""),
                "time": time_value,
                "detected_at": now_utc().isoformat(),
                "local_date": date_value,
                "member_id": medicine.get("member_id"),
                "family_group_id": family_group_id,
            }
            try:
                await db.missed_dose_events.insert_one(document)
            except DuplicateKeyError:
                continue

    protocols = await db.eye_drop_protocols.find(
        {"family_group_id": family_group_id, "active": True},
        {"_id": 0},
    ).to_list(200)
    step_logs = await db.protocol_step_logs.find(
        {"family_group_id": family_group_id, "local_date": date_value},
        {"_id": 0, "protocol_id": 1, "step_order": 1},
    ).to_list(1000)
    taken_steps = {(entry["protocol_id"], entry["step_order"]) for entry in step_logs}

    for protocol in protocols:
        if not _dose_matches_day(protocol, weekday):
            continue
        for step in protocol.get("steps", []):
            order = int(step["order"])
            if (protocol["id"], order) in taken_steps:
                continue
            time_value = add_minutes_to_time(
                protocol["start_time"],
                protocol["interval_minutes"] * (order - 1),
            )
            hour, minute = (int(value) for value in time_value.split(":"))
            scheduled = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if current - scheduled < threshold or _created_after_scheduled(protocol, scheduled):
                continue
            event_key = f"protocol:{protocol['id']}:{order}:{date_value}"
            document = {
                "id": str(uuid.uuid4()),
                "event_key": event_key,
                "source_type": "protocol_step",
                "medicine_id": None,
                "protocol_id": protocol["id"],
                "protocol_name": protocol["name"],
                "step_order": order,
                "medicine_name": step["medicine_name"],
                "dosage": step.get("dose", "1 drop"),
                "time": time_value,
                "detected_at": now_utc().isoformat(),
                "local_date": date_value,
                "member_id": protocol.get("member_id"),
                "family_group_id": family_group_id,
            }
            try:
                await db.missed_dose_events.insert_one(document)
            except DuplicateKeyError:
                continue

    documents = await db.missed_dose_events.find(
        {"family_group_id": family_group_id, "local_date": date_value},
        {"_id": 0},
    ).sort([("time", 1), ("id", 1)]).to_list(1000)
    today_dose_logs = await db.dose_logs.find(
        {"family_group_id": family_group_id, "local_date": date_value},
        {"_id": 0, "medicine_id": 1, "time": 1},
    ).to_list(1000)
    current_dose_keys = {(entry["medicine_id"], entry["time"]) for entry in today_dose_logs}
    today_step_logs = await db.protocol_step_logs.find(
        {"family_group_id": family_group_id, "local_date": date_value},
        {"_id": 0, "protocol_id": 1, "step_order": 1},
    ).to_list(1000)
    current_step_keys = {(entry["protocol_id"], entry["step_order"]) for entry in today_step_logs}

    return [
        MissedDoseEvent(**document)
        for document in documents
        if (
            document["source_type"] == "medicine"
            and (document["medicine_id"], document["time"]) not in current_dose_keys
        )
        or (
            document["source_type"] == "protocol_step"
            and (document["protocol_id"], document["step_order"]) not in current_step_keys
        )
    ]


async def missed_dose_history(
    family_group_id: str,
    member_id: Optional[str] = None,
    limit: int = 500,
) -> List[MissedDoseEvent]:
    await record_missed_doses(family_group_id)
    query: dict = {"family_group_id": family_group_id}
    if member_id:
        query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    documents = await db.missed_dose_events.find(query, {"_id": 0}).sort(
        [("local_date", -1), ("time", -1)]
    ).to_list(limit)
    return await _missed_events_without_logs(documents)


async def _missed_events_without_logs(documents: List[dict]) -> List[MissedDoseEvent]:
    medicine_terms = [
        {
            "family_group_id": event["family_group_id"],
            "medicine_id": event["medicine_id"],
            "time": event["time"],
            "local_date": event["local_date"],
        }
        for event in documents
        if event["source_type"] == "medicine"
    ]
    protocol_terms = [
        {
            "family_group_id": event["family_group_id"],
            "protocol_id": event["protocol_id"],
            "step_order": event["step_order"],
            "local_date": event["local_date"],
        }
        for event in documents
        if event["source_type"] == "protocol_step"
    ]
    dose_logs = await db.dose_logs.find(
        {"$or": medicine_terms},
        {"_id": 0, "medicine_id": 1, "time": 1, "local_date": 1},
    ).to_list(1000) if medicine_terms else []
    step_logs = await db.protocol_step_logs.find(
        {"$or": protocol_terms},
        {"_id": 0, "protocol_id": 1, "step_order": 1, "local_date": 1},
    ).to_list(1000) if protocol_terms else []
    logged_doses = {
        (event["medicine_id"], event["time"], event["local_date"])
        for event in dose_logs
    }
    logged_steps = {
        (event["protocol_id"], event["step_order"], event["local_date"])
        for event in step_logs
    }
    return [
        MissedDoseEvent(**event)
        for event in documents
        if (
            event["source_type"] == "medicine"
            and (event["medicine_id"], event["time"], event["local_date"]) not in logged_doses
        )
        or (
            event["source_type"] == "protocol_step"
            and (event["protocol_id"], event["step_order"], event["local_date"]) not in logged_steps
        )
    ]


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_family_groups()

    await db.users.create_index("email", unique=True, name="uniq_user_email")
    await db.users.create_index("google_sub", unique=True, sparse=True, name="uniq_google_identity")
    await db.users.create_index(
        "is_owner",
        unique=True,
        partialFilterExpression={"is_owner": True},
        name="uniq_bootstrap_owner",
    )
    await db.family_groups.create_index("join_code", unique=True, sparse=True, name="uniq_family_join_code")
    await db.family_code_attempts.create_index("expires_at", expireAfterSeconds=0, name="expire_family_code_attempts")
    await db.family_invitations.create_index(
        "token_hash",
        unique=True,
        name="uniq_family_invitation_token",
    )
    await db.missed_dose_events.create_index(
        "event_key",
        unique=True,
        name="uniq_missed_dose_event",
    )
    await db.dose_logs.create_index(
        [
            ("medicine_id", 1),
            ("time", 1),
            ("local_date", 1),
        ],
        unique=True,
        name="uniq_medicine_time_date",
    )


@auth_router.post("/register", response_model=AccountSession)
async def register_account(input: AccountRegistration):
    return await _register_account(input)


async def _register_account(input: AccountRegistration, google_subject: Optional[str] = None):
    if not AUTH_SECRET or len(AUTH_SECRET.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    if len(input.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be no longer than 72 UTF-8 bytes")

    email = str(input.email).strip().lower()
    name = input.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=409, detail="An account already exists for this email")

    owner_registration = await db.users.count_documents({}) == 0
    invitation = None
    code_family = None
    if owner_registration:
        if not BOOTSTRAP_TOKEN:
            raise HTTPException(status_code=503, detail="Set the one-time bootstrap token before creating the owner account")
        if not input.bootstrap_token or not hmac.compare_digest(input.bootstrap_token, BOOTSTRAP_TOKEN):
            raise HTTPException(status_code=403, detail="The owner bootstrap token is invalid")
    else:
        if not input.invitation_token:
            raise HTTPException(status_code=403, detail="A family invitation is required to create an account")
        if is_family_code(input.invitation_token):
            await limit_family_code_attempts(f"register:{email}")
            code_family = await family_for_code(input.invitation_token)
        else:
            invitation = await _invitation_for_token(input.invitation_token, email)

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": email,
        "name": name,
        "password_hash": bcrypt.hashpw(input.password.encode("utf-8"), bcrypt.gensalt()).decode("ascii"),
        "is_owner": owner_registration,
        "created_at": now_iso(),
    }
    if google_subject:
        user["google_sub"] = google_subject
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="The account could not be registered") from error

    if owner_registration:
        await ensure_family_groups()
        await db.family_groups.update_many(
            {},
            {
                "$set": {"owner_user_id": user_id},
                "$addToSet": {"user_ids": user_id},
            },
        )
    elif code_family:
        joined = await db.family_groups.update_one(
            {"id": code_family["id"], "join_code": normalize_family_code(input.invitation_token), **ACTIVE_FAMILY},
            {"$addToSet": {"user_ids": user_id}},
        )
        if joined.matched_count != 1:
            await db.users.delete_one({"id": user_id})
            raise HTTPException(status_code=404, detail="The family no longer exists")
    else:
        if invitation.get("management_invite"):
            # Registration creates an account only. The signed-in user must
            # review the family and explicitly confirm joining afterwards.
            return _issue_session(user)
        invitation_collection = db.family_invitations
        claimed = await invitation_collection.update_one(
            {"id": invitation["id"], "used_at": None, "cancelled_at": {"$exists": False}, "expires_at": {"$gt": now_iso()}},
            {"$set": {"used_at": now_iso(), "accepted_user_id": user_id}},
        )
        if claimed.modified_count != 1:
            await db.users.delete_one({"id": user_id})
            raise HTTPException(status_code=409, detail="This invitation has already been used")
        joined = await db.family_groups.update_one(
            {"id": invitation["family_group_id"], **ACTIVE_FAMILY},
            {"$addToSet": {"user_ids": user_id}},
        )
        if joined.matched_count != 1:
            await invitation_collection.update_one(
                {"id": invitation["id"], "accepted_user_id": user_id},
                {"$unset": {"used_at": "", "accepted_user_id": ""}},
            )
            await db.users.delete_one({"id": user_id})
            raise HTTPException(status_code=404, detail="The invited family group no longer exists")

    return _issue_session(user)


@auth_router.post("/login", response_model=AccountSession)
async def login_account(input: AccountLogin):
    email = str(input.email).strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if (
        not user
        or len(input.password.encode("utf-8")) > 72
        or not bcrypt.checkpw(input.password.encode("utf-8"), user["password_hash"].encode("ascii"))
    ):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return _issue_session(user)


@auth_router.get("/me", response_model=Account)
async def current_account(user: dict = Depends(require_authenticated_user)):
    return _account_public(user)


@auth_router.post("/google", response_model=AccountSession)
async def google_account_login(input: GoogleAccountLogin):
    if not AUTH_SECRET or len(AUTH_SECRET.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    identity = await run_in_threadpool(verify_google_identity, input.id_token)
    subject = identity["sub"]
    user = await db.users.find_one({"google_sub": subject}, {"_id": 0})
    if user:
        return _issue_session(user)
    email = str(identity["email"]).strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        if user.get("google_sub"):
            raise HTTPException(status_code=409, detail="This account is already connected to another Google account.")
        if not input.password:
            raise HTTPException(status_code=409, detail="Enter your existing DawaiSathi password to connect this Google account.")
        if len(input.password.encode("utf-8")) > 72 or not bcrypt.checkpw(
            input.password.encode("utf-8"), user["password_hash"].encode("ascii")
        ):
            raise HTTPException(status_code=401, detail="Your DawaiSathi password is incorrect.")
        try:
            linked = await db.users.update_one(
                {"id": user["id"], "google_sub": {"$exists": False}},
                {"$set": {"google_sub": subject}},
            )
        except DuplicateKeyError as error:
            raise HTTPException(status_code=409, detail="This Google account is already connected. Try signing in again.") from error
        if linked.modified_count != 1:
            raise HTTPException(status_code=409, detail="The account changed. Try signing in again.")
        return _issue_session(user)
    return await _register_account(
        AccountRegistration(
            email=email,
            name=(str(identity.get("name") or email.split("@")[0]).strip() or "Family member")[:60],
            password=secrets.token_urlsafe(32),
            bootstrap_token=input.bootstrap_token,
            invitation_token=input.invitation_token,
        ),
        google_subject=subject,
    )


@api_router.get("/")
async def root():
    return {"message": "DawaiSathi API is ready"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@api_router.get("/family-groups", response_model=List[FamilyGroup])
async def list_family_groups(request: Request):
    await ensure_family_groups()
    query = {"user_ids": request.state.user["id"], **ACTIVE_FAMILY}
    groups = await db.family_groups.find(query, {"_id": 0}).sort("created_at", 1).to_list(100)
    result = []
    for group in groups:
        member_count = await db.members.count_documents({"family_group_ids": group["id"]})
        await ensure_family_code(group["id"])
        result.append(FamilyGroup(**{**group, "member_count": member_count}))
    return result


@api_router.post("/family-groups", response_model=FamilyGroup)
async def create_family_group(input: FamilyGroupCreate, request: Request):
    await ensure_family_groups()
    user = request.state.user
    primary = await db.members.find_one({"user_id": user["id"]}, {"_id": 0})
    if not primary:
        owned_groups = await db.family_groups.find({"owner_user_id": user["id"], **ACTIVE_FAMILY}, {"id": 1}).to_list(200)
        primary = await db.members.find_one({"is_primary": True, "family_group_ids": {"$in": [g["id"] for g in owned_groups]}, "user_id": {"$exists": False}}, {"_id": 0})
    if not primary:
        primary = {"id": str(uuid.uuid4()), "name": user["name"], "user_id": user["id"], "email": user["email"], "role": "member", "color": MEMBER_COLORS[0], "is_primary": True, "family_group_ids": [], "created_at": now_iso()}
        await db.members.insert_one(primary.copy())
    name = input.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Family group name is required")
    now = now_iso()
    document = {
        "id": str(uuid.uuid4()),
        "name": name,
        "member_ids": [primary["id"]],
        "owner_user_id": request.state.user["id"],
        "user_ids": [request.state.user["id"]],
        "user_roles": {request.state.user["id"]: input.role},
        "created_at": now,
        "updated_at": now,
    }
    await db.family_groups.insert_one(document)
    await ensure_family_code(document["id"])
    await db.members.update_one({"id": primary["id"]}, {"$addToSet": {"family_group_ids": document["id"]}})
    return FamilyGroup(**{**document, "member_count": 1})


@api_router.get("/family-groups/deleted")
async def deleted_family_groups(request: Request):
    documents = await db.family_groups.find(
        {"owner_user_id": request.state.user["id"], "deleted_at": {"$exists": True}, "recover_until": {"$gt": now_iso()}},
        {"_id": 0, "id": 1, "name": 1, "recover_until": 1},
    ).sort("deleted_at", -1).to_list(100)
    return documents


@api_router.delete("/family-groups/{family_group_id}")
async def delete_family_group(family_group_id: str, request: Request):
    group = await get_family_group(family_group_id)
    if group.get("owner_user_id") != request.state.user["id"]:
        raise HTTPException(status_code=403, detail="Only the family owner can delete this group")
    deleted_at = now_utc()
    recover_until = (deleted_at + timedelta(days=FAMILY_RECOVERY_DAYS)).isoformat()
    # One atomic visibility switch: records and memberships stay intact for recovery.
    # All access and invitation checks exclude deleted groups.
    await db.family_groups.update_one(
        {"id": family_group_id, **ACTIVE_FAMILY},
        {"$set": {"deleted_at": deleted_at.isoformat(), "recover_until": recover_until, "updated_at": deleted_at.isoformat()}},
    )
    return {"ok": True, "recover_until": recover_until}


@api_router.post("/family-groups/{family_group_id}/restore")
async def restore_family_group(family_group_id: str, request: Request):
    result = await db.family_groups.update_one(
        {"id": family_group_id, "owner_user_id": request.state.user["id"], "deleted_at": {"$exists": True}, "recover_until": {"$gt": now_iso()}},
        {"$unset": {"deleted_at": "", "recover_until": ""}, "$set": {"updated_at": now_iso()}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="This family is already restored or its recovery period has ended")
    return {"ok": True}


@api_router.delete("/family-groups/{family_group_id}/members/{member_id}")
async def remove_family_profile(family_group_id: str, member_id: str):
    member = await db.members.find_one({"id": member_id, "family_group_ids": family_group_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this family")
    if member.get("is_primary"):
        raise HTTPException(status_code=400, detail="Primary member cannot be removed")
    # Preserve records, including their historical names. No account is deleted.
    # Scope the change to this family even if the profile belongs to other families.
    for collection in ("medicines", "eye_drop_protocols", "checkups", "dose_logs", "protocol_step_logs", "missed_dose_events"):
        await db[collection].update_many(
            {"family_group_id": family_group_id, "member_id": member_id},
            {"$set": {"member_id": None}},
        )
    await db.family_groups.update_one({"id": family_group_id}, {"$pull": {"member_ids": member_id}})
    await db.members.update_one({"id": member_id}, {"$pull": {"family_group_ids": family_group_id}, "$set": {"explicit_membership": True}})
    return {"ok": True}


@api_router.patch("/family-groups/{family_group_id}", response_model=FamilyGroup)
async def rename_family_group(family_group_id: str, input: FamilyGroupUpdate):
    group = await get_family_group(family_group_id)
    name = input.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Family group name is required")
    now = now_iso()
    await db.family_groups.update_one({"id": family_group_id}, {"$set": {"name": name, "updated_at": now}})
    group["name"] = name
    group["updated_at"] = now
    member_count = await db.members.count_documents({"family_group_ids": family_group_id})
    return FamilyGroup(**{**group, "member_count": member_count})



def normalize_family_code(value: str) -> str:
    return re.sub(r"[\\s-]", "", value).upper()


def is_family_code(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9A-F]{16}", normalize_family_code(value)))


async def ensure_family_code(group_id: str) -> str:
    for _ in range(8):
        group = await db.family_groups.find_one({"id": group_id, **ACTIVE_FAMILY})
        if not group:
            raise HTTPException(status_code=404, detail="Family not found")
        if group.get("join_code"):
            return group["join_code"]
        code = secrets.token_hex(8).upper()
        try:
            await db.family_groups.update_one(
                {"id": group_id, "join_code": {"$exists": False}},
                {"$set": {"join_code": code}},
            )
        except DuplicateKeyError:
            continue
    raise HTTPException(status_code=503, detail="Could not prepare the family code. Try again")


async def family_for_code(value: str) -> dict:
    code = normalize_family_code(value)
    if not is_family_code(code):
        raise HTTPException(status_code=404, detail="Family code is invalid or the family was deleted")
    group = await db.family_groups.find_one({"join_code": code, **ACTIVE_FAMILY}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Family code is invalid or the family was deleted")
    return group


async def limit_family_code_attempts(key: str):
    # Atomic counter shared by server processes; TTL removes old windows.
    now = datetime.now(timezone.utc)
    bucket = int(now.timestamp()) // 900
    attempt_id = sha256(f"{key}:{bucket}".encode()).hexdigest()
    await db.family_code_attempts.update_one(
        {"_id": attempt_id},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + timedelta(minutes=30)}},
        upsert=True,
    )
    attempt = await db.family_code_attempts.find_one({"_id": attempt_id})
    if attempt["count"] > 15:
        raise HTTPException(status_code=429, detail="Too many family-code attempts. Try again in 15 minutes")


class FamilyCodeAccept(BaseModel):
    code: str = Field(min_length=1, max_length=80)


@api_router.get("/family-groups/{family_group_id}/join-code")
async def get_family_join_code(family_group_id: str, request: Request):
    group = await get_family_group(family_group_id)
    if group.get("owner_user_id") != request.state.user["id"]:
        raise HTTPException(status_code=403, detail="Only the family owner can share its join code")
    return {"family_group_id": family_group_id, "code": await ensure_family_code(family_group_id)}


@api_router.post("/family-code/accept")
async def accept_family_code(input: FamilyCodeAccept, request: Request):
    user = request.state.user
    await limit_family_code_attempts(f"user:{user['id']}")
    group = await family_for_code(input.code)
    result = await db.family_groups.update_one(
        {"id": group["id"], "join_code": normalize_family_code(input.code), **ACTIVE_FAMILY},
        {"$addToSet": {"user_ids": user["id"]}},
    )
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Family no longer exists")
    return {"ok": True, "family_group_id": group["id"]}


@api_router.post("/family-groups/{family_group_id}/invites", response_model=FamilyInvitation)
async def create_family_invitation(
    family_group_id: str,
    input: FamilyInvitationCreate,
    request: Request,
):
    invitation_token = secrets.token_urlsafe(32)
    expires_at = (now_utc() + timedelta(days=7)).isoformat()
    invitation = {
        "id": str(uuid.uuid4()),
        "family_group_id": family_group_id,
        "email": str(input.email).strip().lower(),
        "token_hash": sha256(invitation_token.encode("utf-8")).hexdigest(),
        "created_by": request.state.user["id"],
        "created_at": now_iso(),
        "expires_at": expires_at,
        "used_at": None,
    }
    await db.family_invitations.insert_one(invitation)
    return FamilyInvitation(
        email=invitation["email"],
        family_group_id=family_group_id,
        token=invitation_token,
        expires_at=expires_at,
    )


@api_router.post("/family-invitations/accept")
async def accept_family_invitation(input: FamilyInvitationAccept, request: Request):
    user = request.state.user
    invitation = await _invitation_for_token(input.token, user["email"])
    if invitation.get("management_invite"):
        raise HTTPException(422, "Review and confirm this invitation in Family management")
    claimed = await db.family_invitations.update_one(
        {"id": invitation["id"], "used_at": None},
        {"$set": {"used_at": now_iso(), "accepted_user_id": user["id"]}},
    )
    if claimed.modified_count != 1:
        raise HTTPException(status_code=409, detail="This invitation has already been used")
    joined = await db.family_groups.update_one(
        {"id": invitation["family_group_id"], **ACTIVE_FAMILY},
        {"$addToSet": {"user_ids": user["id"]}},
    )
    if joined.matched_count != 1:
        await db.family_invitations.update_one(
            {"id": invitation["id"], "accepted_user_id": user["id"]},
            {"$unset": {"used_at": "", "accepted_user_id": ""}},
        )
        raise HTTPException(status_code=404, detail="The invited family group no longer exists")
    return {"ok": True, "family_group_id": invitation["family_group_id"]}


@api_router.delete("/family-groups/{family_group_id}/membership")
async def leave_family_group(family_group_id: str, request: Request):
    group = await get_family_group(family_group_id)
    user_id = request.state.user["id"]
    if group.get("owner_user_id") == user_id:
        raise HTTPException(status_code=400, detail="The family owner must transfer ownership before leaving")
    result = await db.family_groups.update_one(
        {"id": family_group_id, "user_ids": user_id},
        {"$pull": {"user_ids": user_id}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=404, detail="Family membership not found")
    return {"ok": True}


@api_router.get("/family-groups/{family_group_id}/members", response_model=List[Member])
async def family_group_members(family_group_id: str):
    await get_family_group(family_group_id)
    documents = await db.members.find({"family_group_ids": family_group_id}, {"_id": 0}).sort([("is_primary", -1), ("created_at", 1)]).to_list(200)
    return [Member(**document) for document in documents]


@api_router.get("/members", response_model=List[Member])
async def list_members(request: Request, family_group_id: Optional[str] = None):
    await ensure_family_groups()
    if family_group_id:
        return await family_group_members(family_group_id)
    documents = await db.members.find(
        {"family_group_ids": {"$in": request.state.user.get("family_group_ids", [])}},
        {"_id": 0},
    ).sort([("is_primary", -1), ("created_at", 1)]).to_list(200)
    return [Member(**document) for document in documents]


@api_router.post("/members", response_model=Member)
async def create_member(input: MemberCreate):
    group_id = input.family_group_id or await default_family_group_id()
    await get_family_group(group_id)
    color = MEMBER_COLORS[await db.members.count_documents({}) % len(MEMBER_COLORS)]
    document = {
        "id": str(uuid.uuid4()),
        "name": input.name.strip(),
        "role": input.role.strip() or "member",
        "color": color,
        "is_primary": False,
        "family_group_ids": [group_id],
        "created_at": now_iso(),
    }
    await db.members.insert_one(document)
    await db.family_groups.update_one({"id": group_id}, {"$addToSet": {"member_ids": document["id"]}, "$set": {"updated_at": now_iso()}})
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
    await db.family_groups.update_many({"member_ids": member_id}, {"$pull": {"member_ids": member_id}})
    await db.medicines.update_many({"member_id": member_id}, {"$set": {"member_id": None}})
    await db.eye_drop_protocols.update_many({"member_id": member_id}, {"$set": {"member_id": None}})
    return {"ok": True}


@api_router.get("/medicines", response_model=List[Medicine])
async def list_medicines(active_only: bool = True, member_id: Optional[str] = None, family_group_id: Optional[str] = None):
    query: dict = {}
    if active_only:
        query["active"] = True
    if family_group_id is not None:
        query["family_group_id"] = family_group_id
    if member_id is not None:
        query["member_id"] = member_id
    documents = await db.medicines.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Medicine(**document) for document in documents]


@api_router.post("/medicine-images", response_model=MedicineImageResponse)
async def upload_medicine_image(input: MedicineImageUpload):
    image_type = MEDICINE_IMAGE_TYPES.get(input.content_type)
    if image_type is None:
        raise HTTPException(status_code=415, detail="Choose a JPEG, PNG, or WebP image")

    try:
        contents = b64decode(input.image_base64, validate=True)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Image data is not valid base64") from error
    if not contents or len(contents) > MAX_MEDICINE_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Images must be smaller than 5 MB")

    extension, matches_signature = image_type
    if not matches_signature(contents):
        raise HTTPException(status_code=415, detail="Image content does not match its file type")

    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{extension}"
    destination = MEDIA_ROOT / filename
    try:
        destination.write_bytes(contents)
    except OSError as error:
        raise HTTPException(status_code=500, detail="Could not store the medicine image") from error

    return MedicineImageResponse(
        image_url=f"/media/medicine-images/{filename}"
    )


@api_router.post("/medicines", response_model=Medicine)
async def create_medicine(input: MedicineCreate):
    if not input.times:
        raise HTTPException(status_code=422, detail="Add at least one reminder time")
    days = input.days or list(DEFAULT_DAYS)
    family_group_id = input.family_group_id or await default_family_group_id()
    await get_family_group(family_group_id)
    if input.member_id is not None:
        member = await db.members.find_one(
            {"id": input.member_id, "family_group_ids": family_group_id},
            {"_id": 0},
        )
        if not member:
            raise HTTPException(
                status_code=422,
                detail="Member does not belong to the selected family group",
            )
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
        "voice_note_url": input.voice_note_url.strip(),
        "active": True,
        "member_id": input.member_id,
        "family_group_id": family_group_id,
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
    existing = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Medicine not found")
    family_group_id = updates.get("family_group_id", existing["family_group_id"])
    member_id = updates.get("member_id", existing.get("member_id"))
    await get_family_group(family_group_id)
    if member_id is not None:
        member = await db.members.find_one(
            {"id": member_id, "family_group_ids": family_group_id},
            {"_id": 0},
        )
        if not member:
            raise HTTPException(
                status_code=422,
                detail="Member does not belong to the selected family group",
            )
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


# ---------------------------------------------------------------------------
# Eye-drop protocol endpoints
# ---------------------------------------------------------------------------


@api_router.get("/eye-drop-protocols", response_model=List[EyeDropProtocol])
async def list_protocols(active_only: bool = True, member_id: Optional[str] = None, family_group_id: Optional[str] = None):
    query: dict = {}
    if active_only:
        query["active"] = True
    if family_group_id is not None:
        query["family_group_id"] = family_group_id
    if member_id is not None:
        query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    documents = await db.eye_drop_protocols.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [EyeDropProtocol(**document) for document in documents]


@api_router.post("/eye-drop-protocols", response_model=EyeDropProtocol)
async def create_protocol(input: EyeDropProtocolCreate):
    days = input.days or list(DEFAULT_DAYS)
    document = {
        "id": str(uuid.uuid4()),
        "name": input.name.strip(),
        "start_time": input.start_time,
        "interval_minutes": input.interval_minutes,
        "steps": _build_protocol_steps(input.steps),
        "voice_note_url": input.voice_note_url.strip(),
        "member_id": input.member_id,
        "family_group_id": input.family_group_id or await default_family_group_id(),
        "days": days,
        "active": True,
        "created_at": now_iso(),
    }
    await db.eye_drop_protocols.insert_one(document)
    return EyeDropProtocol(**document)


@api_router.patch("/eye-drop-protocols/{protocol_id}", response_model=EyeDropProtocol)
async def update_protocol(protocol_id: str, input: EyeDropProtocolUpdate):
    updates = input.model_dump(exclude_unset=True)
    if "name" in updates and isinstance(updates["name"], str):
        updates["name"] = updates["name"].strip()
    if "steps" in updates and updates["steps"] is not None:
        updates["steps"] = _build_protocol_steps(
            [EyeDropStepInput(**step) if not isinstance(step, EyeDropStepInput) else step for step in updates["steps"]]
        )
    if not updates:
        raise HTTPException(status_code=400, detail="No changes supplied")
    result = await db.eye_drop_protocols.update_one({"id": protocol_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Protocol not found")
    document = await db.eye_drop_protocols.find_one({"id": protocol_id}, {"_id": 0})
    return EyeDropProtocol(**document)


@api_router.delete("/eye-drop-protocols/{protocol_id}")
async def archive_protocol(protocol_id: str):
    result = await db.eye_drop_protocols.update_one(
        {"id": protocol_id, "active": True},
        {"$set": {"active": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return {"ok": True}


@api_router.post("/eye-drop-protocols/{protocol_id}/step/{order}/log", response_model=ProtocolStepLog)
async def log_protocol_step(protocol_id: str, order: int):
    protocol = await db.eye_drop_protocols.find_one({"id": protocol_id, "active": True}, {"_id": 0})
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    step = next((item for item in protocol.get("steps", []) if item["order"] == order), None)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    time_value = add_minutes_to_time(protocol["start_time"], protocol["interval_minutes"] * (order - 1))
    date_value = local_date()
    existing = await db.protocol_step_logs.find_one(
        {"protocol_id": protocol_id, "step_order": order, "local_date": date_value},
        {"_id": 0},
    )
    if existing:
        return ProtocolStepLog(**existing)
    document = {
        "id": str(uuid.uuid4()),
        "protocol_id": protocol_id,
        "protocol_name": protocol["name"],
        "step_order": order,
        "medicine_name": step["medicine_name"],
        "dose": step["dose"],
        "eye": step["eye"],
        "time": time_value,
        "logged_at": now_iso(),
        "local_date": date_value,
        "member_id": protocol.get("member_id"),
        "family_group_id": protocol.get("family_group_id"),
    }
    await db.protocol_step_logs.insert_one(document)
    return ProtocolStepLog(**document)


@api_router.delete("/eye-drop-protocols/{protocol_id}/step/{order}/log")
async def undo_protocol_step(protocol_id: str, order: int, date: Optional[str] = None):
    date_value = date or local_date()
    result = await db.protocol_step_logs.find_one_and_delete(
        {"protocol_id": protocol_id, "step_order": order, "local_date": date_value}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Step log not found")
    return {"ok": True}


@api_router.get("/eye-drop-protocols/history", response_model=List[ProtocolStepLog])
async def protocol_history(
    limit: int = Query(default=200, ge=1, le=500),
    member_id: Optional[str] = None,
    protocol_id: Optional[str] = None,
    date: Optional[str] = None,
    family_group_id: Optional[str] = None,
):
    query: dict = {}
    if family_group_id is not None:
        query["family_group_id"] = family_group_id
    if member_id is not None:
        query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    if protocol_id is not None:
        query["protocol_id"] = protocol_id
    if date is not None:
        query["local_date"] = date
    documents = await db.protocol_step_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(limit)
    return [ProtocolStepLog(**document) for document in documents]


@api_router.get("/today", response_model=TodayResponse)
async def today(member_id: Optional[str] = None, family_group_id: Optional[str] = None):
    family_group_id = family_group_id or await default_family_group_id()
    missed_events = await record_missed_doses(family_group_id)
    if member_id is not None:
        missed_events = [
            event
            for event in missed_events
            if event.member_id is None or event.member_id == member_id
        ]
    today_value = local_date()
    weekday = datetime.now().weekday()
    medicine_query: dict = {"active": True, "family_group_id": family_group_id}
    if member_id is not None:
        medicine_query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    medicines = await db.medicines.find(medicine_query, {"_id": 0}).to_list(500)
    logs = await db.dose_logs.find({"local_date": today_value, "family_group_id": family_group_id}, {"_id": 0}).to_list(600)
    log_index = {(log["medicine_id"], log["time"]): log for log in logs}
    members_map = await load_members_map(family_group_id)

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

    protocol_query: dict = {"active": True, "family_group_id": family_group_id}
    if member_id is not None:
        protocol_query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    protocols_docs = await db.eye_drop_protocols.find(protocol_query, {"_id": 0}).to_list(200)
    step_logs = await db.protocol_step_logs.find({"local_date": today_value, "family_group_id": family_group_id}, {"_id": 0}).to_list(600)
    step_index = {(entry["protocol_id"], entry["step_order"]): entry for entry in step_logs}
    protocols: List[TodayProtocol] = []
    for protocol in protocols_docs:
        if not _dose_matches_day(protocol, weekday):
            continue
        member = members_map.get(protocol.get("member_id") or "")
        steps: List[TodayProtocolStep] = []
        interval = int(protocol.get("interval_minutes", 5))
        for step in protocol.get("steps", []):
            time_value = add_minutes_to_time(protocol["start_time"], interval * (int(step["order"]) - 1))
            log = step_index.get((protocol["id"], int(step["order"])))
            steps.append(
                TodayProtocolStep(
                    order=int(step["order"]),
                    medicine_name=step["medicine_name"],
                    dose=step["dose"],
                    eye=step["eye"],
                    time=time_value,
                    logged_at=log.get("logged_at") if log else None,
                    log_id=log.get("id") if log else None,
                )
            )
        end_time = steps[-1].time if steps else protocol["start_time"]
        protocols.append(
            TodayProtocol(
                protocol_id=protocol["id"],
                name=protocol["name"],
                start_time=protocol["start_time"],
                end_time=end_time,
                interval_minutes=interval,
                time_slot=time_slot(protocol["start_time"]),
                member_id=protocol.get("member_id"),
                member_name=member.get("name", "") if member else "",
                steps=steps,
            )
        )
    protocols.sort(key=lambda item: item.start_time)

    return TodayResponse(
        date=today_value,
        doses=doses,
        protocols=protocols,
        missed_doses=missed_events,
    )


@api_router.post("/medicines/{medicine_id}/dose", response_model=DoseLog)
async def log_dose(medicine_id: str, input: DoseLogCreate):
    medicine = await db.medicines.find_one(
        {"id": medicine_id, "active": True}, {"_id": 0}
    )
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    if input.time not in medicine["times"]:
        raise HTTPException(
            status_code=422,
            detail="Dose time is not part of this medicine's schedule",
        )

    date_value = local_date()
    dose_filter = {
        "medicine_id": medicine_id,
        "time": input.time,
        "local_date": date_value,
    }
    existing = await db.dose_logs.find_one(dose_filter, {"_id": 0})
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
        "family_group_id": medicine.get("family_group_id"),
        "quantity_deducted": False,
    }

    try:
        await db.dose_logs.insert_one(document)
    except DuplicateKeyError:
        existing = await db.dose_logs.find_one(dose_filter, {"_id": 0})
        if existing:
            return DoseLog(**existing)
        raise HTTPException(status_code=409, detail="This dose was already logged.")

    stock_result = await db.medicines.update_one(
        {"id": medicine_id, "quantity_remaining": {"$gt": 0}},
        {"$inc": {"quantity_remaining": -1}},
    )
    if stock_result.modified_count == 1:
        await db.dose_logs.update_one(
            {"id": document["id"]},
            {"$set": {"quantity_deducted": True}},
        )
        document["quantity_deducted"] = True

    return DoseLog(**document)


@api_router.delete("/medicines/{medicine_id}/dose")
async def undo_dose(medicine_id: str, time: str = Query(...), date: Optional[str] = None):
    date_value = date or local_date()
    result = await db.dose_logs.find_one_and_delete(
        {
            "medicine_id": medicine_id,
            "time": time,
            "local_date": date_value,
        }
    )
    if not result:
        raise HTTPException(status_code=404, detail="Dose log not found")

    # Restore stock only when this log explicitly records that stock was deducted.
    if result.get("quantity_deducted") is True:
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
    family_group_id: Optional[str] = None,
):
    query: dict = {}
    if family_group_id is not None:
        query["family_group_id"] = family_group_id
    if member_id is not None:
        query["$or"] = [{"member_id": member_id}, {"member_id": None}]
    if medicine_id is not None:
        query["medicine_id"] = medicine_id
    if date is not None:
        query["local_date"] = date
    documents = await db.dose_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(limit)
    return [DoseLog(**document) for document in documents]


@api_router.get("/missed-doses/history", response_model=List[MissedDoseEvent])
async def missed_dose_history_route(
    limit: int = Query(default=500, ge=1, le=500),
    member_id: Optional[str] = None,
    family_group_id: Optional[str] = None,
):
    family_group_id = family_group_id or await default_family_group_id()
    return await missed_dose_history(family_group_id, member_id, limit)


@api_router.get("/checkups", response_model=List[Checkup])
async def list_checkups(member_id: Optional[str] = None, family_group_id: Optional[str] = None):
    query: dict = {}
    if family_group_id is not None:
        query["family_group_id"] = family_group_id
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
        "voice_note_url": input.voice_note_url.strip(),
        "member_id": input.member_id,
        "family_group_id": input.family_group_id or await default_family_group_id(),
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
async def notification_preferences(request: Request):
    settings_id = f"notifications:{request.state.user['id']}"
    document = await db.settings.find_one({"id": settings_id}, {"_id": 0})
    if not document:
        return NotificationPreference()
    document.pop("id", None)
    return NotificationPreference(**document)


@api_router.put("/notifications/preferences", response_model=NotificationPreference)
async def save_notification_preferences(input: NotificationPreference, request: Request):
    payload = input.model_dump()
    settings_id = f"notifications:{request.state.user['id']}"
    await db.settings.update_one(
        {"id": settings_id},
        {"$set": {**payload, "id": settings_id}},
        upsert=True,
    )
    return NotificationPreference(**payload)


@api_router.get("/attention", response_model=AttentionResponse)
async def attention(family_group_id: Optional[str] = None):
    family_group_id = family_group_id or await default_family_group_id()
    today_value = local_date()
    weekday = datetime.now().weekday()
    now = datetime.now()
    items: List[AttentionItem] = []
    medicines_map = await load_medicines_map(family_group_id)
    members_map = await load_members_map(family_group_id)
    logs = await db.dose_logs.find({"local_date": today_value, "family_group_id": family_group_id}, {"_id": 0}).to_list(600)
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

    protocols_docs = await db.eye_drop_protocols.find({"active": True, "family_group_id": family_group_id}, {"_id": 0}).to_list(200)
    step_logs = await db.protocol_step_logs.find({"local_date": today_value, "family_group_id": family_group_id}, {"_id": 0}).to_list(600)
    step_taken = {(entry["protocol_id"], entry["step_order"]) for entry in step_logs}
    for protocol in protocols_docs:
        if not _dose_matches_day(protocol, weekday):
            continue
        member = members_map.get(protocol.get("member_id") or "")
        owner = f" · {member['name']}" if member else ""
        interval = int(protocol.get("interval_minutes", 5))
        for step in protocol.get("steps", []):
            order = int(step["order"])
            if (protocol["id"], order) in step_taken:
                continue
            step_time = add_minutes_to_time(protocol["start_time"], interval * (order - 1))
            hour, minute = (int(value) for value in step_time.split(":"))
            scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            delta = (now - scheduled).total_seconds() / 60
            if delta >= 180:
                items.append(
                    AttentionItem(
                        id=f"protocol-missed:{protocol['id']}:{order}:{today_value}",
                        kind="missed-dose",
                        title=f"Missed step · {protocol['name']}",
                        detail=f"Step {order} · {step['medicine_name']} at {step_time}{owner}",
                        when=scheduled.isoformat(),
                        protocol_id=protocol["id"],
                        member_id=protocol.get("member_id"),
                    )
                )
            elif delta >= 15:
                items.append(
                    AttentionItem(
                        id=f"protocol-late:{protocol['id']}:{order}:{today_value}",
                        kind="late-dose",
                        title=f"Late step · {protocol['name']}",
                        detail=f"Step {order} · {step['medicine_name']} at {step_time}{owner}",
                        when=scheduled.isoformat(),
                        protocol_id=protocol["id"],
                        member_id=protocol.get("member_id"),
                    )
                )

    upcoming_horizon = now + timedelta(hours=48)
    checkups = await db.checkups.find({"family_group_id": family_group_id}, {"_id": 0}).to_list(200)
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
async def upcoming_checkup(member_id: Optional[str] = None, family_group_id: Optional[str] = None):
    family_group_id = family_group_id or await default_family_group_id()
    now = datetime.now()
    query: dict = {"family_group_id": family_group_id}
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



class VoiceNoteUpload(BaseModel):
    content_type: str = Field(min_length=1, max_length=80)
    audio_base64: str = Field(min_length=1, max_length=7_000_000)


def voice_extension(content_type: str, data: bytes) -> str:
    content_type = content_type.split(";")[0].strip().lower()
    if content_type in ("audio/mp4", "audio/m4a", "audio/x-m4a") and len(data) > 12 and data[4:8] == b"ftyp":
        return ".m4a"
    if content_type in ("audio/wav", "audio/x-wav", "audio/wave") and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return ".wav"
    if content_type in ("audio/mpeg", "audio/mp3") and (data[:3] == b"ID3" or (len(data) > 1 and data[0] == 255 and data[1] & 224 == 224)):
        return ".mp3"
    if content_type == "audio/webm" and data[:4] == b"\\x1a\\x45\\xdf\\xa3":
        return ".webm"
    if content_type in ("audio/ogg", "audio/opus") and data[:4] == b"OggS":
        return ".ogg"
    raise HTTPException(status_code=422, detail="Choose an M4A, MP3, WAV, WebM, or Ogg audio file")


@api_router.post("/voice-notes")
async def upload_voice_note(input: VoiceNoteUpload, user: dict = Depends(require_authenticated_user)):
    try:
        data = b64decode(input.audio_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=422, detail="Could not read this audio file") from exc
    if not data or len(data) > VOICE_MAX_BYTES:
        raise HTTPException(status_code=422, detail="Voice notes must be smaller than 5 MB")
    extension = voice_extension(input.content_type, data)
    filename = f"{uuid.uuid4()}{extension}"
    url = f"/media/voice-notes/{filename}"
    VOICE_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    path = VOICE_MEDIA_ROOT / filename
    path.write_bytes(data)
    try:
        await db.voice_notes.insert_one({
            "voice_note_url": url, "owner_user_id": user["id"],
            "content_type": {".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm", ".ogg": "audio/ogg"}[extension],
            "created_at": now_iso(), "size": len(data),
        })
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"voice_note_url": url}


@app.get("/media/voice-notes/{filename}")
async def get_voice_note(filename: str, user: dict = Depends(require_authenticated_user)):
    path = (VOICE_MEDIA_ROOT / filename).resolve()
    url = f"/media/voice-notes/{filename}"
    if Path(filename).name != filename or path.parent != VOICE_MEDIA_ROOT or not path.is_file() or not await can_access_voice_note(url, user):
        raise HTTPException(status_code=404, detail="Voice note not found")
    metadata = await db.voice_notes.find_one({"voice_note_url": url})
    if not metadata:
        raise HTTPException(status_code=404, detail="Voice note not found")
    return FileResponse(path, media_type=metadata["content_type"], headers={"Cache-Control": "private, no-store"})


@app.get("/media/medicine-images/{filename}")
async def get_medicine_image(filename: str, user: dict = Depends(require_authenticated_user)):
    if Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="Image not found")
    image_path = MEDIA_ROOT / filename
    image_url = f"/media/medicine-images/{filename}"
    if not image_path.is_file() or not await db.medicines.find_one(
        {
            "image_url": image_url,
            "family_group_id": {"$in": user.get("family_group_ids", [])},
        },
        {"_id": 0, "id": 1},
    ):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)


from prescriptions import prescription_router
from family_management import management_router

app.include_router(prescription_router(db, require_authenticated_user, ROOT_DIR / "data" / "prescriptions"))
app.include_router(management_router(db, require_authenticated_user, limit_family_code_attempts))
app.include_router(auth_router)
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
