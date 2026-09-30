import asyncio
import uuid

import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import ValidationError

import server


@pytest.fixture
def isolated_database(monkeypatch):
    database_name = f"dawaisathi_test_{uuid.uuid4().hex}"
    loop = asyncio.new_event_loop()
    test_client = AsyncIOMotorClient(
        server.mongo_url,
        io_loop=loop,
        serverSelectionTimeoutMS=3000,
    )
    database = test_client[database_name]
    monkeypatch.setattr(server, "db", database)

    try:
        loop.run_until_complete(server.startup_event())
        yield loop, database
    finally:
        loop.run_until_complete(test_client.drop_database(database_name))
        test_client.close()
        loop.close()


def test_medicine_and_dose_writes_are_read_back_from_mongodb(isolated_database):
    loop, database = isolated_database

    async def exercise():
        family_group = (await server.list_family_groups())[0]
        member = await database.members.find_one(
            {"family_group_ids": family_group.id},
            {"_id": 0},
        )
        medicine = await server.create_medicine(
            server.MedicineCreate(
                name="Persistence regression medicine",
                dosage="1 tablet",
                times=["08:00"],
                quantity_total=3,
                member_id=member["id"],
                family_group_id=family_group.id,
            )
        )

        stored_medicine = await database.medicines.find_one(
            {"id": medicine.id},
            {"_id": 0},
        )
        listed = await server.list_medicines(
            member_id=None,
            family_group_id=family_group.id,
        )
        assert stored_medicine["member_id"] == member["id"]
        assert stored_medicine["family_group_id"] == family_group.id
        assert any(item.id == medicine.id for item in listed)

        first_log = await server.log_dose(
            medicine.id,
            server.DoseLogCreate(time="08:00"),
        )
        duplicate_log = await server.log_dose(
            medicine.id,
            server.DoseLogCreate(time="08:00"),
        )
        stored_log = await database.dose_logs.find_one(
            {"id": first_log.id},
            {"_id": 0},
        )
        history = await server.dose_history(
            limit=50,
            family_group_id=family_group.id,
        )
        today = await server.today(member["id"], family_group.id)
        updated_medicine = await database.medicines.find_one(
            {"id": medicine.id},
            {"_id": 0},
        )

        assert duplicate_log.id == first_log.id
        assert stored_log["quantity_deducted"] is True
        assert any(item.id == first_log.id for item in history)
        assert next(dose for dose in today.doses if dose.medicine_id == medicine.id).log_id == first_log.id
        assert updated_medicine["quantity_remaining"] == 2

        await server.undo_dose(medicine.id, time="08:00")
        assert await database.dose_logs.count_documents({"medicine_id": medicine.id}) == 0
        restored_medicine = await database.medicines.find_one(
            {"id": medicine.id},
            {"_id": 0},
        )
        assert restored_medicine["quantity_remaining"] == 3

    loop.run_until_complete(exercise())


def test_invalid_associations_and_unscheduled_doses_do_not_write(isolated_database):
    loop, database = isolated_database

    async def exercise():
        family_group = (await server.list_family_groups())[0]
        with pytest.raises(ValidationError):
            server.MedicineCreate(
                name="Malformed schedule",
                dosage="1 tablet",
                times=["8am"],
                family_group_id=family_group.id,
            )
        with pytest.raises(HTTPException) as invalid_member:
            await server.create_medicine(
                server.MedicineCreate(
                    name="Invalid owner",
                    dosage="1 tablet",
                    times=["08:00"],
                    member_id=str(uuid.uuid4()),
                    family_group_id=family_group.id,
                )
            )
        assert invalid_member.value.status_code == 422
        assert await database.medicines.count_documents({}) == 0

        medicine = await server.create_medicine(
            server.MedicineCreate(
                name="Scheduled-dose regression medicine",
                dosage="1 tablet",
                times=["08:00"],
                quantity_total=2,
                family_group_id=family_group.id,
            )
        )
        with pytest.raises(HTTPException) as unscheduled:
            await server.log_dose(
                medicine.id,
                server.DoseLogCreate(time="09:00"),
            )
        assert unscheduled.value.status_code == 422
        assert await database.dose_logs.count_documents({}) == 0
        stored_medicine = await database.medicines.find_one({"id": medicine.id})
        assert stored_medicine["quantity_remaining"] == 2

    loop.run_until_complete(exercise())


def test_database_write_failure_is_not_reported_as_success(monkeypatch):
    family_group_id = str(uuid.uuid4())

    class FamilyGroups:
        async def find_one(self, query, projection=None):
            return {"id": family_group_id, "name": "Test"}

    class Medicines:
        async def insert_one(self, document):
            raise RuntimeError("simulated MongoDB write failure")

        async def find_one(self, query, projection=None):
            return {
                "id": str(uuid.uuid4()),
                "name": "Failed dose",
                "dosage": "1 tablet",
                "times": ["08:00"],
                "active": True,
                "family_group_id": family_group_id,
                "quantity_remaining": 1,
            }

    class DoseLogs:
        async def find_one(self, query, projection=None):
            return None

        async def insert_one(self, document):
            raise RuntimeError("simulated MongoDB dose write failure")

    class FailingDatabase:
        family_groups = FamilyGroups()
        medicines = Medicines()
        dose_logs = DoseLogs()

    monkeypatch.setattr(server, "db", FailingDatabase())
    loop = asyncio.new_event_loop()
    try:
        with pytest.raises(RuntimeError, match="simulated MongoDB write failure"):
            loop.run_until_complete(
                server.create_medicine(
                    server.MedicineCreate(
                        name="Failed write",
                        dosage="1 tablet",
                        times=["08:00"],
                        family_group_id=family_group_id,
                    )
                )
            )
        with pytest.raises(RuntimeError, match="simulated MongoDB dose write failure"):
            loop.run_until_complete(
                server.log_dose(
                    "test-medicine",
                    server.DoseLogCreate(time="08:00"),
                )
            )
    finally:
        loop.close()
