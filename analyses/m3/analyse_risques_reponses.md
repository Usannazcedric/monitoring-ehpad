# TP M3-2 — Analyse de risques du projet (ISO 14971 simplifiée) — équipe 05

Module 3 — vendredi 16 octobre 2026 — MBA Santé, IA & IoT — Epitech.
Cas A (chute), exercice d'entraînement, aucune donnée personnelle : on raisonne sur un résident type.
Livrable : [`analyse_risques_eq05.xlsx`](analyse_risques_eq05.xlsx) — 8 dangers, 4 techniques,
2 d'utilisation, 2 de cybersécurité, aucun risque « élevé » après mesures.

## Question 1 — Les 4 dominos de l'exemple

| Domino | Exemple « batterie vide » |
|---|---|
| Danger | Batterie vide : le capteur ne peut plus envoyer d'alerte |
| Séquence d'événements | Recharge oubliée → batterie vide → capteur éteint la nuit → la résidente se lève et chute |
| Situation dangereuse | La résidente est au sol, personne n'est prévenu |
| Dommage | Longue attente au sol : froid, déshydratation, escarres, hospitalisation |

« Batterie vide » n'est pas un dommage parce que **personne n'est blessé par une batterie vide**.
C'est un état du produit, le premier domino. Le dommage est l'atteinte à la santé de la
personne, tout au bout de la chaîne : l'attente au sol et ses conséquences. Coter la gravité sur
« batterie vide » conduirait à sous-estimer le risque ; on cote toujours sur le dommage.

## Question 2 — Les chaînes complètes

Les 8 chaînes sont dans le classeur, colonnes C à F. Résumé :

| N° | Type | Danger | Dommage |
|---|---|---|---|
| 1 | Technique | Batterie vide, plus d'alerte | Longue attente au sol |
| 2 | Technique | Chute lente non détectée | Attente prolongée au sol, hospitalisation |
| 3 | Technique | Fausse alerte répétée → perte de confiance | Chute réelle prise en charge trop tard |
| 4 | Utilisation | Capteur retiré après la toilette, non remis | Malaise ou chute non détecté |
| 5 | Utilisation | Bracelets échangés entre deux résidents | Alerte envoyée dans la mauvaise chambre |
| 6 | Cybersécurité | Données interceptées (MQTT en clair) | Atteinte à la vie privée, RGPD art. 9 |
| 7 | Cybersécurité | Broker saturé ou réseau coupé | Chute non signalée pendant la panne |
| 8 | Technique | IA trompée par un profil hors données d'entraînement | Chute ni anticipée ni détectée |

## Question 3 — Le risque le plus élevé

Deux lignes sont à **9 (Grave × Fréquente)**, le maximum de la matrice :

- **n° 1 — batterie vide** (exemple du classeur) ;
- **n° 4 — capteur mal porté ou retiré** : c'est le plus probable de tous, parce qu'il ne dépend
  d'aucune panne — il suffit d'une toilette et d'un bracelet posé sur la table de nuit.

**6 risques sur 8 sont « élevés » avant mesures** (lignes 1, 2, 3, 4, 7, 8), les 2 autres sont
« moyens » (4 : Modérée × Possible). Aucun n'est « faible » : c'est logique pour un système dont
la finalité est de détecter un événement vital — tout échec se paie en minutes au sol.

## Question 4 — Les 3 mesures du risque le plus élevé

Pour le **n° 4, capteur mal porté ou retiré** (3 × 3 = 9) :

1. **Conception** — détection de port (contact peau) et règle qualité du TP M2-1 : une mesure
   douteuse n'est **jamais** publiée comme valeur valide, elle est publiée « indisponible ».
2. **Protection** — bandeau « capteur non porté » sur la fiche du résident et alerte au poste de
   soins si l'état « indisponible » dure plus de 30 min.
3. **Information** — notice (« remettre le bracelet après la toilette »), pictogramme sur le socle
   de charge, point ajouté au protocole de soins.

Après mesures : 3 × 1 = 3, « moyen ».

**Pourquoi la notice vient en dernier** : elle ne change ni le produit ni l'environnement, elle
déplace la charge sur l'humain. Elle suppose que la personne l'a lue, comprise, retenue, et qu'elle
l'applique un soir de sous-effectif. Une mesure de conception protège même quand personne ne
pense au risque ; une notice ne protège que si tout le monde y pense. La norme impose donc
l'ordre : on change le produit, puis on ajoute un garde-fou, et seulement ensuite on écrit.

