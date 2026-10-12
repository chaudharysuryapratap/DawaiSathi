import asyncio
from unittest.mock import AsyncMock
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
import server


def test_ready_pings_mongodb(monkeypatch):
    command = AsyncMock(return_value={"ok": 1})
    monkeypatch.setattr(server, "client", SimpleNamespace(admin=SimpleNamespace(command=command)))
    assert asyncio.run(server.ready()) == {"status": "ok"}
    command.assert_awaited_once_with("ping")


def test_unready_hides_database_error(monkeypatch):
    command = AsyncMock(side_effect=RuntimeError("private connection details"))
    monkeypatch.setattr(server, "client", SimpleNamespace(admin=SimpleNamespace(command=command)))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.ready())
    assert error.value.status_code == 503
    assert error.value.detail == "Service is not ready"
