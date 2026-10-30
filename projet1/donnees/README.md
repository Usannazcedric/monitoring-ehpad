# Vraies données du Projet 1 (exercice 4.2)

Enregistrements de l'accéléromètre d'un téléphone, faits par l'équipe avec **phyphox**.
Ils servent à prouver que la détection de chute marche sur un vrai signal, avec son bruit,
et pas seulement sur les valeurs réglées à la main dans Wokwi.

**Jamais de chute humaine.** La seule chute enregistrée est celle du téléphone sur un coussin.
Les personnes sont pseudonymisées (`s01`, `s02`…) : aucun nom, ni ici ni dans les fichiers.

## Protocole (cas A, chute)

Application phyphox, expérience **« Accélération avec g »** (pas « sans g »). Export :
**CSV, séparateur virgule, point décimal**. Le `.zip` exporté peut être déposé tel quel,
mais renommé selon la convention.

| Fichier | Ce qu'on fait | Durée |
| --- | --- | --- |
| `20261030_eq05_s01_chute-objet_main_r01.csv` | Téléphone tenu **vertical**, comme un bracelet sur un bras le long du corps, puis lâché d'environ 50 cm à 1 m sur un coussin. Le laisser **immobile 5 s**, le ramasser, attendre au moins **15 s** avant le lâcher suivant. **10 lâchers** dans le même fichier. | ≈ 3 min |
| `20261030_eq05_s01_marche_hanche_r01.csv` | Marche, téléphone dans la poche. Compter les pas à voix haute. | 2 à 3 min |
| `20261030_eq05_s01_assis-debout_hanche_r01.csv` | 5 fois s'asseoir puis se lever, dont **2 fois en s'asseyant lourdement** : c'est le piège à fausse alerte. | ≈ 2 min |
| `20261030_eq05_s01_allonger_hanche_r01.csv` | 3 fois s'allonger sur un lit ou un canapé, puis se relever. | ≈ 2 min |
| `20261030_eq05_s01_assis_hanche_r01.csv` | Assis, immobile. | 1 min |
| `20261030_eq05_s01_debout_hanche_r01.csv` | Debout, immobile. | 1 min |

Pourquoi tenir le téléphone vertical : la règle du Projet 1 attend une **rotation de plus de
50°** entre avant et après le choc (debout puis allongé au sol). Lâché à plat, le téléphone
retombe à plat et la règle écarte l'événement. C'est voulu : un choc sans changement de
position, c'est plutôt quelqu'un qui s'assoit lourdement.

Pourquoi 15 s entre deux lâchers : la règle naïve n'émet qu'une alerte toutes les 10 s.
Des lâchers trop rapprochés seraient comptés comme des chutes ratées.

Pour le **13 novembre**, la démo idéale demande une série plus longue : 10 lâchers, puis
**1 h de vie courante** (marche, assis, allongé), pour compter les fausses alertes par heure.

## `labels.csv`

À compléter à la main, une ligne par fichier qui a besoin d'une vérité :

```csv
fichier,nb_chutes,nb_pas,commentaire
20261030_eq05_s01_chute-objet_main_r01.csv,10,,10 lâchers sur coussin
20261030_eq05_s01_marche_hanche_r01.csv,0,212,pas comptés à voix haute
```

Sans ce fichier, un enregistrement `chute-objet` compte pour une seule chute.

## Traitement

```bash
python3 projet1/traitement/analyse_chutes.py
```

Le script applique les trois règles (naïve du module 1, trois temps du TP M2-2, règle
embarquée du Projet 1) et écrit dans [`../resultats/`](../resultats/) : `detections.csv`,
`resume.md` (précision, rappel, fausses alertes par heure) et deux figures.
On ne modifie jamais les fichiers bruts déposés ici.
