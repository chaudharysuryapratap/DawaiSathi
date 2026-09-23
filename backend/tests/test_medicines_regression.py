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
    payload = {"name": "TEST_regression_medicine", "dosage": "1 tablet", "frequency": "Daily", "times": ["08:00"], "instructions": "After breakfast", "quantity_total": 10}
    created = api_client.post(f"{BASE_URL}/api/medicines", json=payload)
    assert created.status_code == 200
    medicine_id = created.json()["id"]
    try:
        listed = api_client.get(f"{BASE_URL}/api/medicines").json()
        assert any(item["id"] == medicine_id and item["name"] == payload["name"] for item in listed)
        today = api_client.get(f"{BASE_URL}/api/today").json()
        assert any(dose["medicine_id"] == medicine_id and dose["status"] == "upcoming" for dose in today["doses"])
        logged = api_client.post(f"{BASE_URL}/api/medicines/{medicine_id}/dose", json={"time": "08:00"})
        assert logged.status_code == 200 and logged.json()["medicine_id"] == medicine_id
        today_after = api_client.get(f"{BASE_URL}/api/today").json()
        assert any(dose["medicine_id"] == medicine_id and dose["status"] == "taken" for dose in today_after["doses"])
        updated = api_client.patch(f"{BASE_URL}/api/medicines/{medicine_id}", json={"dosage": "2 tablets"})
        assert updated.status_code == 200 and updated.json()["dosage"] == "2 tablets"
        history = api_client.get(f"{BASE_URL}/api/doses/history?limit=100").json()
        assert any(entry["medicine_id"] == medicine_id for entry in history)
    finally:
        assert api_client.delete(f"{BASE_URL}/api/medicines/{medicine_id}").status_code == 200


def test_create_requires_name_dosage_and_time(api_client):
    response = api_client.post(f"{BASE_URL}/api/medicines", json={"name": "", "dosage": "", "times": []})
    assert response.status_code == 422