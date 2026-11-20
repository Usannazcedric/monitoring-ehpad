from __future__ import annotations
from typing import Tuple


VITALS_PREFIX = "ehpad/vitals/resident/"
MOTION_PREFIX = "ehpad/motion/resident/"
AMBIENT_PREFIX = "ehpad/ambient/room/"
DOOR_PREFIX = "ehpad/door/room/"
# Alertes publiees par le bracelet (SOS, bracelet retire, annulation). Le backend
# publie aussi les siennes sur ce topic : main.py ne garde que source == "esp32".
DEVICE_ALERT_TOPIC = "ehpad/alerts/new"

SUBSCRIBE_PATTERNS: list[str] = [
    "ehpad/vitals/resident/+",
    "ehpad/motion/resident/+",
    "ehpad/ambient/room/+",
    "ehpad/door/room/+",
    DEVICE_ALERT_TOPIC,
]


def parse(topic: str) -> Tuple[str, str | None]:
    """Return (family, identifier) for a known topic, or ("other", None)."""
    if topic == DEVICE_ALERT_TOPIC:
        return "device_alert", "new"
    for prefix, fam in (
        (VITALS_PREFIX, "vitals"),
        (MOTION_PREFIX, "motion"),
        (AMBIENT_PREFIX, "ambient"),
        (DOOR_PREFIX, "door"),
    ):
        if topic.startswith(prefix):
            return fam, topic[len(prefix):]
    return "other", None
