"""Backend tests for staggered eye-drop protocols and regressions on today/attention."""

import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://smooth-ui-3.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- protocol CRUD ---------------------------------------------------
def test_create_list_update_archive_protocol(api):
    payload = {
        "name": "TEST_EyeProto",
        "start_time": "08:00",
        "interval_minutes": 5,
        "steps": [
            {"medicine_name": "TEST_DropA", "dose": "1 drop", "eye": "left"},
            {"medicine_name": "TEST_DropB", "dose": "1 drop", "eye": "right"},
            {"medicine_name": "TEST_DropC", "dose": "1 drop", "eye": "both"},
        ],
    }
    r = api.post(f"{BASE_URL}/api/eye-drop-protocols", json=payload)
    assert r.status_code == 200, r.text
    proto = r.json()
    pid = proto["id"]
    try:
        assert proto["name"] == "TEST_EyeProto"
        assert proto["start_time"] == "08:00"
        assert proto["interval_minutes"] == 5
        assert proto["active"] is True
        assert len(proto["steps"]) == 3
        orders = [s["order"] for s in proto["steps"]]
        assert orders == [1, 2, 3]
        eyes = [s["eye"] for s in proto["steps"]]
        assert eyes == ["left", "right", "both"]

        listed = api.get(f"{BASE_URL}/api/eye-drop-protocols").json()
        assert any(p["id"] == pid for p in listed)

        upd = api.patch(
            f"{BASE_URL}/api/eye-drop-protocols/{pid}",
            json={"interval_minutes": 10, "name": "TEST_EyeProto2"},
        )
        assert upd.status_code == 200
        assert upd.json()["interval_minutes"] == 10
        assert upd.json()["name"] == "TEST_EyeProto2"

        # Reorder steps (send in a different order and change one eye)
        new_steps = [
            {"medicine_name": "TEST_DropC", "dose": "1 drop", "eye": "left"},
            {"medicine_name": "TEST_DropA", "dose": "2 drops", "eye": "right"},
        ]
        upd2 = api.patch(
            f"{BASE_URL}/api/eye-drop-protocols/{pid}",
            json={"steps": new_steps},
        )
        assert upd2.status_code == 200
        s2 = upd2.json()["steps"]
        assert [x["order"] for x in s2] == [1, 2]
        assert s2[0]["medicine_name"] == "TEST_DropC" and s2[0]["eye"] == "left"
        assert s2[1]["medicine_name"] == "TEST_DropA" and s2[1]["dose"] == "2 drops"
    finally:
        arch = api.delete(f"{BASE_URL}/api/eye-drop-protocols/{pid}")
        assert arch.status_code == 200
        remaining = api.get(f"{BASE_URL}/api/eye-drop-protocols").json()
        assert all(p["id"] != pid for p in remaining)
        with_arch = api.get(
            f"{BASE_URL}/api/eye-drop-protocols", params={"active_only": False}
        ).json()
        assert any(p["id"] == pid and p["active"] is False for p in with_arch)


def test_protocol_validation(api):
    r = api.post(
        f"{BASE_URL}/api/eye-drop-protocols",
        json={"name": "", "start_time": "08:00", "interval_minutes": 5, "steps": []},
    )
    assert r.status_code == 422


