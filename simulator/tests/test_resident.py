from __future__ import annotations
from datetime import datetime, timezone
from app.profiles import Profile, Baseline, Routine
from app.resident import Resident


def make_profile() -> Profile:
    return Profile(
        id="R999",
        name="Test",
        age=80,
        room="999",
        mobility="autonomous",
        pathologies=[],
        baseline=Baseline(hr=70, spo2=98, sys=130, dia=80, temp=36.8),
        routine=Routine(wake="07:00", sleep="22:00", meals=["08:00", "12:30", "19:00"]),
    )


def test_tick_returns_vitals_within_baseline_band():
    r = Resident.from_profile(make_profile(), seed=42)
    now = datetime(2026, 4, 29, 10, 0, 0, tzinfo=timezone.utc)
    reading = r.tick(now)
    v = reading["vitals"]
    assert 60 <= v["hr"] <= 90
    assert 90 <= v["spo2"] <= 100
    assert 35.5 <= v["temp"] <= 38.0
    assert v["sys"] >= v["dia"]


def test_tick_seq_is_monotonic():
    r = Resident.from_profile(make_profile(), seed=42)
    now = datetime(2026, 4, 29, 10, 0, 0, tzinfo=timezone.utc)
    seqs = [r.tick(now)["seq"] for _ in range(5)]
    assert seqs == sorted(seqs)
    assert len(set(seqs)) == 5


def test_calm_mode_replaces_a_pathological_baseline():
    from app.profiles import Profile, Baseline, Routine
    sick = Profile(
        id="R901", name="X", age=90, room="901", mobility="bedridden", pathologies=[],
        baseline=Baseline(hr=35, spo2=82, sys=90, dia=55, temp=36.2),
        routine=Routine(wake="07:00", sleep="22:00", meals=["08:00", "12:30", "19:00"]),
    )
    r = Resident.from_profile(sick, seed=1)
    r.activity = "sitting"
    r.calm = True
    v = r.tick(datetime(2026, 11, 13, 3, 0, tzinfo=timezone.utc))["values"]
    assert 60 <= v["hr"] <= 85
    assert v["spo2"] >= 95


def test_active_toggle_settles_residents_and_blocks_scenarios():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app import api

    r = Resident.from_profile(make_profile(), seed=1)
    r.activity = "fall"
    r.scenario = "fall"
    sent: list[tuple[str, dict]] = []
    api.init({"R999": r}, demo_mode=True, active=True, publish=lambda t, p: sent.append((t, p)))
    app = FastAPI()
    app.include_router(api.router)
    client = TestClient(app)

    assert client.get("/active").json() == {"on": True, "residents": 1}
    assert client.post("/active", json={"on": False}).json()["on"] is False
    assert api.is_active() is False
    # Une derniere mesure saine, puis plus rien : le backend ne recree pas l'alerte.
    assert r.calm is True and r.scenario == "normal" and r.activity != "fall"
    topics = [t for t, _ in sent]
    assert "ehpad/vitals/resident/R999" in topics
    motion = dict(sent)["ehpad/motion/resident/R999"]
    assert motion["values"]["activity"] != "fall"
    assert dict(sent)["ehpad/door/room/999"]["values"]["value"] == 0
    # Coupe : pas de scenario injecte
    assert client.post("/scenario/R999", json={"name": "fall"}).status_code == 409

    assert client.post("/active", json={"on": True}).json()["on"] is True
    assert client.post("/scenario/R999", json={"name": "normal"}).status_code == 200
