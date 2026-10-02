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
| `VitalsValues` exige **hr** ; spo2, sys, dia, temp sont optionnels | voir ci-dessous |
| `MotionValues` exige **ax, ay, az, activity** | le MPU-6050 les fournit tous |
| `seq` est un entier obligatoire | compteur incrémental dans le firmware |

### Le problème des champs non mesurés

L'ESP32 du TP ne mesure **que** la fréquence cardiaque (potentiomètre, en attendant le
MAX30102 du 30 octobre) et l'accélération. Il ne mesure ni SpO₂, ni pression, ni
température. L'énoncé est explicite : **ne pas inventer ces valeurs**.

`VitalsValues` les déclarait obligatoires. Les deux exigences étaient incompatibles.
Décision retenue : **le firmware ne publie que ce qu'il mesure**, et le backend est devenu
tolérant. Appliqué dans `backend/app/models.py` :

```python
class VitalsValues(BaseModel):
    hr: int
    spo2: int | None = None      # non mesuré par l'ESP32 du module 1
    sys: int | None = None
    dia: int | None = None
    temp: float | None = None
```

Trois conséquences, toutes vérifiées :

- `backend/app/alerts/rules.py` testait déjà `is not None` avant chaque comparaison :
  aucune modification, une constante absente est simplement sautée.
- `backend/app/storage/influx.py` écrivait `int(values["spo2"])` sans filet. Corrigé :
  seuls les champs présents deviennent des *fields*, et un point sans aucun field n'est
  pas écrit du tout. Un zéro à la place d'une mesure manquante serait indistinguable
  d'une vraie mesure et fausserait les historiques.
- `backend/app/ml/anomaly.py` ignorait déjà les échantillons incomplets
  (`_to_matrix` saute les lignes en `KeyError`/`TypeError`) : le score d'anomalie d'un
  résident dont on n'a que la FC vaut 0, et le risque ne repose plus que sur la tendance.

Le firmware publie en plus un champ `measured` qui liste explicitement ce qui est
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

### Incohérence relevée dans le projet Digi4, puis corrigée

Le libellé d'activité d'une chute ne concordait pas d'un bout à l'autre de la chaîne :

| Fichier | Valeur d'origine | Effet |
| --- | --- | --- |
| `simulator/app/sensors/motion.py` | `activity="falling"` | producteur |
| `backend/app/alerts/rules.py` | teste `activity == "fall"` | ne matchait jamais |
| `frontend/.../ResidentCard.tsx` | teste `activity === "fall_detected"` | ne matchait jamais |

Les trois diffèrent : **une chute du simulateur ne déclenchait jamais la règle L4**, et le
dashboard n'affichait jamais l'état de chute. Le test `backend/tests/test_rules.py` passait
parce qu'il écrit `"fall"` en dur — il valide la règle, pas la chaîne.

Arbitrage : `"fall"` gagne, parce que c'est la valeur que teste le moteur d'alertes, donc
celle dont dépend le comportement observable. Corrections appliquées :

- le simulateur émet `"fall"` (`sensors/motion.py`, `scenarios.py`, et son test) ;
- le firmware émet `"fall"` ;
- le frontend accepte les trois orthographes via `isFallActivity()` dans `lib/format.ts`,
  le temps que d'anciens points d'historique InfluxDB finissent d'expirer.

## 6. Comment la carte atteint le dashboard

La carte simulée dans Wokwi ne peut pas joindre le Mosquitto qui tourne en local. Elle
publie donc sur `broker.hivemq.com`, et **un pont Mosquitto** rapatrie ses messages en
leur rendant leur topic Digi4 (`mosquitto/config/mosquitto.conf`) :

```
topic vitals/resident/+ in 0 ehpad/ digi5/equipe-ehpad/ehpad/
topic motion/resident/+ in 0 ehpad/ digi5/equipe-ehpad/ehpad/
topic alerts/new        in 0 ehpad/ digi5/equipe-ehpad/ehpad/
```

```
ESP32 (Wokwi)                     broker.hivemq.com
  digi5/equipe-ehpad/ehpad/...  ────────┐
                                        │  pont Mosquitto, sens « in » uniquement
  ehpad/vitals/resident/R021  ◄─────────┘
        │
        └─► backend ─► Redis / Influx ─► alertes + ML ─► ws-gateway ─► dashboard
```

Pourquoi cette solution plutôt que celle de l'énoncé (brancher MQTT.js du front
directement sur HiveMQ en WebSocket) : ici **rien ne change dans le code**. Le backend, le
moteur d'alertes, l'escalade, le ML et le dashboard continuent de voir un producteur sur
`ehpad/...`, exactement comme le simulateur. La carte bénéficie donc de toute la chaîne,
pas seulement d'une courbe. C'est aussi ce que démontre l'architecture Digi4 : *le
simulateur se remplace par de vrais capteurs sans toucher au backend*.

Le pont est **unidirectionnel** (`in`) : aucun état de résident, aucune alerte, aucun score
de risque ne part vers le broker public.

### Résident R021

La carte alimente **R021**, hors de la plage du simulateur Python (R001 à R020). Les deux
sources ne peuvent donc pas se contredire sur un même résident, et le dashboard montre les
vingt résidents simulés **plus** celui qui porte le capteur réel. Son profil est déclaré
dans `backend/app/profiles.py`, chambre 121.

### Qui émet quelle alerte

Le backend reçoit les `vitals` et le `motion` de la carte et les évalue avec ses propres
règles. Republier depuis le device les alertes de FC et de chute les ferait donc apparaître
**deux fois** dans le dashboard. Répartition retenue :

| Événement | Évalué sur le device | Publié sur MQTT par le device | Alerte dashboard |
| --- | --- | --- | --- |
| FC hors seuils | oui (buzzer + série) | non | par le backend, depuis les vitals |
| Chute | oui (buzzer + série) | non | par le backend, depuis `activity == "fall"` |
| Bouton SOS | oui | **oui**, `alerts/new` niveau 5 | depuis le device |

Le SOS est le seul événement qu'aucune mesure ne trahit : il n'existe nulle part dans
`rules.py`, donc le device est le seul à pouvoir le signaler. L'évaluation embarquée reste
entière pour ce qu'elle sert vraiment : réagir sans réseau, immédiatement, avec le buzzer.

## 7. Ce qui reste à faire

- [ ] Vérifier le flux dans MQTT Explorer sur `digi5/<equipe>/ehpad/#` (étape 3 du TP)
- [ ] Tester potentiomètre, MPU-6050 et bouton SOS un par un (étape 4)
- [ ] Faire entrer le SOS dans `AlertStore` pour qu'il soit acquittable et historisé :
      aujourd'hui il traverse le ws-gateway et s'affiche, mais le backend ne le connaît pas
- [ ] Passer en TLS sur un cluster HiveMQ Cloud (`USE_TLS 1`, étape 10)
- [ ] Remplacer le potentiomètre par un MAX30102 le 30 octobre

### Anomalie préexistante, non corrigée

`backend/tests/test_escalation.py::test_demo_mode_compresses_delays` échoue : le test attend
`DEMO_DELAYS[2] == 60`, le code déclare `300.0` (`backend/app/alerts/escalation.py`). Sans
trace de l'intention d'origine, corriger au hasard changerait le rythme d'escalade en démo.
Signalé, laissé en l'état. Le reste de la suite passe : 58 tests backend, 6 simulateur.
