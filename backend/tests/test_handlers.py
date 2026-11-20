from __future__ import annotations
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
import fakeredis.aioredis
from app.storage.redis import RedisCache
from app.ingest.handlers import handle


@pytest.fixture
async def cache():
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield RedisCache(client=fake)
    await fake.aclose()


@pytest.fixture
def influx():
    w = MagicMock()
    w.write_vitals = AsyncMock()
    w.write_motion = AsyncMock()
    return w


async def test_vitals_handler_writes_redis_and_influx(cache, influx):
    payload = json.dumps({
        "timestamp": "2026-04-29T10:00:00.000Z",
        "resident_id": "R007",
        "values": {"hr": 78, "spo2": 96, "sys": 132, "dia": 80, "temp": 36.8},
        "seq": 1,
    })
    await handle("vitals", "R007", payload, cache, influx)
    state = await cache.get_resident_state("R007")
    assert state and state["vitals"]["hr"] == 78
    # last_seen = réception par le serveur (récente), measured_at = heure du capteur
    assert state["measured_at"] == "2026-04-29T10:00:00.000Z"
    received = datetime.fromisoformat(state["last_seen"].replace("Z", "+00:00"))
    assert abs((datetime.now(timezone.utc) - received).total_seconds()) < 5
    influx.write_vitals.assert_awaited_once()


async def test_motion_handler_writes_redis_and_influx(cache, influx):
    payload = json.dumps({
        "timestamp": "2026-04-29T10:00:00.000Z",
        "resident_id": "R007",
        "values": {"ax": 0.0, "ay": 9.8, "az": 0.0, "activity": "lying"},
        "seq": 1,
    })
    await handle("motion", "R007", payload, cache, influx)
    state = await cache.get_resident_state("R007")
    assert state["motion"]["activity"] == "lying"
    influx.write_motion.assert_awaited_once()


async def test_invalid_payload_does_not_crash(cache, influx):
    await handle("vitals", "R007", "{not-json", cache, influx)
    assert await cache.get_resident_state("R007") is None
    influx.write_vitals.assert_not_awaited()


async def test_unknown_family_is_ignored(cache, influx):
    await handle("ambient", "101", '{"timestamp":"x","values":{},"seq":1}', cache, influx)
    influx.write_vitals.assert_not_awaited()
    influx.write_motion.assert_not_awaited()


def test_storage_time_keeps_device_clock_when_close():
    from app.ingest.handlers import _storage_time
    assert _storage_time("2026-11-20T10:00:05.000Z", "2026-11-20T10:00:00.000Z") == "2026-11-20T10:00:05.000Z"


def test_storage_time_uses_server_clock_when_device_drifts():
    # Carte Wokwi en arrière-plan : 16 min de retard, on garde l'heure de réception.
    from app.ingest.handlers import _storage_time
    assert _storage_time("2026-11-20T09:44:00.000Z", "2026-11-20T10:00:00.000Z") == "2026-11-20T10:00:00.000Z"
    assert _storage_time("pas une date", "2026-11-20T10:00:00.000Z") == "2026-11-20T10:00:00.000Z"


def _device_alert(**over):
    import json as _json
    base = {"id": "a1b2", "resident_id": "R021", "level": 2,
            "reason": "bracelet non porte depuis 30 s", "source": "esp32"}
    base.update(over)
    return _json.dumps(base)


def test_parse_device_alert_accepts_bracelet_alert():
    from app.ingest.handlers import parse_device_alert
    assert parse_device_alert(_device_alert()) == ("R021", 2, "bracelet non porte depuis 30 s", "a1b2")


def test_parse_device_alert_ignores_backend_own_alerts():
    import json as _json
    from app.ingest.handlers import parse_device_alert
    own = _json.loads(_device_alert())
    del own["source"]
    assert parse_device_alert(_json.dumps(own)) is None


def test_parse_device_alert_rejects_unknown_resident_and_bad_level():
    from app.ingest.handlers import parse_device_alert
    assert parse_device_alert(_device_alert(resident_id="R999")) is None
    assert parse_device_alert(_device_alert(level=9)) is None
    assert parse_device_alert(_device_alert(level="x")) is None
    assert parse_device_alert(b"not json") is None


def test_parse_device_alert_drops_odd_id():
    from app.ingest.handlers import parse_device_alert
    assert parse_device_alert(_device_alert(id="../x"))[3] is None
