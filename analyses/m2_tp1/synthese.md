# TP M2-1 — Synthèse de l'équipe 05

1. Enregistrement et source : BIDMC enregistrement 05 (PhysioNet, téléchargement réussi — pas de repli synthétique), 60 001 échantillons à 125 Hz, 480 s ; FC de référence du moniteur 98,2 bpm en moyenne (96 à 101 bpm).
2. Erreur obtenue : MAE 1,84 bpm avec le filtre 0,5-5 Hz contre 0,88 bpm sans filtre — chiffre trompeur : hors des deux décrochages capteur (113-136 s et 145-162 s) le filtre fait mieux (0,74 contre 0,83 bpm), et la chaîne sans filtre ne « gagne » que parce qu'elle ne produit aucune valeur pendant ces décrochages (couverture 98,9 % contre 99,8 %).
3. Effet de l'artefact (gain 3, 200-240 s) : MAE 10,55 bpm pendant l'artefact contre 0,90 bpm sur les mêmes secondes sans artefact, pire écart 27 bpm ; MAE globale seulement 2,00 bpm car l'épisode ne pèse que 8 % du temps. Le filtre ne peut rien : les secousses sont à 1-3 Hz, soit 60-180 bpm, en plein dans la bande du pouls.
4. Effet de la règle qualité (SEUIL_CV = 0,15) : MAE des FC transmises 0,72 bpm (contre 2,00 bpm sans la règle), transmission 84,8 % du temps et 0 % pendant l'artefact — la totalité de la zone de mouvement est rejetée. Même sans artefact, 6,1 % des fenêtres sont rejetées : ce sont les décrochages du capteur, pas une irrégularité cardiaque (la FC ECG du moniteur reste à 98 bpm).
5. Réglage retenu : filtre Butterworth 0,5-5 Hz ordre 4 (couvre 30-300 bpm, coupe la dérive respiratoire et le bruit), FC_MAX 180 bpm avec PROEMINENCE 0,5 (766 battements détectés, contre 337 à FC_MAX 60 et 792 à FC_MAX 300 sans proéminence), SEUIL_CV 0,15 plutôt que 0,30 : à 0,30 on transmettrait 7,8 points de temps en plus mais avec une erreur doublée (1,46 bpm), car 80 % des fenêtres de mouvement passeraient le filtre qualité. Pour un dispositif de suivi, une valeur fausse coûte plus cher qu'une valeur absente.

Résultats : Équipe 05 | BIDMC enregistrement 05 | FC réf. 98 bpm | MAE 1.8 bpm | MAE artefact 10.5 bpm | MAE transmise 0.7 bpm (85 % transmis) | réglage 0.5-5.0 Hz ordre 4, FC_MAX 180, seuil CV 0.15

```
                    Configuration  MAE (bpm)  MAE pendant l'artefact (bpm)  FC transmise (% du temps)
                      Sans filtre        0.9                           NaN                       98.9
                Filtre 0.5-5.0 Hz        1.8                           0.9                       99.8
           Filtre + règle qualité        0.7                           0.9                       93.9
                Filtre + artefact        2.0                          10.5                       98.9
Filtre + artefact + règle qualité        0.7                           NaN                       84.8
```
