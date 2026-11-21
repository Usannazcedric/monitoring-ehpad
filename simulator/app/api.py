from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Callable
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .resident import Resident
from .scenarios import build


router = APIRouter()
_residents: dict[str, Resident] = {}
_demo_mode: bool = False
# Demo : les residents simules peuvent etre coupes depuis l'onglet Demo. Coupes,
# ils ne publient plus rien et le tableau de bord n'affiche que la chambre 121.
_active: bool = True
_publish: Callable[[str, dict[str, Any]], None] | None = None


def init(residents: dict[str, Resident], demo_mode: bool, active: bool = True,
         publish: Callable[[str, dict[str, Any]], None] | None = None) -> None:
    global _residents, _demo_mode, _active, _publish
    _residents = residents
    _demo_mode = demo_mode
    _active = active
    _publish = publish


def is_active() -> bool:
    return _active


def _settle(r: Resident, now: datetime) -> None:
    """Remet un resident au calme et publie une derniere mesure saine.

    Le backend garde le dernier etat recu 60 s : sans cette mesure, une chute ou
    un malaise injecte recreerait l'alerte juste apres sa cloture.
    """
    r._active_scenario = None  # type: ignore[attr-defined]
    r.scenario = "normal"
    r.calm = True
    r.activity = "lying" if r.profile.mobility == "bedridden" else "idle"
    if _publish is None:
        return
    ts = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    _publish(f"ehpad/vitals/resident/{r.profile.id}", r.tick(now))
    _publish(f"ehpad/motion/resident/{r.profile.id}", r.tick_motion(now))
    for kind in ("pir", "door"):
        topic = "ambient" if kind == "pir" else "door"
        _publish(f"ehpad/{topic}/room/{r.profile.room}",
                 {"timestamp": ts, "room_id": r.profile.room, "resident_id": r.profile.id,
                  "values": {"type": kind, "value": 0}, "seq": 0})


class ScenarioBody(BaseModel):
    name: str


@router.get("/health")
def health():
    return {"status": "ok", "residents": len(_residents)}


@router.get("/residents")
def list_residents():
    return [r.profile.model_dump() for r in _residents.values()]


class CalmBody(BaseModel):
    on: bool


class ActiveBody(BaseModel):
    on: bool


@router.get("/active")
def get_active():
    return {"on": _active, "residents": len(_residents)}


@router.post("/active")
def set_active(body: ActiveBody):
    """Active ou coupe tous les residents simules (onglet Demo)."""
    global _active
    if not body.on and _active:
        now = datetime.now(timezone.utc)
        for r in _residents.values():
            _settle(r, now)
    _active = body.on
    return {"on": _active, "residents": len(_residents)}


@router.get("/calm")
def get_calm():
    return {"on": any(r.calm for r in _residents.values())}


@router.post("/calm")
def set_calm(body: CalmBody):
    """Mode démo : constantes saines pour tous les résidents simulés (ou retour aux profils)."""
    for r in _residents.values():
        r.calm = body.on
    return {"on": body.on, "residents": len(_residents)}


@router.post("/scenario/{resident_id}")
def inject_scenario(resident_id: str, body: ScenarioBody):
    if resident_id not in _residents:
        raise HTTPException(404, f"unknown resident {resident_id}")
    if not _active:
        raise HTTPException(409, "residents simules coupes : les activer dans l'onglet Demo")
    try:
        scenario = build(body.name, demo_mode=_demo_mode)
    except KeyError:
        raise HTTPException(400, f"unknown scenario {body.name}")
    r = _residents[resident_id]
    scenario.apply(r, datetime.now(timezone.utc))
    r._active_scenario = scenario  # type: ignore[attr-defined]
    return {"resident_id": resident_id, "scenario": body.name}
