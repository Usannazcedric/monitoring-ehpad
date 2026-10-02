# Contrat MQTT — Digi4 (simulateur Python) → Digi5 (firmware ESP32)

Relevé dans le code, pas dans la documentation : chaque ligne ci-dessous a été vérifiée
dans le fichier cité. Ce contrat est ce qui garantit que le firmware du 30 octobre et le
dashboard restent compatibles.

Projet analysé : [`Usannazcedric/projet-2-iot-sante`](https://github.com/Usannazcedric/projet-2-iot-sante) (avril 2026).

## 1. Le tableau demandé

| Élément | Valeur dans le projet Digi4 | Valeur retenue pour Digi5 |
| --- | --- | --- |
| Préfixe / racine des topics | `ehpad` | `digi5/<equipe>/ehpad` |
| Topic des constantes | `ehpad/vitals/resident/{resident_id}` | `digi5/<equipe>/ehpad/vitals/resident/{resident_id}` |
| Topic du mouvement | `ehpad/motion/resident/{resident_id}` | `digi5/<equipe>/ehpad/motion/resident/{resident_id}` |
| Topic des alertes | `ehpad/alerts/new` et `ehpad/alerts/update/{alert_id}` | `digi5/<equipe>/ehpad/alerts/new` |
| Topic d'état du device | **absent** | `digi5/<equipe>/ehpad/device/{device_id}/status` |
| Clé de la FC | `values.hr`, entier, bpm | identique |
| Clé de l'horodatage | `timestamp`, ISO 8601 UTC, millisecondes, suffixe `Z` | identique, à la seconde près |
| Niveaux d'alerte | entiers **1 à 5** (`AlertLevel`) | identiques |
| Broker, port, TLS | Mosquitto local, `1883`, sans TLS, `allow_anonymous true` | `broker.hivemq.com:1883`, sans TLS |

**Option retenue : A — le firmware parle « Digi4 ».** Les clés JSON et la hiérarchie des
topics sont celles du simulateur Python ; le dashboard n'a pas à être modifié. Seul un
préfixe `digi5/<equipe>/` est ajouté devant, parce que `broker.hivemq.com` est un broker
public partagé par toute la promo et par Internet : sans préfixe d'équipe, nos topics
`ehpad/...` entreraient en collision avec ceux des autres groupes.

## 2. Topics complets du projet Digi4

Relevés dans `simulator/app/main.py`, `backend/app/ingest/topics.py`,
`backend/app/ingest/handlers.py`, `backend/app/alerts/publisher.py`, `backend/app/ml/risk.py`.

| Topic | Producteur | Fréquence |
| --- | --- | --- |
| `ehpad/vitals/resident/{id}` | simulateur | 1 Hz |
| `ehpad/motion/resident/{id}` | simulateur | 5 Hz |
| `ehpad/ambient/room/{room}` | simulateur | 0,2 Hz |
| `ehpad/door/room/{room}` | simulateur | 0,2 Hz |
| `ehpad/state/resident/{id}` | backend (état fusionné) | à chaque message reçu |
| `ehpad/state/room/{room}` | backend | à chaque message reçu |
| `ehpad/risk/resident/{id}` | backend (score ML) | toutes les 30 s |
| `ehpad/alerts/new` | backend | à la création |
| `ehpad/alerts/update/{alert_id}` | backend | à chaque changement |

Le backend souscrit à `ehpad/vitals/resident/+`, `ehpad/motion/resident/+`,
`ehpad/ambient/room/+`, `ehpad/door/room/+`. Le `ws-gateway` souscrit à `ehpad/alerts/#`,
`ehpad/state/#`, `ehpad/risk/#`, retire le préfixe `ehpad/` et diffuse au navigateur sous
la forme `{ "topic": "...", "data": {...} }`.

## 3. Formats JSON

### `vitals` — `simulator/app/resident.py:tick()`

```json
{
  "timestamp": "2026-10-02T13:31:04.000Z",
  "resident_id": "R001",
  "values": { "hr": 72, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8 },
  "vitals": { "hr": 72, "spo2": 97, "sys": 130, "dia": 80, "temp": 36.8 },
  "scenario": "normal",
  "seq": 41
}
```

`values` et `vitals` portent le même contenu : `values` est ce que valide le backend,
`vitals` est un doublon historique conservé pour le dashboard.

### `motion` — `simulator/app/sensors/motion.py`

```json
{
  "timestamp": "2026-10-02T13:31:04.000Z",
  "resident_id": "R001",
  "values": { "ax": 0.021, "ay": -0.004, "az": 9.812, "activity": "sitting" },
  "scenario": "normal",
  "seq": 207
}
```

**Unité : le mètre par seconde carrée, pas le g.** Au repos, `az ≈ 9.81`. Le firmware doit
donc convertir les g du MPU-6050 (`× 9,80665`) avant de publier.

### `alerts/new` — `backend/app/models.py:Alert`

```json
{
  "id": "0f3c…", "resident_id": "R001", "level": 4,
  "reason": "hr critical (152)", "status": "active",
  "created_at": "…Z", "updated_at": "…Z", "last_seen": "…Z",
  "acknowledged_by": null
}
```

## 4. Contraintes de validation à respecter absolument

Le backend valide avec Pydantic (`backend/app/models.py`). Un message non conforme est
rejeté silencieusement.

| Contrainte | Conséquence pour le firmware |
| --- | --- |
| `resident_id` doit matcher `^R\d{3}$` | `R001`, pas `P001` ni `patient-1` |
| `VitalsValues` exige **hr, spo2, sys, dia, temp** — tous obligatoires | voir ci-dessous |
| `MotionValues` exige **ax, ay, az, activity** | le MPU-6050 les fournit tous |
| `seq` est un entier obligatoire | compteur incrémental dans le firmware |

### Le problème des champs non mesurés

L'ESP32 du TP ne mesure **que** la fréquence cardiaque (potentiomètre, en attendant le
MAX30102 du 30 octobre) et l'accélération. Il ne mesure ni SpO₂, ni pression, ni
température. L'énoncé est explicite : **ne pas inventer ces valeurs**.

