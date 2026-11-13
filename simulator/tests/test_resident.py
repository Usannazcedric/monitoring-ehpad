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
