"""Comprehensive regression tests for DawaiSathi backend.

Covers: members CRUD (with primary seeding), medicines CRUD (member/days/identification),
today endpoint (grouped/member scoping), log/undo dose, refill, checkups CRUD,
attention aggregation, notification preferences GET/PUT.
"""

import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="session")
def api():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ------------------------- health & seeding ---------------------------------
def test_api_root(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert "message" in r.json()


def test_primary_member_seeded(api):
    r = api.get(f"{BASE_URL}/api/members")
    assert r.status_code == 200
    members = r.json()
    assert isinstance(members, list) and len(members) >= 1
    primary = [m for m in members if m.get("is_primary")]
    assert len(primary) == 1, "Exactly one primary member should be seeded"
    assert primary[0]["name"] and primary[0]["color"]


# ------------------------- members CRUD -------------------------------------
def test_members_crud(api):
    created = api.post(f"{BASE_URL}/api/members", json={"name": "TEST_Mom", "role": "Parent"})
    assert created.status_code == 200, created.text
    member = created.json()
    member_id = member["id"]
    try:
        assert member["name"] == "TEST_Mom"
        assert member["is_primary"] is False
        listed = api.get(f"{BASE_URL}/api/members").json()
        assert any(m["id"] == member_id for m in listed)

        upd = api.patch(f"{BASE_URL}/api/members/{member_id}", json={"name": "TEST_MomEdited"})
        assert upd.status_code == 200 and upd.json()["name"] == "TEST_MomEdited"
    finally:
        rm = api.delete(f"{BASE_URL}/api/members/{member_id}")
        assert rm.status_code == 200


def test_cannot_delete_primary_member(api):
    members = api.get(f"{BASE_URL}/api/members").json()
    primary = next(m for m in members if m.get("is_primary"))
    r = api.delete(f"{BASE_URL}/api/members/{primary['id']}")
    assert r.status_code == 400


# ------------------------- medicines CRUD + today --------------------------
def test_medicine_with_member_days_identification_flow(api):
    member = api.post(f"{BASE_URL}/api/members", json={"name": "TEST_Dad"}).json()
    member_id = member["id"]
    payload = {
        "name": "TEST_Metformin",
        "dosage": "500mg",
        "frequency": "Daily",
        "times": ["08:00", "20:00"],
        "instructions": "After food",
        "quantity_total": 30,
        "identification_cue": "White round tablet",
        "member_id": member_id,
        "days": [0, 1, 2, 3, 4, 5, 6],
    }
    created = api.post(f"{BASE_URL}/api/medicines", json=payload)
    assert created.status_code == 200, created.text
    med = created.json()
    med_id = med["id"]
    try:
        assert med["member_id"] == member_id
        assert med["identification_cue"] == "White round tablet"
        assert med["days"] == [0, 1, 2, 3, 4, 5, 6]
        assert med["quantity_remaining"] == 30

        # Today for the member should include both time slots
        today = api.get(f"{BASE_URL}/api/today", params={"member_id": member_id}).json()
        med_doses = [d for d in today["doses"] if d["medicine_id"] == med_id]
        assert len(med_doses) == 2
        assert {d["time"] for d in med_doses} == {"08:00", "20:00"}
        # time_slot mapping
        slot_map = {d["time"]: d["time_slot"] for d in med_doses}
        assert slot_map["08:00"] == "morning"
        assert slot_map["20:00"] == "evening"

        # Log dose then verify appears with log info
        log = api.post(f"{BASE_URL}/api/medicines/{med_id}/dose", json={"time": "08:00"})
        assert log.status_code == 200
        log_id = log.json()["id"]

        today_after = api.get(f"{BASE_URL}/api/today", params={"member_id": member_id}).json()
        taken = [d for d in today_after["doses"] if d["medicine_id"] == med_id and d["time"] == "08:00"]
        assert taken and taken[0]["log_id"] == log_id and taken[0]["logged_at"]

        # Idempotency
        log2 = api.post(f"{BASE_URL}/api/medicines/{med_id}/dose", json={"time": "08:00"})
        assert log2.status_code == 200 and log2.json()["id"] == log_id

        # Undo dose
        undo = api.delete(f"{BASE_URL}/api/medicines/{med_id}/dose", params={"time": "08:00"})
        assert undo.status_code == 200
        after_undo = api.get(f"{BASE_URL}/api/today", params={"member_id": member_id}).json()
        cleared = [d for d in after_undo["doses"] if d["medicine_id"] == med_id and d["time"] == "08:00"]
        assert cleared and cleared[0]["log_id"] is None

        # Refill
        refill = api.post(f"{BASE_URL}/api/medicines/{med_id}/refill", params={"quantity": 10})
        assert refill.status_code == 200 and refill.json()["quantity_remaining"] >= 30

        # Edit
        upd = api.patch(f"{BASE_URL}/api/medicines/{med_id}", json={"dosage": "850mg"})
        assert upd.status_code == 200 and upd.json()["dosage"] == "850mg"

        # Archive & restore
        arch = api.delete(f"{BASE_URL}/api/medicines/{med_id}")
        assert arch.status_code == 200
        listed_active = api.get(f"{BASE_URL}/api/medicines").json()
        assert all(m["id"] != med_id for m in listed_active)
        listed_all = api.get(f"{BASE_URL}/api/medicines", params={"active_only": False}).json()
        assert any(m["id"] == med_id and m["active"] is False for m in listed_all)
        rest = api.post(f"{BASE_URL}/api/medicines/{med_id}/restore")
        assert rest.status_code == 200 and rest.json()["active"] is True
    finally:
        api.delete(f"{BASE_URL}/api/medicines/{med_id}")
        api.delete(f"{BASE_URL}/api/members/{member_id}")


def test_medicine_create_validation(api):
    r = api.post(f"{BASE_URL}/api/medicines", json={"name": "", "dosage": "", "times": []})
    assert r.status_code == 422


def test_today_returns_shared_plus_member(api):
    # Shared medicine (no member)
    shared = api.post(
        f"{BASE_URL}/api/medicines",
        json={"name": "TEST_Shared", "dosage": "1", "times": ["09:00"]},
    ).json()
    member = api.post(f"{BASE_URL}/api/members", json={"name": "TEST_Kid"}).json()
    scoped = api.post(
        f"{BASE_URL}/api/medicines",
        json={"name": "TEST_KidMed", "dosage": "1", "times": ["10:00"], "member_id": member["id"]},
    ).json()
    try:
        today = api.get(f"{BASE_URL}/api/today", params={"member_id": member["id"]}).json()
        ids = {d["medicine_id"] for d in today["doses"]}
        assert shared["id"] in ids and scoped["id"] in ids
    finally:
        api.delete(f"{BASE_URL}/api/medicines/{shared['id']}")
        api.delete(f"{BASE_URL}/api/medicines/{scoped['id']}")
        api.delete(f"{BASE_URL}/api/members/{member['id']}")


# ------------------------- checkups CRUD ------------------------------------
def test_checkups_crud(api):
    scheduled = (datetime.utcnow() + timedelta(hours=6)).isoformat()
    created = api.post(
        f"{BASE_URL}/api/checkups",
        json={"title": "TEST_Cardio", "doctor": "Dr Test", "location": "Clinic", "scheduled_at": scheduled, "notes": "fasting"},
    )
    assert created.status_code == 200, created.text
    cid = created.json()["id"]
    try:
        listed = api.get(f"{BASE_URL}/api/checkups").json()
        assert any(c["id"] == cid for c in listed)

        upd = api.patch(f"{BASE_URL}/api/checkups/{cid}", json={"title": "TEST_CardioEdit"})
        assert upd.status_code == 200 and upd.json()["title"] == "TEST_CardioEdit"

        bad = api.post(
            f"{BASE_URL}/api/checkups",
            json={"title": "TEST_bad", "scheduled_at": "not-a-date"},
        )
        assert bad.status_code == 422

        upcoming = api.get(f"{BASE_URL}/api/upcoming-checkup").json()
        assert upcoming is None or "id" in upcoming
    finally:
        assert api.delete(f"{BASE_URL}/api/checkups/{cid}").status_code == 200
    gone = api.get(f"{BASE_URL}/api/checkups").json()
    assert all(c["id"] != cid for c in gone)


# ------------------------- attention aggregation ----------------------------
def test_attention_returns_items_structure(api):
    # Create a low-stock medicine to guarantee at least one item (refill kind)
    med = api.post(
        f"{BASE_URL}/api/medicines",
        json={"name": "TEST_Low", "dosage": "1", "times": ["06:00"], "quantity_total": 2},
    ).json()
    try:
        r = api.get(f"{BASE_URL}/api/attention")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        refill_items = [i for i in data["items"] if i.get("medicine_id") == med["id"] and i["kind"] == "refill"]
        assert refill_items, "Refill attention item expected for low stock"
    finally:
        api.delete(f"{BASE_URL}/api/medicines/{med['id']}")


# ------------------------- notification preferences -------------------------
def test_notification_preferences_get_put(api):
    r = api.get(f"{BASE_URL}/api/notifications/preferences")
    assert r.status_code == 200
    original = r.json()
    for key in ["medicine_reminders", "checkup_reminders", "reminder_sound", "voice_reminders"]:
        assert key in original

    payload = {**original, "voice_reminders": not original["voice_reminders"]}
    put = api.put(f"{BASE_URL}/api/notifications/preferences", json=payload)
    assert put.status_code == 200 and put.json()["voice_reminders"] == payload["voice_reminders"]

    verify = api.get(f"{BASE_URL}/api/notifications/preferences").json()
    assert verify["voice_reminders"] == payload["voice_reminders"]

    # Restore original
    api.put(f"{BASE_URL}/api/notifications/preferences", json=original)
