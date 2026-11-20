from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any
from ..models import VitalsPayload, MotionPayload, AmbientPayload
from ..storage.redis import RedisCache
from ..profiles import PROFILES
from ..logging import get_logger

log = get_logger("backend.ingest")


def _received_at() -> str:
    """Heure de réception côté serveur.

    last_seen sert à repérer un capteur muet : il doit dire quand le serveur a
    entendu le capteur, pas l'heure affichée par le capteur. L'horloge d'une carte
    Wokwi prend du retard quand son onglet est en arrière-plan ; avec l'horodatage
    du capteur, une carte qui émet passait pour muette. L'heure du capteur reste
    dans measured_at et dans InfluxDB.
    """
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# Au-delà de cet écart avec l'horloge du serveur, l'heure du capteur n'est plus crue.
CLOCK_DRIFT_MAX_S = 30.0


def _storage_time(device_ts: str, received: str) -> str:
    """Horodatage enregistré dans InfluxDB.

    L'heure du capteur, sauf si elle s'écarte de plus de 30 s de celle du serveur :
    une carte Wokwi dont l'onglet est passé en arrière-plan prend des minutes de
    retard, et ses mesures tombaient hors du graphique des 15 dernières minutes.
    """
    try:
        dev = datetime.fromisoformat(device_ts.replace("Z", "+00:00"))
        rec = datetime.fromisoformat(received.replace("Z", "+00:00"))
    except ValueError:
        return received
    if dev.tzinfo is None:
        return received
    return device_ts if abs((rec - dev).total_seconds()) <= CLOCK_DRIFT_MAX_S else received


REASON_MAX_LEN = 200


def parse_device_alert(raw: str | bytes) -> tuple[str, int, str, str | None] | None:
    """(resident_id, level, reason, id) d'une alerte du bracelet, ou None.

    Le topic ehpad/alerts/new porte aussi les alertes du backend : seules celles
    marquees source == "esp32" sont prises. Le broker est public : un resident
    inconnu ou un niveau hors 1..5 est ignore.
    """
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        log.warning("invalid_json", family="device_alert")
        return None
    if not isinstance(data, dict) or data.get("source") != "esp32":
        return None
    rid = data.get("resident_id")
    reason = data.get("reason")
    try:
        level = int(data.get("level"))
    except (TypeError, ValueError):
        level = 0
    if rid not in PROFILES or not 1 <= level <= 5 or not isinstance(reason, str) or not reason:
        log.warning("device_alert_rejected", resident_id=rid, level=data.get("level"))
        return None
    aid = data.get("id")
    if not isinstance(aid, str) or not aid.isalnum() or len(aid) > 64:
        aid = None
    return rid, level, reason[:REASON_MAX_LEN], aid


async def handle(family: str, key: str, raw: str | bytes, cache: RedisCache, influx: Any, publisher: Any | None = None) -> None:
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        log.warning("invalid_json", family=family, key=key)
        return
    try:
        if family == "vitals":
            await _handle_vitals(data, cache, influx, publisher)
        elif family == "motion":
            await _handle_motion(data, cache, influx, publisher)
        elif family in ("ambient", "door"):
            await _handle_ambient(family, data, cache, publisher)
    except Exception as exc:  # noqa: BLE001 -- log and recover; ingest must never crash
        log.error("handler_failed", family=family, key=key, err=str(exc))


async def _handle_vitals(data: dict[str, Any], cache: RedisCache, influx: Any, publisher: Any | None) -> None:
    payload = VitalsPayload.model_validate(data)
    received = _received_at()
    partial: dict[str, Any] = {
        "last_seen": received,
        "measured_at": payload.timestamp,
        "vitals": payload.values.model_dump(),
    }
    sc = data.get("scenario")
    if isinstance(sc, str):
        partial["scenario"] = sc
    merged = await cache.merge_resident_state(payload.resident_id, partial)
    await cache.push_ml_window(payload.resident_id, payload.values.model_dump())
    await influx.write_vitals(payload.resident_id, _storage_time(payload.timestamp, received), payload.values.model_dump())
    if publisher is not None:
        try:
            publisher.publish(f"ehpad/state/resident/{payload.resident_id}",
                              json.dumps({"resident_id": payload.resident_id, **merged}),
                              qos=0)
        except Exception as exc:  # noqa: BLE001
            log.warning("state_publish_failed", resident_id=payload.resident_id, err=str(exc))


async def _handle_motion(data: dict[str, Any], cache: RedisCache, influx: Any, publisher: Any | None) -> None:
    payload = MotionPayload.model_validate(data)
    received = _received_at()
    partial: dict[str, Any] = {
        "last_seen": received,
        "measured_at": payload.timestamp,
        "motion": payload.values.model_dump(),
    }
    sc = data.get("scenario")
    if isinstance(sc, str):
        partial["scenario"] = sc
    merged = await cache.merge_resident_state(payload.resident_id, partial)
    await influx.write_motion(payload.resident_id, _storage_time(payload.timestamp, received), payload.values.model_dump())
    if publisher is not None:
        try:
            publisher.publish(f"ehpad/state/resident/{payload.resident_id}",
                              json.dumps({"resident_id": payload.resident_id, **merged}),
                              qos=0)
        except Exception as exc:  # noqa: BLE001
            log.warning("state_publish_failed", resident_id=payload.resident_id, err=str(exc))


async def _handle_ambient(family: str, data: dict[str, Any], cache: RedisCache, publisher: Any | None) -> None:
    payload = AmbientPayload.model_validate(data)
    room_id = payload.room_id or data.get("room_id") or "unknown"
    field = "pir" if family == "ambient" else "door"
    value = int(payload.values.get("value", 0))
    merged = await cache.merge_room_state(room_id, {
        "room_id": room_id,
        "resident_id": payload.resident_id,
        "last_seen": _received_at(),
        "measured_at": payload.timestamp,
        field: value,
    })
    if publisher is not None:
        try:
            publisher.publish(f"ehpad/state/room/{room_id}", json.dumps(merged), qos=0)
        except Exception as exc:  # noqa: BLE001
            log.warning("room_state_publish_failed", room_id=room_id, err=str(exc))
