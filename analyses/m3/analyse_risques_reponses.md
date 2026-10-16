# TP M3-2 — Analyse de risques du projet (ISO 14971 simplifiée) — équipe 05

Module 3 — vendredi 16 octobre 2026 — MBA Santé, IA & IoT — Epitech.
Cas A (chute), exercice d'entraînement, aucune donnée personnelle : on raisonne sur un résident type.
Livrable : [`analyse_risques_eq05.xlsx`](analyse_risques_eq05.xlsx) — 10 lignes : 9 dangers du projet
(5 techniques, 2 d'utilisation, 2 de cybersécurité) + 1 exemple de matériovigilance (Omnipod, ligne 10,
hors projet). Aucun risque « élevé » après mesures.

> **Version 2 (corrections).** (1) Ligne 6 : la gravité est passée de 2 à 1 (l'échelle mesure l'atteinte à la
> santé), et les mesures TLS sont marquées « à mettre en œuvre ». (2) Ajout de la ligne 9 : injection de
> fausses données sur un broker anonyme, le vrai danger cyber pour le patient. (3) Ligne 7 reclassée en
> « Technique » (une panne n'est pas une attaque). (4) Ligne 2 : la probabilité « rare » après mesures
> reposait sur un test synthétique ; ajout d'une détection indépendante du bracelet et d'une condition de
> validation. (5) Ligne 1 : les 7 jours d'autonomie sont un objectif, pas une mesure (le TP M2-4 n'est pas
> dans le dépôt). (6) La chaîne Omnipod est maintenant dans le tableau (ligne 10).

> **Version 3.** Remarque de l'intervenant : *« rappelez-vous de distinguer l'analyse de risques de
> l'analyse d'impact (liée au RGPD) »*. Une section dédiée est ajoutée en fin de document, et deux
> justifications du classeur (lignes 6 et 7) renvoient explicitement à l'AIPD. Fait vérifié dans le
> dépôt et ajouté en colonne R de la ligne 6 : le pont Mosquitto relaie aujourd'hui les constantes,
> les mouvements et les alertes vers `broker.hivemq.com`, un broker **public** en 1883 anonyme.

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

Les 10 chaînes sont dans le classeur, colonnes C à F. Résumé :

| N° | Type | Danger | Dommage |
|---|---|---|---|
| 1 | Technique | Batterie vide, plus d'alerte | Longue attente au sol |
| 2 | Technique | Chute lente non détectée | Attente prolongée au sol, hospitalisation |
| 3 | Technique | Fausse alerte répétée → perte de confiance | Chute réelle prise en charge trop tard |
| 4 | Utilisation | Capteur retiré après la toilette, non remis | Malaise ou chute non détecté |
| 5 | Utilisation | Bracelets échangés entre deux résidents | Alerte envoyée dans la mauvaise chambre |
| 6 | Cybersécurité | Données interceptées (MQTT en clair) | Atteinte à la vie privée, RGPD art. 9 |
| 7 | Technique | Broker saturé ou réseau coupé | Chute non signalée pendant la panne |
| 8 | Technique | IA trompée par un profil hors données d'entraînement | Chute ni anticipée ni détectée |
| 9 | Cybersécurité | Fausses données injectées sur un broker anonyme | Chute masquée, attente prolongée au sol |
| 10 | Technique (hors projet) | Canule Omnipod déchirée | Hyperglycémie, acidocétose |

## Question 3 — Le risque le plus élevé

Deux lignes sont à **9 (Grave × Fréquente)**, le maximum de la matrice :

- **n° 1 — batterie vide** (exemple du classeur) ;
- **n° 4 — capteur mal porté ou retiré** : c'est le plus probable de tous, parce qu'il ne dépend
  d'aucune panne — il suffit d'une toilette et d'un bracelet posé sur la table de nuit.

