# Projet 1 — Dossier de cadrage (MBA 2)

Journées du 30 octobre et du 13 novembre 2026 — équipe 05 — cas A (chute) — produit *Veilleur*.
Version 1 du dossier déposée le 13 novembre : parties 1 à 6 et priorités pour le 27 novembre.

| Fichier | Contenu |
| --- | --- |
| [`dossier_cadrage.md`](dossier_cadrage.md) | Le dossier : page de garde, parties 1 à 6 (risques et AIPD), bilan et priorités pour le 27/11 |
| [`P1_Dossier_de_cadrage_modele.pdf`](P1_Dossier_de_cadrage_modele.pdf) | Modèle vierge fourni par l'intervenant |
| [`figures/schema_bout_en_bout.png`](figures/schema_bout_en_bout.png) | Schéma de bout en bout, prototype et vrai produit (partie 3.1), source [`.svg`](figures/schema_bout_en_bout.svg) |
| [`calculateur_autonomie_eq05.xlsx`](calculateur_autonomie_eq05.xlsx) | Calculateur d'autonomie du module 2, onglet « Cas équipe » rempli (partie 4.3) |
| [`donnees/`](donnees/) | Vraies données phyphox (exercice 4.2) et leur protocole d'enregistrement |
| [`traitement/analyse_chutes.py`](traitement/analyse_chutes.py) | Applique les trois règles de chute aux vraies données ; écrit [`resultats/`](resultats/) |
| [`traitement/analyse_sisfall.py`](traitement/analyse_sisfall.py) | Les mêmes règles sur le jeu public SisFall (4 505 essais) ; résultats dans [`resultats/sisfall/`](resultats/sisfall/) (partie 4.2) |
| [`../firmware/p1_wokwi/`](../firmware/p1_wokwi/) | Projet Wokwi du Projet 1 : copie du module 1, plus les capteurs de port, de présence et de porte, et le bouton « Annuler » (partie 4.1) |

Lancer les traitements, depuis la racine du dépôt :

```bash
python3 projet1/traitement/analyse_chutes.py
```

```bash
python3 projet1/traitement/analyse_sisfall.py --pkl /chemin/vers/SisFall.pkl
```

Le premier lit les CSV phyphox de `donnees/`. Le second lit le fichier `SisFall.pkl` (non versionné : 250 Mo, propriété de ses auteurs), dont la provenance est donnée en 4.2.
