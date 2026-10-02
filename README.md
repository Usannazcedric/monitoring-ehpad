# Projet 2 — Monitoring EHPAD (IoT / IA)

Plateforme de surveillance temps réel de 20 résidents en EHPAD. Capteurs simulés (constantes vitales, mouvement, ambiance), ingestion MQTT, scoring ML hybride (anomaly + tendance), moteur d'alertes 5 niveaux avec auto-escalade, détection de fugue, résumé quotidien généré par LLM local, et tableau de bord React temps réel.

L'ensemble s'exécute via un seul `docker compose up -d --build`.

---

## Où en est le projet

Ce dépôt **continue** le projet de l'an dernier (Digi4), archivé tel quel sur
[`Usannazcedric/projet-2-iot-sante`](https://github.com/Usannazcedric/projet-2-iot-sante).

| Livrable | Où |
| --- | --- |
| Architecture et écarts avec un produit fini (16 écarts cotés) | [`docs/etat-des-lieux.pdf`](docs/etat-des-lieux.pdf) · [version web](docs/etat-des-lieux.html) |
| Contrat MQTT — correspondance Digi4 → Digi5 | [`docs/contrat_mqtt.md`](docs/contrat_mqtt.md) |
| Module 1 — firmware ESP32 qui remplace le simulateur Python | [`firmware/m1_wokwi/`](firmware/m1_wokwi/) |
| Simulation Wokwi de la carte | [wokwi.com/projects/476778339332099073](https://wokwi.com/projects/476778339332099073) |

Le firmware ESP32 publie sur les **mêmes topics et les mêmes formats JSON** que le
simulateur Python : le backend, le moteur d'alertes et le dashboard décrits ci-dessous
fonctionnent sans modification, qu'ils soient alimentés par le simulateur ou par la carte.

### Faire entrer la carte ESP32 dans le dashboard

La carte simulée dans Wokwi ne peut pas joindre le Mosquitto local : elle publie sur
`broker.hivemq.com`, et un **pont Mosquitto** rapatrie ses messages en leur rendant leur
topic Digi4. Rien d'autre à faire que démarrer la stack :

```bash
docker compose up -d --build
```

Puis lancer la simulation Wokwi (voir [`firmware/m1_wokwi/`](firmware/m1_wokwi/)). La carte
alimente le résident **R021, chambre 121**, hors de la plage du simulateur Python
(R001–R020), pour que les deux sources ne se contredisent jamais sur un même résident.

Ce qu'on voit alors sur http://localhost:3000 :

- la fiche **R021** suit le potentiomètre avec environ 2 s de décalage ;
- SpO₂, tension et température affichent `—` : la carte ne les mesure pas, et elles ne
  sont pas inventées ;
- au-delà de 100 bpm, le moteur d'alertes du backend lève une alerte **Attention**, puis
  **Urgence** au-delà de 140 ;
- l'appui sur le bouton SOS fait apparaître une alerte de niveau **5** et déclenche le
  buzzer de la carte.

Le pont est unidirectionnel : rien de ce qui circule en local ne part vers le broker
public. Détail dans [`docs/contrat_mqtt.md`](docs/contrat_mqtt.md) §6.

## Démarrage rapide

```bash
git clone https://github.com/Usannazcedric/monitoring-ehpad.git
cd monitoring-ehpad
docker compose up -d --build
```

Attendre que les services soient `healthy` (~30 s, plus le pull du modèle Ollama ~2 GB au premier démarrage). Puis ouvrir :

- **Dashboard** : http://localhost:3000
- API backend : http://localhost:8000/health
- API simulator : http://localhost:9100/health
- WebSocket gateway : http://localhost:8080/health
- Ollama (LLM local) : http://localhost:11434

Vérifier l'état :

```bash
docker compose ps
```

---

## Stack technique

| Couche | Technologie |
| --- | --- |
| Simulateur capteurs | Python 3.11, FastAPI, asyncio, NumPy |
| Ingestion temps réel | MQTT (Eclipse Mosquitto 2) |
| Backend API + moteur d'alertes | Python 3.11, FastAPI, Pydantic v2, asyncio |
| Cache d'état temps réel | Redis 7 |
| Historique time-series | InfluxDB 2.7 |
| Machine Learning | scikit-learn (IsolationForest), NumPy |
| Pont WebSocket | Node 20, `ws`, `mqtt` |
| Frontend | React 18, Vite, TypeScript, Tailwind, Zustand, Recharts |
| LLM local (résumés) | Ollama (llama3.2:3b par défaut) |
| Orchestration | Docker Compose |

---

## Fonctionnalités

### Cœur (sprints 1–7)
- **Simulateur** : 20 profils résidents, scénarios injectables (chute, cardiaque, errance, dégradation lente), publication MQTT à 1 Hz (vitals) / 5 Hz (motion) / 0,2 Hz (ambient).
- **Backend** : ingestion MQTT, cache Redis (TTL 60 s), historique Influx, API REST documentée.
- **Moteur d'alertes** : 5 niveaux (Information → Danger vital), règles seuils + score ML, auto-escalade L2→L3→L4→L5 si non-acquittée. Sticky : descend pas, monte seulement.
- **ML hybride** : un IsolationForest par résident (entraîné au boot sur 7 jours synthétiques) + pente HR/SpO2/temp sur 15 min → `risk = 0.6 × anomaly + 0.4 × trend`. Mis à jour toutes les 30 s.
- **WebSocket gateway** : pont MQTT ↔ WebSocket pour pousser alertes/états/risques au front sans CORS.
- **Frontend** : grille des 20 résidents (triée par niveau d'alerte), page détaillée avec graphiques temps réel, journal d'alertes, plan de l'EHPAD avec mouvements, gestion du personnel et planning.

### Bonus (livraison finale)
- **C1 — Détection de fugue** : alerte L4 URGENCE quand un résident sort de sa chambre dans des conditions à risque. Deux paths :
  1. Pathologie cognitive (Alzheimer / démence) + porte ouverte + activité `walking` (détection organique).
  2. Scénario `fugue` injecté manuellement + porte ouverte (déclenchement explicite, indépendant du profil).
- **C2 — Résumé LLM quotidien** : endpoint `GET /residents/{id}/summary` qui agrège constantes, activité et alertes des 24 dernières heures, et produit un rapport markdown structuré (Synthèse / Constantes / Activité / Alertes / Recommandations) via le LLM Ollama local. Repli automatique sur un template déterministe si Ollama indisponible.

---

## Comment tester

### Voir une chute (alerte L4)
```bash
curl -X POST http://localhost:9100/scenario/R007 \
  -H 'Content-Type: application/json' -d '{"name":"fall"}'
```
Toast en haut à droite + badge dans NavBar + entrée dans `/alerts`.

### Voir une dégradation lente (ML prédit avant les seuils)
```bash
curl -X POST http://localhost:9100/scenario/R007 \
  -H 'Content-Type: application/json' -d '{"name":"degradation"}'
```
Le score de risque monte, l'alerte arrive avant que les seuils HR/SpO2 ne soient franchis.

### Voir une fugue (bonus C1)
1. Ouvrir n'importe quel résident dans le dashboard.
2. Bas de page → carte « Simulation de scénarios » → cliquer **Sortie / Fugue**.
3. ~5 s plus tard : toast top-right « Urgence — fugue détectée ».

Ou en CLI :
```bash
curl -X POST http://localhost:9100/scenario/R002 \
  -H 'Content-Type: application/json' -d '{"name":"fugue"}'
```

### Générer un rapport quotidien (bonus C2)
1. Ouvrir un résident.
2. Carte « Rapport quotidien » → bouton **Générer**.
3. Premier appel ~2 min (cold-start LLM), suivants <30 s.

---

## Endpoints API principaux

### Backend (port 8000)
| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/health` | Statut des dépendances (Redis, Influx, MQTT) |
| GET | `/residents` | Snapshots des 20 résidents |
| GET | `/residents/{id}` | Détail d'un résident |
| GET | `/residents/{id}/history?metric=vitals&minutes=15` | Time-series Influx |
| GET | `/residents/{id}/activity-pattern?hours=24` | Répartition horaire des activités |
| GET | `/residents/{id}/summary?hours=24` | **Rapport LLM** (bonus C2) |
| GET | `/alerts` | Alertes actives |
| POST | `/alerts/{id}/ack` | Acquitter |
| POST | `/alerts/{id}/resolve` | Résoudre |
| GET | `/rooms` | États des chambres (PIR + porte) |
| GET | `/staff` | Personnel + assignation |

### Simulator (port 9100)
| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/health` | Statut |
| GET | `/residents` | Profils complets |
| POST | `/scenario/{id}` body `{"name":"fall\|cardiac\|wandering\|degradation\|fugue\|normal"}` | Injecter un scénario |

### WebSocket (port 8080)
- `ws://localhost:8080/ws` — broadcast d'enveloppes `{ topic, data }`.
- Topics : `state/resident/{id}`, `state/room/{id}`, `alerts/new`, `alerts/update/{id}`, `risk/resident/{id}`.

---

## Variables d'environnement

| Variable | Service | Défaut | Rôle |
| --- | --- | --- | --- |
| `DEMO_MODE` | backend, simulator | `true` | Compresse les délais d'escalade (10 min → 60 s) |
| `MQTT_HOST` | tous | `mosquitto` | Hôte MQTT |
| `REDIS_URL` | backend | `redis://redis:6379` | URL Redis |
| `INFLUX_URL` | backend | `http://influxdb:8086` | URL Influx |
| `INFLUX_TOKEN` | backend | `ehpad-token-dev` | Token Influx (dev only) |
| `MODELS_DIR` | backend | `/models` | Persistance des modèles ML |
| `OLLAMA_URL` | backend | `http://ollama:11434` | URL Ollama |
| `OLLAMA_MODEL` | backend, ollama-init | `llama3.2:3b` | Modèle LLM utilisé |
| `RESIDENT_COUNT` | simulator | `20` | Nombre de résidents |

---

## Structure du projet

```
.
├── backend/              # FastAPI + moteur d'alertes + ML + LLM
│   ├── app/
│   │   ├── alerts/       # rules.py, fugue.py, engine.py, escalation.py
│   │   ├── api/          # routes HTTP
│   │   ├── ingest/       # client MQTT + handlers
│   │   ├── ml/           # IsolationForest + trend + risk publisher
│   │   ├── storage/      # Redis + Influx
│   │   ├── profiles.py   # registre statique des résidents
│   │   └── summary.py    # générateur de rapport LLM (bonus C2)
│   └── tests/            # 60+ tests pytest
├── simulator/            # FastAPI + asyncio publisher MQTT
│   └── app/
│       ├── scenarios.py  # Normal, Fall, Cardiac, Wandering, Degradation, Fugue
│       └── sensors/      # vitals, motion, ambient
├── ws-gateway/           # Node bridge MQTT ↔ WebSocket
├── frontend/             # React + Vite + TS + Tailwind
│   └── src/
│       ├── pages/        # Grid, ResidentDetail, AlertLog, Movements, Staff
│       ├── components/   # NavBar, AlertToast, FloorPlan, …
│       ├── hooks/        # useBootstrap (REST + WS)
│       └── store/        # Zustand
├── mosquitto/            # config MQTT
├── firmware/
│   └── m1_wokwi/         # Module 1 Digi5 : firmware ESP32 (remplace le simulateur)
│       ├── diagram.json  # montage Wokwi : MPU-6050, bouton SOS, buzzer, potentiomètre
│       ├── libraries.txt
│       ├── sketch.ino
│       ├── wokwi.toml    # simulation locale via l'extension Wokwi for VS Code
│       └── build.sh      # compilation locale (arduino-cli), contourne la file Wokwi
├── docker-compose.yml
├── docs/
│   ├── architecture.md   # Documentation technique détaillée
│   ├── contrat_mqtt.md   # Topics, formats JSON, seuils (Digi4 → Digi5)
│   └── etat-des-lieux.pdf # Architecture + 16 écarts avec un produit fini
└── README.md
```

---

## Tests

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -q          # ~60 tests, < 5 s
```

---

## Documentation technique

Voir [`docs/architecture.md`](docs/architecture.md) pour :
- diagramme d'architecture détaillé
- flux de données (capteur → MQTT → backend → cache → frontend)
- schéma de stockage (Redis keys, Influx measurements)
- modèle ML (entrée, sortie, ré-entraînement)
- contrat des messages MQTT
- choix techniques et compromis

Et aussi :
- [`docs/contrat_mqtt.md`](docs/contrat_mqtt.md) — topics, formats JSON, contraintes de
  validation Pydantic et seuils d'alerte, tels qu'ils sont réellement implémentés
- [`docs/etat-des-lieux.pdf`](docs/etat-des-lieux.pdf) — architecture actuelle et les 16
  écarts avec un produit utilisable en établissement, cotés en criticité et en effort
- [`firmware/m1_wokwi/README.md`](firmware/m1_wokwi/README.md) — montage ESP32, seuils
  embarqués et mode opératoire Wokwi

---

## Auteurs

- Titouan Brunet
- Usannaz Cedric
- Fares Mansour

Projet réalisé dans le cadre du Projet 2 — IoT Santé.