# ---------- step logging + idempotency + undo ------------------------------
def test_step_log_idempotent_and_undo(api):
    payload = {
        "name": "TEST_LogProto",
        "start_time": "08:00",
        "interval_minutes": 5,
        "steps": [
            {"medicine_name": "TEST_L1", "dose": "1 drop", "eye": "left"},
            {"medicine_name": "TEST_L2", "dose": "1 drop", "eye": "right"},
        ],
    }
    proto = api.post(f"{BASE_URL}/api/eye-drop-protocols", json=payload).json()
    pid = proto["id"]
    try:
        r = api.post(f"{BASE_URL}/api/eye-drop-protocols/{pid}/step/1/log")
        assert r.status_code == 200, r.text
        log1 = r.json()
        assert log1["protocol_id"] == pid
        assert log1["step_order"] == 1
        assert log1["time"] == "08:00"
        assert log1["eye"] == "left"

        # Idempotent
        r2 = api.post(f"{BASE_URL}/api/eye-drop-protocols/{pid}/step/1/log")
        assert r2.status_code == 200 and r2.json()["id"] == log1["id"]

        # History reflects it
        hist = api.get(
            f"{BASE_URL}/api/eye-drop-protocols/history",
            params={"protocol_id": pid},
        )
        assert hist.status_code == 200
        assert any(h["id"] == log1["id"] for h in hist.json())

        # today includes computed times + logged_at
        today = api.get(f"{BASE_URL}/api/today").json()
        entry = next((p for p in today.get("protocols", []) if p["protocol_id"] == pid), None)
        assert entry is not None
        assert entry["start_time"] == "08:00"
        assert entry["interval_minutes"] == 5
        assert entry["end_time"] == "08:05"
        assert entry["time_slot"] == "morning"
        assert len(entry["steps"]) == 2
        step_times = [s["time"] for s in entry["steps"]]
        assert step_times == ["08:00", "08:05"]
        step1 = next(s for s in entry["steps"] if s["order"] == 1)
        step2 = next(s for s in entry["steps"] if s["order"] == 2)
        assert step1["log_id"] == log1["id"] and step1["logged_at"]
        assert step2["log_id"] is None

        # Log step not found
        r_bad = api.post(f"{BASE_URL}/api/eye-drop-protocols/{pid}/step/99/log")
        assert r_bad.status_code == 404

        # Undo
        undo = api.delete(f"{BASE_URL}/api/eye-drop-protocols/{pid}/step/1/log")
        assert undo.status_code == 200
        after = api.get(f"{BASE_URL}/api/today").json()
        entry_after = next(p for p in after["protocols"] if p["protocol_id"] == pid)
        step1_after = next(s for s in entry_after["steps"] if s["order"] == 1)
        assert step1_after["log_id"] is None

        # Undo again -> 404
        undo2 = api.delete(f"{BASE_URL}/api/eye-drop-protocols/{pid}/step/1/log")
        assert undo2.status_code == 404
    finally:
        api.delete(f"{BASE_URL}/api/eye-drop-protocols/{pid}")


def test_log_on_archived_protocol_rejected(api):
    proto = api.post(
        f"{BASE_URL}/api/eye-drop-protocols",
        json={
            "name": "TEST_Arch",
            "start_time": "09:00",
            "interval_minutes": 5,
            "steps": [{"medicine_name": "TEST_A", "dose": "1 drop", "eye": "both"}],
        },
    ).json()
    pid = proto["id"]
    api.delete(f"{BASE_URL}/api/eye-drop-protocols/{pid}")
    r = api.post(f"{BASE_URL}/api/eye-drop-protocols/{pid}/step/1/log")
    assert r.status_code == 404


# ---------- attention: late/missed steps for protocols ----------------------
def test_attention_includes_protocol_step(api):
    """Create a protocol whose first step time is >=15 minutes in the past."""
    now = datetime.now()
    past = (now - timedelta(minutes=30)).strftime("%H:%M")
    proto = api.post(
        f"{BASE_URL}/api/eye-drop-protocols",
        json={
            "name": "TEST_LateProto",
            "start_time": past,
            "interval_minutes": 1,
            "steps": [{"medicine_name": "TEST_Late", "dose": "1 drop", "eye": "left"}],
        },
    ).json()
    pid = proto["id"]
    try:
        r = api.get(f"{BASE_URL}/api/attention")
        assert r.status_code == 200
        items = r.json()["items"]
        proto_items = [i for i in items if i.get("protocol_id") == pid]
        assert proto_items, "Expected an attention item for the past protocol step"
        assert proto_items[0]["kind"] in {"late-dose", "missed-dose"}
    finally:
        api.delete(f"{BASE_URL}/api/eye-drop-protocols/{pid}")


# ---------- regression: medicine/dose/checkup still work --------------------
def test_regression_medicine_and_checkup(api):
    med = api.post(
        f"{BASE_URL}/api/medicines",
        json={"name": "TEST_RegMed", "dosage": "1", "times": ["07:00"]},
    )
    assert med.status_code == 200, med.text
    mid = med.json()["id"]
    scheduled = (datetime.utcnow() + timedelta(hours=6)).isoformat()
    chk = api.post(
        f"{BASE_URL}/api/checkups",
        json={"title": "TEST_RegChk", "scheduled_at": scheduled},
    )
    assert chk.status_code == 200
    cid = chk.json()["id"]
    try:
        log = api.post(f"{BASE_URL}/api/medicines/{mid}/dose", json={"time": "07:00"})
        assert log.status_code == 200
        today = api.get(f"{BASE_URL}/api/today").json()
        assert "doses" in today and "protocols" in today
        assert any(d["medicine_id"] == mid for d in today["doses"])
        api.delete(f"{BASE_URL}/api/medicines/{mid}/dose", params={"time": "07:00"})
    finally:
        api.delete(f"{BASE_URL}/api/medicines/{mid}")
        api.delete(f"{BASE_URL}/api/checkups/{cid}")
