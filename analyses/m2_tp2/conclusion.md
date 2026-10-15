# TP M2-2 — Conclusion de l'équipe 05

1. Pas : avec un passe-bande 0,5-3 Hz et un seuil de 0,10 g, le compte est exact sur les 2 marches (50/50 et 48/48 pas, cadence 104-109 pas/min) ; un seuil de 0,3 g en fait rater 2 sur 3 (14 et 17 pas), et 16 faux pas apparaissent hors marche (assis-debout, s'allonger, chutes) : il faudrait ne compter que des séries de pas réguliers.
2. Chute : la règle naïve (> 2,5 g) attrape les 3 chutes de téléphone mais sonne aussi pour un « s'asseoir lourdement » (précision 0,75, rappel 1,00) ; la règle à trois temps (chute libre < 0,4 g, choc > 2 g, immobilité) n'a aucune fausse alerte (précision 1,00, rappel 1,00), mais le réglage tolérant fait retomber la précision à 0,75.
3. Limite : résultats obtenus sur le jeu de secours SYNTHÉTIQUE (aucun fichier phyphox de l'équipe dans le repo), sur 11 fichiers et 3 chutes d'objet ; une personne âgée ne tombe pas comme un téléphone (pas de chute libre, choc amorti), la règle à trois temps rate le profil schématique : il faudra des données de chutes humaines et un modèle appris (module 4).

## Paramètres retenus

- Source des données : jeu de secours SYNTHÉTIQUE (aucun fichier bien nommé trouvé)
- Pas : passe-bande Butterworth ordre 2 0.5-3.0 Hz (filtfilt), find_peaks hauteur 0.1 g, distance 0.3 s
- Règle naïve : ‖a‖ > 2.5 g, 1 alerte / 10 s
- Règle à trois temps : chute libre < 0.4 g pendant ≥ 0.08 s, impact > 2.0 g dans les 1.0 s, écart-type < 0.05 g de 1.0 à 4.0 s après le choc

## Scores

```
                        VP   FN   FP   VN  precision  rappel
Règle naïve (> 2,5 g)  3.0  0.0  1.0  7.0       0.75     1.0
Règle à trois temps    3.0  0.0  0.0  8.0       1.00     1.0
```