Or `VitalsValues` les déclare obligatoires. Les deux exigences sont incompatibles en
l'état. Décision retenue : **le firmware ne publie que ce qu'il mesure**, et c'est le
backend qui devient tolérant. Le changement à faire côté backend, une ligne par champ :

```python
class VitalsValues(BaseModel):
    hr: int
    spo2: int | None = None      # non mesuré par l'ESP32 du module 1
    sys: int | None = None
    dia: int | None = None
    temp: float | None = None
```

Les règles d'alerte (`backend/app/alerts/rules.py`) testent déjà `is not None` avant
chaque comparaison : elles fonctionnent sans modification avec des champs absents.
Ce changement n'est **pas** appliqué dans ce dépôt — il relève de l'étape 5 (affichage
dans le dashboard), reportée.

En attendant, le firmware publie un champ `measured` qui liste explicitement ce qui est
réellement mesuré, pour qu'aucun consommateur ne confonde « absent » et « normal ».

## 5. Seuils d'alerte — `backend/app/alerts/rules.py`

Le firmware reproduit un premier niveau d'alerte **sur le device**, avec les seuils exacts
du backend, pour que les deux ne se contredisent pas.

| Niveau | Nom | Déclencheur sur la FC seule |
| --- | --- | --- |
| 5 | `DANGER_VITAL` | exige FC **et** SpO₂ → hors de portée de l'ESP32 |
| 4 | `URGENCE` | `hr < 40` ou `hr > 140`, ou `activity == "fall"` |
| 3 | `ALERTE` | SpO₂ ou score ML → hors de portée |
| 2 | `ATTENTION` | `hr > 100` |
| 1 | `INFORMATION` | `50 <= hr < 58` |

### Incohérence relevée dans le projet Digi4

Le libellé d'activité d'une chute ne concorde pas d'un bout à l'autre de la chaîne :

| Fichier | Valeur |
| --- | --- |
| `simulator/app/sensors/motion.py:36` | `activity="falling"` |
| `backend/app/alerts/rules.py:31` | teste `activity == "fall"` |
| `frontend/src/components/ResidentCard.tsx:28` | teste `activity === "fall_detected"` |

Les trois diffèrent : **une chute du simulateur ne déclenche jamais la règle L4**, et le
dashboard n'affiche jamais l'état de chute. Le test `backend/tests/test_rules.py:45` passe
parce qu'il écrit `"fall"` en dur — il valide la règle, pas la chaîne.

Le firmware publie `"fall"`, qui est la valeur attendue par la règle vivante. La correction
du simulateur et du frontend reste à faire côté Digi4.

## 6. Ce qui reste à faire (étapes 3, 4 et 5 du TP, reportées)

- [ ] Vérifier le flux dans MQTT Explorer sur `digi5/<equipe>/ehpad/#` (étape 3)
- [ ] Tester potentiomètre, MPU-6050 et bouton SOS un par un (étape 4)
- [ ] Brancher le dashboard sur `wss://broker.hivemq.com:8884/mqtt` (étape 5) — soit en
      pointant le `ws-gateway` sur HiveMQ au lieu du Mosquitto local, soit en connectant
      MQTT.js directement depuis le front
- [ ] Rendre `VitalsValues` tolérant aux champs non mesurés (section 4)
- [ ] Trancher le libellé de chute entre `falling`, `fall` et `fall_detected` (section 5)
