"""Authenticated family-management actions and single-use invitations."""
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field


class InviteInput(BaseModel):
    email: EmailStr | None = None
    member_id: str | None = None


class InviteCode(BaseModel):
    code: str = Field(min_length=1, max_length=100)


class ProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    relationship: str = Field(default="", max_length=40)
    role: str = Field(default="member", pattern="^(member|care_taker)$")
    email: EmailStr | None = None


def management_router(db, authenticate, limit_attempts):
    router = APIRouter(prefix="/api/family-management", dependencies=[Depends(authenticate)])
    now = lambda: datetime.now(timezone.utc)

    async def group_access(group_id, user, owner=False):
        group = await db.family_groups.find_one({"id": group_id, "user_ids": user["id"], "deleted_at": {"$exists": False}}, {"_id": 0})
        if not group or (owner and group.get("owner_user_id") != user["id"]):
            raise HTTPException(403, "Only the family owner can manage members and invitations" if owner else "Family access denied")
        return group

    async def invitation(code, user):
        await limit_attempts(f"invite:{user['id']}")
        invite = await db.management_invites.find_one({"token_hash": sha256(code.strip().encode()).hexdigest()}, {"_id": 0})
        if not invite or invite.get("used_at") or invite.get("cancelled_at") or invite["expires_at"] <= now().isoformat():
            raise HTTPException(410, "This invite code is invalid or has expired.")
        if invite.get("email") and invite["email"] != user["email"].lower():
            raise HTTPException(403, "Sign in with the email address this invitation was sent to.")
        group = await db.family_groups.find_one({"id": invite["family_group_id"], "deleted_at": {"$exists": False}}, {"_id": 0})
        if not group:
            raise HTTPException(410, "This invite code is invalid or has expired.")
        return invite, group

    @router.get("/{group_id}/summary")
    async def summary(group_id: str, user=Depends(authenticate)):
        group = await group_access(group_id, user)
        owner = await db.users.find_one({"id": group.get("owner_user_id")}, {"_id": 0, "name": 1})
        return {"owner_name": (owner or {}).get("name", "Family owner")}

    @router.post("/{group_id}/invites")
    async def create_invite(group_id: str, input: InviteInput, user=Depends(authenticate)):
        group = await group_access(group_id, user, True)
        if input.member_id:
            if not input.email:
                raise HTTPException(422, "Save this member's email address before inviting their account")
            target = await db.members.find_one({"id": input.member_id, "family_group_ids": group_id})
            if not target:
                raise HTTPException(422, "Member not found in this family")
            if target.get("user_id") in group.get("user_ids", []):
                raise HTTPException(409, "This member already has a linked account")
            if target.get("email") and (not input.email or str(input.email).lower() != target["email"]):
                raise HTTPException(422, "Invite this member using their saved email address")
        token = "FAM-" + secrets.token_hex(16).upper()
        record = {"id": str(uuid.uuid4()), "family_group_id": group_id, "email": str(input.email).lower() if input.email else None, "member_id": input.member_id, "token_hash": sha256(token.encode()).hexdigest(), "created_at": now().isoformat(), "expires_at": (now() + timedelta(days=7)).isoformat(), "created_by": user["id"]}
        await db.management_invites.insert_one(record.copy())
        return {k: v for k, v in {**record, "code": token}.items() if k != "token_hash"}

    @router.get("/{group_id}/invites")
    async def invites(group_id: str, user=Depends(authenticate)):
        await group_access(group_id, user, True)
        records = await db.management_invites.find({"family_group_id": group_id}, {"_id": 0, "token_hash": 0}).sort("created_at", -1).to_list(200)
        records += await db.family_invitations.find({"family_group_id": group_id}, {"_id": 0, "token_hash": 0}).sort("created_at", -1).to_list(200)
        records.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        for record in records:
            record["status"] = "Accepted" if record.get("used_at") else "Cancelled" if record.get("cancelled_at") else "Expired" if record["expires_at"] <= now().isoformat() else "Pending"
        return records

    @router.delete("/{group_id}/invites/{invite_id}")
    async def cancel(group_id: str, invite_id: str, user=Depends(authenticate)):
        await group_access(group_id, user, True)
        result = await db.management_invites.update_one({"id": invite_id, "family_group_id": group_id, "used_at": None}, {"$set": {"cancelled_at": now().isoformat()}})
        if not result.matched_count:
            result = await db.family_invitations.update_one({"id": invite_id, "family_group_id": group_id, "used_at": None}, {"$set": {"cancelled_at": now().isoformat()}})
        if not result.matched_count:
            raise HTTPException(409, "Invitation is already accepted or unavailable")
        return {"ok": True}

    @router.post("/invite/preview")
    async def preview(input: InviteCode, user=Depends(authenticate)):
        invite, group = await invitation(input.code, user)
        owner = await db.users.find_one({"id": group["owner_user_id"]}, {"name": 1})
        return {"family_group_id": group["id"], "name": group["name"], "owner_name": (owner or {}).get("name", "Family owner"), "member_count": len(group.get("member_ids", [])), "expires_at": invite["expires_at"]}

    @router.post("/invite/accept")
    async def accept(input: InviteCode, user=Depends(authenticate)):
        invite, group = await invitation(input.code, user)
        if user["id"] in group.get("user_ids", []):
            return {"family_group_id": group["id"], "ok": True}
        existing = await db.members.find_one({"family_group_ids": group["id"], "$or": [{"user_id": user["id"]}, {"email": user["email"].lower()}]}, {"_id": 0})
        if existing and existing.get("user_id") not in (None, user["id"]):
            raise HTTPException(409, "This profile is already linked to another account")
        if invite.get("member_id"):
            target = await db.members.find_one({"id": invite["member_id"], "family_group_ids": group["id"]}, {"_id": 0})
            if not target or (target.get("user_id") and target["user_id"] != user["id"]) or (existing and existing["id"] != target["id"]):
                raise HTTPException(409, "This invitation's member profile is no longer available")
            existing = target
        claim = await db.management_invites.update_one({"id": invite["id"], "used_at": {"$exists": False}, "cancelled_at": {"$exists": False}, "expires_at": {"$gt": now().isoformat()}}, {"$set": {"used_at": now().isoformat(), "accepted_user_id": user["id"]}})
        if claim.modified_count != 1:
            raise HTTPException(409, "This invitation is no longer available")
        # Deterministic ID avoids duplicate profiles if two invitations are accepted concurrently.
        member_id = existing["id"] if existing else "account-" + sha256(f"{group['id']}:{user['id']}".encode()).hexdigest()[:32]
        # Mongo's unique _id makes concurrent upserts converge on one account profile.
        member_key = {"id": member_id} if existing else {"_id": member_id}
        await db.members.update_one(member_key, {"$set": {"id": member_id, "user_id": user["id"], "email": user["email"].lower()}, "$setOnInsert": {"name": user["name"], "role": "member", "color": "#387f66", "is_primary": False, "created_at": now().isoformat()}, "$addToSet": {"family_group_ids": group["id"]}}, upsert=True)
        joined = await db.family_groups.update_one({"id": group["id"], "deleted_at": {"$exists": False}}, {"$addToSet": {"user_ids": user["id"], "member_ids": member_id}})
        if not joined.matched_count:
            raise HTTPException(410, "This family is no longer available")
        return {"family_group_id": group["id"], "ok": True}

    @router.post("/{group_id}/members")
    @router.put("/{group_id}/members/{member_id}")
    async def save_profile(group_id: str, input: ProfileInput, member_id: str | None = None, user=Depends(authenticate)):
        await group_access(group_id, user, True)
        if not input.name.strip():
            raise HTTPException(422, "Enter the member's name")
        if member_id:
            profile = await db.members.find_one({"id": member_id, "family_group_ids": group_id})
            if not profile:
                raise HTTPException(404, "Member not found")
            shared_groups = await db.family_groups.count_documents({"id": {"$in": profile.get("family_group_ids", [])}, "owner_user_id": {"$ne": user["id"]}, "deleted_at": {"$exists": False}})
            if shared_groups:
                raise HTTPException(403, "This profile is shared with a family you do not own")
        if input.email:
            duplicate = await db.members.find_one({"family_group_ids": group_id, "email": str(input.email).lower(), "id": {"$ne": member_id}})
            if duplicate:
                raise HTTPException(409, "This email already belongs to a member of this family")
        member_id = member_id or str(uuid.uuid4())
        values = input.model_dump(); values["name"] = input.name.strip(); values["email"] = str(input.email).lower() if input.email else None
        existing = await db.members.find_one({"id": member_id}, {"user_id": 1, "email": 1})
        if existing and existing.get("user_id") and values["email"] != existing.get("email"):
            raise HTTPException(422, "A linked account's email cannot be changed here")
        await db.members.update_one({"id": member_id}, {"$set": values, "$setOnInsert": {"color": "#387f66", "is_primary": False, "created_at": now().isoformat()}, "$addToSet": {"family_group_ids": group_id}}, upsert=True)
        await db.family_groups.update_one({"id": group_id}, {"$addToSet": {"member_ids": member_id}})
        return await db.members.find_one({"id": member_id}, {"_id": 0})

    @router.delete("/{group_id}/members/{member_id}")
    async def remove_profile(group_id: str, member_id: str, user=Depends(authenticate)):
        group = await group_access(group_id, user, True)
        member = await db.members.find_one({"id": member_id, "family_group_ids": group_id}, {"_id": 0})
        if not member or member.get("is_primary") or member.get("user_id") == group["owner_user_id"]:
            raise HTTPException(422, "The owner or primary member cannot be removed")
        await db.deleted_family_members.update_one({"family_group_id": group_id, "member_id": member_id}, {"$set": {"profile": member, "recover_until": (now() + timedelta(days=30)).isoformat()}}, upsert=True)
        pull = {"member_ids": member_id}
        if member.get("user_id"):
            pull["user_ids"] = member["user_id"]
        await db.family_groups.update_one({"id": group_id}, {"$pull": pull})
        await db.members.update_one({"id": member_id}, {"$pull": {"family_group_ids": group_id}, "$set": {"explicit_membership": True}})
        return {"ok": True}

    @router.get("/{group_id}/deleted-members")
    async def deleted_members(group_id: str, user=Depends(authenticate)):
        await group_access(group_id, user, True)
        return await db.deleted_family_members.find({"family_group_id": group_id, "recover_until": {"$gt": now().isoformat()}}, {"_id": 0}).to_list(100)

    @router.post("/{group_id}/members/{member_id}/restore")
    async def restore_member(group_id: str, member_id: str, user=Depends(authenticate)):
        await group_access(group_id, user, True)
        deleted = await db.deleted_family_members.find_one({"family_group_id": group_id, "member_id": member_id, "recover_until": {"$gt": now().isoformat()}})
        if not deleted:
            raise HTTPException(410, "Recovery period has ended")
        # Restoring a profile never silently restores revoked account access. Send a fresh invitation.
        await db.members.update_one({"id": member_id}, {"$addToSet": {"family_group_ids": group_id}})
        await db.family_groups.update_one({"id": group_id}, {"$addToSet": {"member_ids": member_id}})
        await db.deleted_family_members.delete_one({"family_group_id": group_id, "member_id": member_id})
        return {"ok": True}

    return router