**Avant mesures, 7 des 9 risques du projet sont « élevés »** (lignes 1, 2, 3, 4, 7, 8, 9 ; 8 sur 10 en
comptant l'exemple Omnipod). La ligne 5 est « moyenne » (2 × 2 = 4) et la ligne 6 « faible »
(1 × 2 = 2). Ce faible ne veut pas dire négligeable : l'échelle mesure l'atteinte à la santé, et une
fuite de données ne demande pas de soins. Le risque vie privée est traité par le RGPD (AIPD), en dehors
de cette matrice. Le danger cyber qui touche vraiment le patient est la ligne 9.

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

Sept lignes du projet restent à **3 (Grave × Rare)** : n° 1, 2, 3, 4, 7, 8 et 9 (plus l'exemple
Omnipod). Toutes pour la même raison : la **gravité ne se réduit pas**. Un résident qui reste des
heures au sol fait une hospitalisation, que la cause soit une batterie, un algorithme, une panne
réseau ou une attaque. Nos mesures n'agissent que sur la probabilité. La matrice le dit elle-même :
un dommage grave ne descend jamais sous « moyen ».

**Trois cotations résiduelles sont conditionnelles**, et c'est écrit en colonne R :

- **n° 1** : l'autonomie de 7 jours est un objectif ; elle n'a pas encore été mesurée (TP M2-4 absent
  du dépôt). À mesurer au projet 1.
- **n° 2** : la règle à trois temps n'a été testée que sur des chutes de téléphone synthétiques
  (TP M2-2). C'est le capteur de chambre indépendant du bracelet qui justifie « rare », à condition
  de valider sur des chutes humaines. Sans cette validation, le risque reste à 6 (élevé).
- **n° 6 et n° 9** : le dépôt est aujourd'hui en MQTT 1883, sans TLS, avec `allow_anonymous true`.
  Les mesures sont prévues, pas implémentées. Tant qu'elles ne le sont pas, la ligne 9 reste à 6
  (élevé).

Justification de les accepter, ligne par ligne en colonne R, et globalement :

- La référence n'est pas le risque zéro, c'est **la situation sans le système** : aujourd'hui une
  chute de nuit est découverte à la ronde suivante, soit jusqu'à deux heures au sol. Avec le
  système, le cas nominal est une alerte en moins d'une minute.
- Chaque mode de défaillance résiduel est rendu **visible** (batterie faible, capteur non porté,
  système dégradé, intégrité douteuse) : le système ne tombe jamais en panne silencieusement, et le
  personnel sait quand repasser en rondes renforcées.
- Les deux lignes qui tombent à « faible » (n° 5 et 6) sont acceptées telles quelles et notées.

Le bénéfice clinique l'emporte donc, à une condition écrite dans les notices : **le système
complète les rondes, il ne les remplace pas**.

## Question 6 — Les règles du module 2 qui sont des mesures de maîtrise

Ce qu'on avait pris pour des choix techniques sont en fait des mesures ISO 14971 :

| Règle du module 2 | Type de mesure | Risque maîtrisé | État dans le dépôt |
|---|---|---|---|
| « Mesure indisponible » : jamais une fausse valeur (TP M2-1) | Conception | n° 4, n° 7 — une valeur inventée est pire que pas de valeur | Validée (TP M2-1) |
| Règle de qualité du signal PPG (TP M2-1) | Conception | n° 4 — un signal inexploitable ne produit pas de FC fantaisiste | Validée (TP M2-1) |
| Règle de chute à trois temps : chute libre → impact → immobilité (TP M2-2) | Conception | n° 2 et n° 3 — précision 0,75 → 1,00 contre le seuil naïf « > 2,5 g » | Testée sur données synthétiques seulement |
| Autonomie de batterie dimensionnée (TP M2-4) | Conception | n° 1 — la recharge oubliée ne suffit plus à éteindre le capteur | Non mesurée (TP absent du dépôt) |
| MQTT chiffré TLS port 8883, un certificat par objet, comptes séparés | Conception | n° 6 (interception) et n° 9 (injection) | **Prévue, pas implémentée** (1883, anonyme) |
| Bluetooth appairé et chiffré (TP M2-3) | Conception | n° 6 — écoute des trames Heart Rate en clair | Prévue |
| Alertes graduées à 5 niveaux avec escalade | Protection | n° 3 — l'alerte non prise remonte d'elle-même | Dans le backend (`alerts/escalation.py`) |
| Signe de vie périodique et horodatage des mesures | Protection | n° 1, n° 7 — l'objet qui se tait est détecté | Prévue |

Autrement dit, l'analyse de risques ne s'ajoute pas au projet : elle **relit** le projet. La plupart
de nos mesures existaient déjà, mais sans être rattachées au dommage qu'elles évitent. La colonne
« État » montre aussi ce que le dossier de marquage CE exigera : une mesure ne compte que si elle
est implémentée **et** vérifiée.

## Pour aller plus loin

**Matériovigilance (Omnipod, rappel ANSM du 3 juin 2026) — ligne 10 du classeur.** Danger : canule
qui peut se déchirer ; séquence : déchirure → moins d'insuline délivrée que la dose programmée → le
patient ne le voit pas ; situation dangereuse : patient diabétique sous-dosé sans le savoir ;
dommage : hyperglycémie, acidocétose. L'analyse de risques ne s'arrête pas à la mise sur le marché :
les incidents remontés rouvrent le dossier. Ligne à retirer à l'analyse de risques v1 (projet 1).

**L'IA (AI Act)** — ligne 8 : l'IA se trompe sur un profil absent des données d'entraînement.

**Une mesure qui crée un risque.** Notre mesure du n° 3 (durcir les critères pour supprimer les
fausses alertes) augmente directement le n° 2 (chute lente non détectée) : moins de bruit, mais
plus de silence. C'est l'arbitrage précision / rappel du TP M2-2, devenu ici un arbitrage de
sécurité. Même chose pour la mesure du n° 7 : la file locale qui rejoue les messages après une
coupure peut livrer au poste de soins une alerte vieille de dix minutes — d'où l'horodatage
obligatoire sur chaque message, pour qu'une alerte en retard soit lisible comme telle. Et le
capteur de chambre ajouté au n° 2 crée lui aussi ses propres dangers (fausse détection quand un
soignant se penche, panne silencieuse) : il devra avoir sa propre ligne au projet 1.

## Analyse de risques ≠ analyse d'impact (AIPD) — remarque de l'intervenant

Ce sont **deux analyses différentes, sur les mêmes faits**. Elles ne protègent pas la même chose et
ne se cotent pas sur la même échelle.

| | Analyse de risques (ISO 14971) | Analyse d'impact — AIPD (RGPD art. 35) |
|---|---|---|
| Protège | Le patient : son corps, sa santé | La personne : ses droits et libertés, sa vie privée |
| Le « dommage » | Une atteinte à la santé (attente au sol, hospitalisation) | Une atteinte aux droits (fuite, surveillance subie, discrimination, perte de contrôle) |
| Les questions | « Et si l'alerte n'arrive pas ? Et si elle sonne pour rien vingt fois par nuit ? » | « Qui accède aux mouvements des résidents ? Combien de temps les garde-t-on ? Les résidents et les familles sont-ils informés ? » |
| Sortie | Ce classeur : dominos, cotation, mesures, risque résiduel | Un document AIPD : finalité, base légale, minimisation, durées, droits, mesures |
| Qui le porte | Le fabricant (dossier de marquage CE) | Le responsable de traitement, ici l'EHPAD, avec son DPO |

C'est pour cela que la **ligne 6** (données interceptées) est cotée gravité **1** dans ce classeur :
l'échelle du cours mesure l'atteinte à la santé, et une fuite de données ne demande pas de soins.
Cela ne veut pas dire que le risque est faible — il est **grave sur l'autre échelle**, celle de
l'AIPD. À l'inverse, la **ligne 9** (fausses données injectées) reste un risque de sécurité patient :
l'attaque masque une chute, le dommage est l'attente au sol.

### Notre traitement est-il soumis à AIPD ?

Très probablement **oui**, et il faut le confirmer sur la liste de la CNIL. Les lignes directrices du
CEPD (ex-G29) demandent une AIPD dès que **deux critères** sur neuf sont réunis. Nous en cumulons
au moins quatre :

1. **données sensibles** — données de santé (RGPD art. 9) : fréquence cardiaque, SpO2, chutes ;
2. **personnes vulnérables** — des résidents d'EHPAD, parfois sous tutelle ou atteints de troubles
   cognitifs, qui ne peuvent pas s'opposer librement ;
3. **surveillance systématique** — les mouvements, jour et nuit, en continu, dans le lieu de vie ;
4. **usage innovant** — objets connectés et score de risque calculé par un modèle (module 4).

### Les trois questions de l'intervenant

**Qui y accède ?** À définir dans l'AIPD, par rôle et non par personne : les soignants de l'étage
voient les résidents dont ils ont la charge ; le cadre de santé voit l'établissement ; l'administrateur
technique accède aux journaux, pas aux constantes nominatives ; la famille ne voit rien par défaut.
Comptes nominatifs, pas de compte partagé au poste de soins, et journalisation des accès. *État
actuel du dépôt : un seul rôle, pas d'authentification applicative — à construire.*

**Combien de temps les garde-t-on ?** Proposition à arbitrer avec le DPO de l'EHPAD : constantes
brutes **30 jours** en base active (le temps d'expliquer une alerte), puis suppression ; alertes et
leur suite conservées avec le dossier de soin, selon les règles d'archivage du dossier médical ;
statistiques d'établissement **anonymisées** (pas de ré-identification possible) pour le pilotage.
Une durée illimitée « au cas où » est exactement ce que l'AIPD refuse.

**Les résidents et les familles sont-ils informés ?** C'est une obligation (art. 12 à 14) et pas une
politesse : information écrite à l'entrée, annexée au contrat de séjour et au projet d'accompagnement
personnalisé, en langage simple — ce qui est mesuré, ce qui ne l'est pas (ni caméra, ni micro, ni
enregistrement sonore), qui est alerté, combien de temps c'est conservé, comment s'y opposer et
auprès de qui. La personne de confiance ou le représentant légal est associé quand le résident ne
peut pas consentir. L'information doit être **répétée**, pas donnée une fois le jour de l'admission.

### Ce que l'AIPD ajouterait à notre projet

- **Minimisation** : ne remonter que ce qui sert à détecter (chute, constantes), pas la trace complète
  des déplacements ; agréger dès que possible.
- **Pont vers le broker public** : le relais vers `broker.hivemq.com` en 1883 anonyme est acceptable
  pour des données fictives de TP, inacceptable dès qu'un vrai résident est derrière. À supprimer
  avant toute mise en service, et à décrire tel quel dans l'AIPD.
- **Sous-traitance** : tout hébergeur de ces données doit être **HDS** (hébergeur de données de
  santé), avec un contrat art. 28.
- **Lien avec l'analyse de risques** : les mesures se recoupent (TLS, comptes séparés, journalisation)
  mais les justifications diffèrent. Une même mesure peut être obligatoire d'un côté et seulement
  utile de l'autre.
