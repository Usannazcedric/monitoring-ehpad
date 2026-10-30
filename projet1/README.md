# Projet 1 — Dossier de cadrage (MBA 2)

Journée du 30 octobre 2026 — équipe 05 — cas A (chute) — produit *Veilleur*.
Dépôt du dossier complet avant 18:00.

| Fichier | Contenu |
| --- | --- |
| [`dossier_cadrage.md`](dossier_cadrage.md) | Le dossier rempli : page de garde, parties 1 à 4, bilan |
| [`P1_Dossier_de_cadrage_modele.pdf`](P1_Dossier_de_cadrage_modele.pdf) | Modèle vierge fourni par l'intervenant |
| [`figures/schema_bout_en_bout.png`](figures/schema_bout_en_bout.png) | Schéma de bout en bout, prototype et vrai produit (partie 3.1), source [`.svg`](figures/schema_bout_en_bout.svg) |
| [`calculateur_autonomie_eq05.xlsx`](calculateur_autonomie_eq05.xlsx) | Calculateur d'autonomie du module 2, onglet « Cas équipe » rempli (partie 4.3) |
| [`donnees/`](donnees/) | Vraies données phyphox (exercice 4.2) et leur protocole d'enregistrement |
| [`traitement/analyse_chutes.py`](traitement/analyse_chutes.py) | Applique les trois règles de chute aux vraies données ; écrit [`resultats/`](resultats/) |
| [`../firmware/p1_wokwi/`](../firmware/p1_wokwi/) | Projet Wokwi du Projet 1 : copie du module 1, plus les capteurs de port, de présence et de porte (partie 4.1) |

Lancer le traitement, depuis la racine du dépôt, une fois les CSV déposés :

```bash
python3 projet1/traitement/analyse_chutes.py
```
