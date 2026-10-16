# TP M3-1 — Bien-être ou dispositif médical ? — équipe 05

Module 3 — vendredi 16 octobre 2026 — MBA Santé, IA & IoT — Epitech.
Exercice d'entraînement : les classes indiquées sont des classes **probables**, à confirmer
sur la notice et le certificat du fabricant. Livrable principal :
[`grille_classification_eq05.xlsx`](grille_classification_eq05.xlsx) (9 lignes remplies, colonne K à « OK »).

## Question 1 — Étape 1, les deux phrases

La **phrase B** (« Détecte les troubles du rythme cardiaque ») fait du bracelet un dispositif
médical. Le mot qui décide : **« détecte »** appliqué à un **trouble** (une maladie) — c'est une
finalité de diagnostic. La phrase A (« Suivez votre forme et votre sommeil ») reste du bien-être.
Le capteur de pouls est le même dans les deux cas : c'est l'étiquette qui change, pas
l'électronique.

## Question 2 — Produits 1 à 4

Voir les lignes 1 à 4 de la grille pour (a), (b), (c) et (d). En résumé :

| N° | Produit | (a) | (c) classe / règle | (d) ON |
|---|---|---|---|---|
| 1 | App ECG de montre connectée | Dispositif médical | IIa — règle 11 | Oui |
| 2 | Tensiomètre connecté | Dispositif médical | IIa — règle 10 | Oui |
| 3 | App de méditation | Bien-être | — | Non |
| 4 | Balance « multifonction » | À discuter | IIa — règle 10 (fonction ECG) | Oui |

**Pourquoi la montre n'est-elle pas entièrement un dispositif médical ?** Parce que le fabricant
ne revendique une finalité médicale que pour **une fonction** : l'app ECG (et la notification de
rythme irrégulier). Le reste — pas, sommeil, calories, notifications — est du bien-être. Le
marquage CE médical porte donc sur cette fonction logicielle, pas sur la montre entière : c'est la
finalité revendiquée, fonction par fonction, qui fixe le périmètre du dispositif.

## Question 3 — Produits 5 à 8

Voir les lignes 5 à 8 de la grille. En résumé :

| N° | Produit | (a) | (c) classe / règle | (d) ON |
|---|---|---|---|---|
| 5 | Pompe à insuline patch | Dispositif médical | IIb — règle 12 | Oui |
| 6 | Logiciel de télésurveillance cardiaque | Dispositif médical | IIa — règle 11 | Oui |
| 7 | Détecteur de chute / téléassistance | À discuter | — (IIa, règle 11, si finalité médicale) | Non en l'état |
| 8 | Pilulier connecté | À discuter | — (I à IIa, règle 11, si finalité médicale) | Non en l'état |

## Question 4 — Les deux phrases pour les cas limites

**Produit 7 — détecteur de chute**
- Reste en bien-être : « Sécurité et tranquillité à domicile : un bouton pour appeler de l'aide, 24 h/24. »
- Bascule en dispositif médical : « Détecte automatiquement les chutes et les malaises et alerte les secours. »

**Produit 8 — pilulier connecté**
- Reste en bien-être : « Pilulier connecté qui rappelle l'heure de la prise et range les médicaments de la semaine. »
- Bascule en dispositif médical : « Sécurise l'observance du traitement et alerte l'aidant en cas d'oubli de prise. »

Dans les deux cas, le matériel est identique. Ce qui change, c'est la promesse : *aider à
s'organiser* (hors MDR) contre *détecter ou corriger un événement de santé* (MDR).

## Question 5 — Notre projet (ligne 9)

**Cas A (chute) — Projet 2 : détection et prédiction de malaise et de chute en EHPAD**,
20+ résidents équipés de capteurs, scoring IA, alertes graduées à 5 niveaux, tableau de bord
soignants.

- **(a)** **Dispositif médical.** La finalité revendiquée est explicitement médicale : surveiller
  des constantes vitales, détecter un malaise ou une chute, prédire un risque et alerter le
  personnel soignant. Aucune lecture « bien-être » ne tient pour cette phrase.
- **(c)** Logiciel → **règle 11**. Il surveille des **paramètres vitaux** (fréquence cardiaque, SpO2,
  mouvement) dans une situation où un retard d'alerte peut être fatal : **classe IIb**. Si le
  périmètre était réduit à une surveillance de confort sans urgence vitale revendiquée, la
  classe retomberait à IIa — mais le cahier des charges parle de détection de malaise, donc IIb.
Le cours (séquence 2, dernière diapositive) présente trois lectures possibles de la même
promesse : « alerte les soignants quand un résident tombe » peut se lire comme de la sécurité
de la personne ; « prévient les complications d'une chute » et « prédit le risque de chute »
sont plutôt médicales (prévention, prédiction). Notre cahier des charges revendique la
**prédiction** du risque de malaise : c'est la lecture médicale qui s'applique.

- **(d)** **Oui, organisme notifié obligatoire** (dès IIa ; GMED en France), avec tout ce qui
  l'accompagne : système de management de la qualité (ISO 13485), cycle de vie logiciel
  (IEC 62304), gestion des risques (ISO 14971), évaluation clinique et surveillance après
  mise sur le marché.

Conséquence pour la suite du projet : la version actuelle est un **prototype pédagogique**, pas un
produit marquable CE. Pour l'approcher, il faudrait figer la finalité revendiquée, tracer les
exigences, documenter les risques (faux négatif sur une chute, fausse alerte) et prévoir la
validation clinique.
