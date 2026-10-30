# Projet 1 — Preuve de concept du cas A (chute) dans Wokwi

Copie du firmware du module 1 ([`../m1_wokwi/`](../m1_wokwi/)), complétée pour le
**Projet 1** (dossier de cadrage, exercice 4) : les capteurs du produit *Veilleur* et
les traitements des TP du module 2. Le module 1 reste intact et fonctionne toujours.

Dossier de cadrage : [`../../projet1/dossier_cadrage.md`](../../projet1/dossier_cadrage.md), partie 4.

---

## Ce qui change par rapport au module 1

| | Module 1 | Projet 1 |
| --- | --- | --- |
| Capteurs | MPU-6050, potentiomètre (FC), bouton SOS, buzzer | + **interrupteur « bracelet porté »**, **détecteur de présence (PIR)**, **interrupteur de porte** |
| Chute | Règle naïve : norme > 2,5 g | **Choc > 2 g, puis 3 s immobile, puis rotation > 50°** (TP M2-2, section « pour aller plus loin ») |
| FC | Une lecture envoyée toutes les 2 s | Moyenne de 10 lectures ; **non envoyée** si leur coefficient de variation dépasse 0,15 (TP M2-1) |
| Bracelet retiré | — | Plus aucune mesure envoyée ; alerte technique (niveau 2) au bout de 30 s |
| Chambre | — | `ambient/room/121` (présence) et `door/room/121` (porte), au format du simulateur Python |

Les topics, le format JSON et les seuils de FC restent ceux de Digi4 : le backend et le
tableau de bord n'ont pas une ligne à changer. Le pont Mosquitto rapatrie aussi les deux
nouveaux topics de chambre ([`../../mosquitto/config/mosquitto.conf`](../../mosquitto/config/mosquitto.conf)).

## Le montage

| Composant | Broche ESP32 | Ce qu'il remplace dans le vrai produit |
| --- | --- | --- |
| MPU-6050 `SDA` / `SCL` | 21 / 22 | L'accéléromètre du bracelet |
| Potentiomètre `SIG` | 34 (ADC1) | Le capteur de pouls PPG (FC), que Wokwi ne simule pas |
| Bouton rouge | 18 → GND | Le bouton d'appel du bracelet |
| Buzzer | 19 | L'alarme locale |
| Interrupteur de droite (`swWorn`) | 32 → GND | La détection de port (contact avec la peau) — **nouveau** |
| Interrupteur de gauche (`swDoor`) | 33 → GND | Le capteur d'ouverture de la porte de chambre — **nouveau** |
| PIR `OUT` | 27 | Le détecteur de présence de la chambre — **nouveau** |

Interrupteurs en pull-up interne : en position de départ, la broche est à la masse, donc
**bracelet porté** et **porte fermée**. Basculer l'interrupteur : bracelet retiré, porte ouverte.

## Lancer

Comme au module 1 : sur [wokwi.com](https://wokwi.com), *New Project* → **ESP32**, coller
[`diagram.json`](diagram.json) et [`sketch.ino`](sketch.ino), ajouter **PubSubClient**
par le *Library Manager*, puis ▶. En local, `./build.sh` puis *Wokwi: Start Simulator*
dans VS Code (voir le README du module 1).

Garder l'onglet Wokwi **visible** : masqué, le simulateur ralentit fortement, à quelques
pourcents du temps réel.

## Démo, geste par geste

| Geste | Moniteur série | Tableau de bord |
| --- | --- | --- |
| Rien | `PUB vitals … "hr_cv":0.02` toutes les 2 s | Fiche R021, chambre 121 |
| Tourner vite le potentiomètre | `[REJET FC] … CV = 0.2x > 0.15 : mesure instable, NON envoyee` | Rien de faux n'arrive |
| Potentiomètre > 140 bpm | `[ALERTE locale L4] hr critical` + buzzer | Urgence (FC) |
| MPU-6050 : `accelX` à 2 g (choc), puis `accelX` = 1, `accelZ` = 0, ne plus toucher | `[CHUTE ?] choc` puis `[ALERTE locale L4] fall detected (… rotation 90 deg)` + buzzer | Urgence : chute |
| MPU-6050 : choc, puis retour à `accelX` = 0, `accelZ` = 1 | `[CHUTE ECARTEE] … assis lourdement ? (regle naive du module 1 : AURAIT ALERTE)` | Rien |
| Basculer l'interrupteur de droite | `[PORT] bracelet RETIRE`, puis 30 s plus tard `[ALERTE publiee L2] bracelet non porte` | Attention : bracelet non porté |
| Basculer l'interrupteur de gauche / *Simulate motion* sur le PIR | `[CHAMBRE 121] porte OUVERTE` / `presence : mouvement` | Chambre 121 mise à jour |
| Bouton rouge | `[ALERTE publiee L5] … appel SOS` + buzzer | Danger vital |

Après un choc, il faut ne plus toucher au MPU-6050 pendant au moins 4 s : la règle attend
3 s d'immobilité, en ignorant la première seconde. Au-delà de 15 s sans immobilité, le choc
est écarté (« la personne s'est relevée »).

## Ce que la démo ne prouve pas

- Les valeurs du MPU-6050 sont réglées à la main : la démo prouve que la **chaîne** et la
  **logique** fonctionnent, pas que la règle détecte une vraie chute. Cette preuve-là
  vient des vraies données ([`../../projet1/donnees/`](../../projet1/donnees/)).
- Le potentiomètre n'a ni bruit de mouvement ni décrochage : la règle qualité est
  transposée du TP M2-1. Là-bas, elle portait sur les intervalles RR ; ici, sur 10 lectures
  de FC.
- Seuils de démo raccourcis : 30 s pour « bracelet non porté », 30 min dans le vrai produit.
- Données fictives, broker public, sans TLS : interdit dès qu'une donnée réelle existe.
