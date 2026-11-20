from __future__ import annotations
import pytest
import fakeredis.aioredis
from unittest.mock import AsyncMock, MagicMock
from app.alerts.store import AlertStore
from app.alerts.engine import AlertEngine


@pytest.fixture
async def deps():
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    influx = MagicMock()
    influx.write_alert = AsyncMock()
    store = AlertStore(fake, influx)
    publisher = MagicMock()
    publisher.publish_new = AsyncMock()
    publisher.publish_update = AsyncMock()
    escalation = MagicMock()
    escalation.schedule = MagicMock()
    escalation.cancel = MagicMock()
    engine = AlertEngine(store=store, publisher=publisher, escalation=escalation)
    yield engine, store, publisher, escalation
    await fake.aclose()


async def test_no_alert_when_state_normal(deps):
    engine, store, pub, _esc = deps
    state = {
        "vitals": {"hr": 72, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8},
        "motion": {"ax": 0, "ay": 9.8, "az": 0, "activity": "walking"},
        "last_seen": "x",
    }
    await engine.evaluate_resident("R001", state)
    assert (await store.get_active_for_resident("R001")) is None
    pub.publish_new.assert_not_awaited()


async def test_creates_new_alert_on_first_trigger(deps):
    engine, store, pub, esc = deps
    state = {
        "vitals": {"hr": 72, "spo2": 91, "sys": 130, "dia": 80, "temp": 36.8},  # ALERTE
        "motion": {"activity": "walking"},
        "last_seen": "x",
    }
    await engine.evaluate_resident("R001", state)
    a = await store.get_active_for_resident("R001")
    assert a is not None
    assert a.level == 3
    pub.publish_new.assert_awaited_once()
    esc.schedule.assert_called_once()


async def test_escalates_when_level_increases(deps):
    engine, store, pub, esc = deps
    s_attn = {"vitals": {"hr": 110, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8}, "motion": {"activity": "walking"}, "last_seen": "x"}
    s_urg = {"vitals": {"hr": 150, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8}, "motion": {"activity": "walking"}, "last_seen": "x"}
    await engine.evaluate_resident("R001", s_attn)
    pub.publish_new.assert_awaited_once()
    await engine.evaluate_resident("R001", s_urg)
    a = await store.get_active_for_resident("R001")
    assert a.level == 4
    pub.publish_update.assert_awaited_once()


async def test_does_not_downgrade_active_alert(deps):
    engine, store, pub, _esc = deps
    s_urg = {"vitals": {"hr": 150, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8}, "motion": {"activity": "walking"}, "last_seen": "x"}
    s_normal = {"vitals": {"hr": 72, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8}, "motion": {"activity": "walking"}, "last_seen": "x"}
    await engine.evaluate_resident("R001", s_urg)
    await engine.evaluate_resident("R001", s_normal)
    a = await store.get_active_for_resident("R001")
    assert a is not None
    assert a.level == 4  # sticky


async def test_device_alert_is_stored_with_device_id(deps):
    engine, store, pub, esc = deps
    await engine.raise_device_alert("R021", 2, "bracelet non porte depuis 30 s", alert_id="abc123")
    a = await store.get_active_for_resident("R021")
    assert a is not None
    assert a.id == "abc123"
    assert a.level == 2
    pub.publish_new.assert_awaited_once()
    esc.schedule.assert_called_once()


async def test_device_sos_upgrades_existing_alert(deps):
    engine, store, pub, _esc = deps
    await engine.raise_device_alert("R021", 2, "bracelet non porte depuis 30 s")
    await engine.raise_device_alert("R021", 5, "appel SOS du resident")
    a = await store.get_active_for_resident("R021")
    assert a.level == 5
    assert a.reason == "appel SOS du resident"
    pub.publish_update.assert_awaited_once()


async def test_device_alert_does_not_downgrade(deps):
    engine, store, pub, _esc = deps
    await engine.raise_device_alert("R021", 5, "appel SOS du resident")
    await engine.raise_device_alert("R021", 1, "chute annulee par la residente")
    a = await store.get_active_for_resident("R021")
    assert a.level == 5
    pub.publish_update.assert_not_awaited()


async def test_device_alert_id_already_used_gets_a_new_one(deps):
    engine, store, _pub, _esc = deps
    first = await store.create("R021", 2, "x", alert_id="dup1")
    await store.set_status(first.id, "resolved")
    await engine.raise_device_alert("R021", 2, "bracelet non porte depuis 30 s", alert_id="dup1")
    a = await store.get_active_for_resident("R021")
    assert a is not None and a.id != "dup1"
