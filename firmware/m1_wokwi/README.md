# Module 1 — Du simulateur Python au firmware ESP32 (Wokwi)

TP Digi5 · équipe EHPAD · dépôt [`monitoring-ehpad`](../..)

Ce dossier remplace le **simulateur Python** du projet Digi4 par un **firmware ESP32**
qui publie sur MQTT exactement les mêmes topics et les mêmes clés JSON. Le backend et
le dashboard du projet n'ont pas une ligne à changer.

Le contrat complet (topics, formats, seuils, validation Pydantic) est dans
[`../../docs/contrat_mqtt.md`](../../docs/contrat_mqtt.md).

---

## Lien du projet Wokwi

**→ `COLLER ICI LE LIEN wokwi.com DU PROJET`**

(Dans Wokwi : *Save* puis *Share* → copier l'URL publique.)

---

## Fichiers

| Fichier | Rôle |
| --- | --- |
| [`diagram.json`](diagram.json) | Le montage : ESP32 + MPU-6050 + bouton SOS + buzzer + potentiomètre |
| [`libraries.txt`](libraries.txt) | Une seule dépendance : `PubSubClient` |
| [`sketch.ino`](sketch.ino) | Le firmware |

---

## Le montage

| Composant | Broche ESP32 | Rôle |
| --- | --- | --- |
| MPU-6050 `SDA` / `SCL` | 21 / 22 | Accéléromètre I2C, adresse `0x68` |
| Bouton poussoir (rouge) | 18 → GND | Appel SOS, pull-up interne |
| Buzzer | 19 | Alarme locale, niveau ≥ 4 |
| Potentiomètre `SIG` | 34 | Tient lieu de capteur de fréquence cardiaque |

Le potentiomètre est branché sur **GPIO 34 (ADC1)** : l'ADC2 de l'ESP32 est inutilisable
dès que le Wi-Fi est actif. Le MPU-6050 et le potentiomètre sont alimentés en **3V3**,
jamais en 5 V.

---

## Lancer le projet dans Wokwi

1. [wokwi.com](https://wokwi.com) → *New Project* → **ESP32**.
2. Onglet `diagram.json` : remplacer tout le contenu par celui de [`diagram.json`](diagram.json).
3. Onglet `libraries.txt` (le créer s'il n'existe pas) : coller [`libraries.txt`](libraries.txt).
4. Onglet `sketch.ino` : coller [`sketch.ino`](sketch.ino).
5. ▶ *Start the simulation*. Le moniteur série (115200 bauds) affiche les topics, puis
   `Wi-Fi OK`, `MQTT OK`, et une ligne `PUB vitals` toutes les 2 secondes.

Au besoin, changer `TEAM_ID` en haut de `sketch.ino` : c'est la **seule** valeur à adapter.

---

## Ce que le firmware publie

Préfixe : `digi5/<TEAM_ID>/ehpad` — `broker.hivemq.com` est un broker public partagé par
toute la promo, un topic `ehpad/...` nu entrerait en collision avec celui d'une autre équipe.

| Topic | Fréquence | Contenu |
| --- | --- | --- |
| `…/vitals/resident/R001` | 0,5 Hz | `hr` lue sur le potentiomètre |
| `…/motion/resident/R001` | 0,5 Hz | `ax`, `ay`, `az` (en m/s²), `activity` |
| `…/alerts/new` | sur événement | Alerte au format `Alert` du backend, niveau 1 à 5 |
| `…/device/esp32-01/status` | connexion / perte | `online` (retenu) / `offline` (Last Will) |

Exemple de message `vitals` :

```json
{
  "timestamp": "2026-10-02T14:21:07.413Z",
  "resident_id": "R001",
  "values": { "hr": 78 },
  "vitals": { "hr": 78 },
  "scenario": "normal",
  "seq": 42,
  "source": "esp32",
  "device_id": "esp32-01",
  "measured": ["hr"]
}
```

`values` ne porte **que ce que la carte mesure réellement**. SpO2, tension et température
sont absentes, pas inventées ; `measured` les liste explicitement pour qu'une valeur
manquante ne se lise pas comme une valeur normale. La contrepartie à prévoir côté backend
est écrite dans le contrat MQTT (§4).

### Seuils d'alerte

Repris à l'identique de `backend/app/alerts/rules.py`, pour que l'alerte du device et
celle du backend ne puissent pas se contredire :

| Déclencheur | Niveau | `reason` |
| --- | --- | --- |
| `hr < 40` ou `hr > 140` | 4 — URGENCE | `hr critical (<bpm>)` |
| `hr > 100` | 2 — ATTENTION | `hr elevated (<bpm>)` |
| `50 ≤ hr < 58` | 1 — INFORMATION | `rythme cardiaque légèrement bas (<bpm>)` |
| Norme d'accélération > 2,5 g | 4 — URGENCE | `fall detected` |
| Bouton SOS | 5 — DANGER VITAL | `appel SOS du resident` |

Une alerte n'est publiée que lorsque le **niveau change** : republier la même alerte
toutes les 2 secondes rendrait le journal du dashboard illisible. Le buzzer sonne 3 s
dès le niveau 4.

Les niveaux 5 et 3 du backend exigent la SpO2 (`spo2 < 85`, `spo2 < 93`), que cette carte
ne mesure pas : ils restent inatteignables depuis le device, hors bouton SOS.

---

## Captures

| Capture | Fichier |
| --- | --- |
| Montage Wokwi en cours de simulation | `docs/wokwi-simulation.png` |
| Moniteur série (publications MQTT) | `docs/serial-monitor.png` |
| Dashboard recevant la donnée | `docs/dashboard.png` |

---

## Hygiène

- Données **fictives**, usage pédagogique. `broker.hivemq.com` est public : n'y publier
  aucune donnée réelle, et aucune finalité diagnostique.
- Aucun mot de passe réel n'est présent dans ces fichiers. Le bloc TLS (`USE_TLS 1`)
  ne contient que des placeholders ; les identifiants HiveMQ Cloud ne doivent jamais
  être commités.
- `RESIDENT_ID` doit respecter `^R\d{3}$` : le backend rejette tout autre format
  (`backend/app/models.py`).
