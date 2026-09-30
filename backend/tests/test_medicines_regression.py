import os

import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL")


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def test_medicine_crud_and_dose_flow(api_client):
    payload = {
        "name": "TEST_regression_medicine",
        "dosage": "1 tablet",
        "frequency": "Daily",
        "times": ["08:00"],
        "instructions": "After breakfast",
        "quantity_total": 10,
    }
    created = api_client.post(f"{BASE_URL}/api/medicines", json=payload)
    assert created.status_code == 200
    medicine = created.json()
    medicine_id = medicine["id"]
    try:
        listed = api_client.get(
            f"{BASE_URL}/api/medicines",
            params={"family_group_id": medicine["family_group_id"]},
        ).json()
        assert any(item["id"] == medicine_id and item["name"] == payload["name"] for item in listed)
        today_params = {
            "member_id": medicine["member_id"],
            "family_group_id": medicine["family_group_id"],
        }
        today = api_client.get(f"{BASE_URL}/api/today", params=today_params).json()
        scheduled = next(dose for dose in today["doses"] if dose["medicine_id"] == medicine_id)
        assert scheduled["time"] == "08:00"
        assert scheduled["logged_at"] is None and scheduled["log_id"] is None

        logged = api_client.post(f"{BASE_URL}/api/medicines/{medicine_id}/dose", json={"time": "08:00"})
        assert logged.status_code == 200, logged.text
        dose_log = logged.json()
        assert dose_log["medicine_id"] == medicine_id

        today_after = api_client.get(f"{BASE_URL}/api/today", params=today_params).json()
        taken = next(dose for dose in today_after["doses"] if dose["medicine_id"] == medicine_id)
        assert taken["logged_at"] == dose_log["logged_at"]
        assert taken["log_id"] == dose_log["id"]

        refreshed_today = api_client.get(f"{BASE_URL}/api/today", params=today_params).json()
        persisted = next(dose for dose in refreshed_today["doses"] if dose["medicine_id"] == medicine_id)
        assert persisted["logged_at"] == dose_log["logged_at"]
        assert persisted["log_id"] == dose_log["id"]

        updated = api_client.patch(f"{BASE_URL}/api/medicines/{medicine_id}", json={"dosage": "2 tablets"})
        assert updated.status_code == 200 and updated.json()["dosage"] == "2 tablets"
        history = api_client.get(
            f"{BASE_URL}/api/doses/history",
            params={"limit": 100, "family_group_id": medicine["family_group_id"]},
        ).json()
        assert any(entry["medicine_id"] == medicine_id for entry in history)
    finally:
        assert api_client.delete(f"{BASE_URL}/api/medicines/{medicine_id}").status_code == 200


def test_create_requires_name_dosage_and_time(api_client):
    response = api_client.post(f"{BASE_URL}/api/medicines", json={"name": "", "dosage": "", "times": []})
    assert response.status_code == 422