## Question 5 — Les risques encore « moyens » après mesures

Six lignes restent à **3 (Grave × Rare)** : n° 1, 2, 3, 4, 7 et 8. Toutes pour la même raison : la
**gravité ne se réduit pas**. Un résident qui reste des heures au sol fait une hospitalisation, que
la cause soit une batterie, un algorithme ou une panne réseau. Nos mesures n'agissent que sur la
probabilité, qui passe de « fréquente » ou « possible » à « rare ». La matrice le dit elle-même :
un dommage grave ne descend jamais sous « moyen ».

Justification de les accepter, ligne par ligne en colonne R, et globalement :

- La référence n'est pas le risque zéro, c'est **la situation sans le système** : aujourd'hui une
  chute de nuit est découverte à la ronde suivante, soit jusqu'à deux heures au sol. Avec le
  système, le cas nominal est une alerte en moins d'une minute.
- Chaque mode de défaillance résiduel est rendu **visible** (batterie faible, capteur non porté,
  système dégradé) : le système ne tombe jamais en panne silencieusement, et le personnel sait
  quand repasser en rondes renforcées.
- Les deux lignes qui tombent à « faible » (n° 5 et 6) sont acceptées telles quelles et notées.

Le bénéfice clinique l'emporte donc, à une condition écrite dans les notices : **le système
complète les rondes, il ne les remplace pas**.

## Question 6 — Les règles du module 2 qui sont des mesures de maîtrise

Ce qu'on avait pris pour des choix techniques sont en fait des mesures ISO 14971 :

| Règle du module 2 | Type de mesure | Risque maîtrisé |
|---|---|---|
| « Mesure indisponible » : jamais une fausse valeur (TP M2-1) | Conception | n° 4, n° 7 — une valeur inventée est pire que pas de valeur |
| Règle de qualité du signal PPG (TP M2-1) | Conception | n° 4 — un signal inexploitable ne produit pas de FC fantaisiste |
| Règle de chute à trois temps : chute libre → impact → immobilité (TP M2-2) | Conception | n° 2 et n° 3 — précision 0,75 → 1,00 contre le seuil naïf « > 2,5 g » |
| Autonomie de batterie dimensionnée (TP M2-4) | Conception | n° 1 — la recharge oubliée ne suffit plus à éteindre le capteur |
| MQTT chiffré TLS port 8883, un certificat par objet, comptes séparés | Conception | n° 6 — interception des données de santé |
| Bluetooth appairé et chiffré (TP M2-3) | Conception | n° 6 — écoute des trames Heart Rate en clair |
| Alertes graduées à 5 niveaux avec escalade | Protection | n° 3 — l'alerte non prise remonte d'elle-même |
| Signe de vie périodique et horodatage des mesures | Protection | n° 1, n° 7 — l'objet qui se tait est détecté |

Autrement dit, l'analyse de risques ne s'ajoute pas au projet : elle **relit** le projet. La plupart
de nos mesures existaient déjà, mais sans être rattachées au dommage qu'elles évitent — c'est
précisément ce que le dossier de marquage CE demande de prouver.

## Pour aller plus loin

**Matériovigilance (Omnipod, rappel ANSM du 3 juin 2026).** La chaîne s'écrit de la même façon,
après la vente : danger = canule qui peut se déchirer ; séquence = déchirure → moins d'insuline
délivrée que la dose programmée → le patient ne le voit pas ; situation dangereuse = patient
diabétique sous-dosé sans le savoir ; dommage = hyperglycémie, acidocétose. L'analyse de risques
ne s'arrête pas à la mise sur le marché : les incidents remontés rouvrent le dossier.

**Une mesure qui crée un risque.** Notre mesure du n° 3 (durcir les critères pour supprimer les
fausses alertes) augmente directement le n° 2 (chute lente non détectée) : moins de bruit, mais
plus de silence. C'est l'arbitrage précision / rappel du TP M2-2, devenu ici un arbitrage de
sécurité. Même chose pour la mesure du n° 7 : la file locale qui rejoue les messages après une
coupure peut livrer au poste de soins une alerte vieille de dix minutes — d'où l'horodatage
obligatoire sur chaque message, pour qu'une alerte en retard soit lisible comme telle.
