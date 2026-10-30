# Projet 1 — Dossier de cadrage

MBA 2 Santé, IA & IoT — Epitech — 2026-2027 · journée du 30 octobre 2026 · équipe 05

> Modèle d'origine : [`P1_Dossier_de_cadrage_modele.pdf`](P1_Dossier_de_cadrage_modele.pdf).
> Règles du dossier : une donnée inventée ou non vérifiée est marquée **hypothèse** ou **à vérifier**.
> Aucune donnée de vrai patient : tous les personnages sont fictifs. Aucun mot de passe.

| Heure | Exercice | Partie | État |
| --- | --- | --- | --- |
| 09:45-10:00 | Lancement : les rôles | [Page de garde](#page-de-garde) | fait |
| 10:00-11:15 | Exercice 1 — Le besoin | [Partie 1](#partie-1--le-besoin-exercice-1) | fait |
| 11:30-12:30 | Exercice 2 — La phrase et la classe | [Partie 2](#partie-2--la-phrase-et-la-classe-exercice-2) | à faire |
| 14:00-15:00 | Exercice 3 — L'architecture | [Partie 3](#partie-3--larchitecture-exercice-3) | à faire |
| 15:00-16:30 | Exercice 4 — La preuve de concept | [Partie 4](#partie-4--la-preuve-de-concept-exercice-4) | à faire |
| 16:30-17:00 | Bilan | [Bilan](#bilan--les-3-tâches-pour-le-13-novembre) | à faire |

---

## Page de garde

| | |
| --- | --- |
| Nom de code du produit | **Veilleur** : comme le veilleur de nuit de l'EHPAD, il veille quand l'équipe ne peut pas être partout |
| Projet (A, C, D, F ou souris) | **A — chute** : détection de chute et de malaise chez les résidents d'EHPAD |
| Groupe et campus | Équipe 05 — Epitech Bordeaux |
| Pilote (planning, dépôts) | Cedric Usannaz |
| Référent technique (Wokwi, MQTT, tableau de bord) | Cedric Usannaz |
| Référent réglementaire (phrase de notice, classe) | Fares Mansour |
| Référent risques et données | Titouan Brunet |
| Lien du dépôt Git | https://github.com/Usannazcedric/monitoring-ehpad |
| Lien du tableau blanc | Pas de tableau blanc en ligne : la partie 1 a été travaillée directement dans ce dossier |

4 rôles pour 3 personnes : Cedric cumule pilote et technique (il porte déjà le dépôt et le firmware Wokwi du module 1). Titouan prend les risques et données, le plus gros chantier du 13 novembre (analyse de risques et AIPD).

---

## Partie 1 — Le besoin (exercice 1)

> **Exercice 1 (10:20-11:15) — On part du patient, pas du capteur.**
> 1. Le contexte : remplissez le tableau 1.1 et écrivez le problème en une phrase.
> 2. Les 4 personas : patient, aidant, soignant, opérateur (tableau 1.2).
> 3. Le parcours : au moins 3 moments de mesure et 3 moments de rupture (tableau 1.3).

### 1.1 Le contexte

| Question | Notre réponse |
| --- | --- |
| Pour qui ? | Les **résidents d'EHPAD à risque de chute ou de malaise** : personnes très âgées, fragiles, souvent atteintes de plusieurs maladies, parfois de troubles cognitifs. Beaucoup ne peuvent pas, ou ne pensent pas à, appeler à l'aide seules. |
| Où ? | Dans l'EHPAD, surtout **dans la chambre** (lever du lit, trajet vers les toilettes, salle de bain), mais aussi dans les couloirs et la salle commune. Le moment critique est **la nuit**, quand l'équipe est la plus réduite. |
| Ce qui doit alerter | 1. **Une chute** : choc suivi d'une immobilité au sol. 2. **Un malaise** : fréquence cardiaque anormale, SpO2 basse (< 93 %, seuil du cahier des charges), absence de mouvement prolongée. 3. **Une sortie de chambre la nuit** d'un résident désorienté. 4. **Une dégradation lente** des constantes qui annonce un risque. 5. **Un capteur muet** (non porté, batterie vide, hors réseau) : un silence ne doit jamais passer pour « tout va bien ». |
| Qui est concerné ? | Le **résident** ; les **aides-soignants et infirmiers de garde** (en premier la nuit) ; l'**infirmier coordinateur** et le **médecin coordonnateur** ; la **famille** (aidant) ; la **direction** de l'EHPAD ; un **opérateur de télésurveillance** si la supervision de nuit est externalisée ; le **SAMU (15)** pour les urgences vitales. |
| Comment ça se passe aujourd'hui ? | **Rondes de nuit** à intervalle fixe (toutes les 2 h environ, **hypothèse, à vérifier** auprès d'un EHPAD). **Sonnette ou médaillon d'appel**, qui suppose que le résident soit conscient, le porte et pense à appuyer. Une chute peut n'être **découverte qu'à la ronde suivante ou au matin**. Les constantes sont prises **ponctuellement** (**hypothèse** : une fois par jour à une fois par semaine selon le résident) et notées dans le dossier de soins. Effectif de nuit : 2 soignants pour environ 80 résidents (**hypothèse, à vérifier**). |
| Quelle décision notre mesure aide-t-elle à prendre ? Qui la prend ? | **Tout de suite** : le **soignant de garde** décide d'aller dans telle chambre maintenant, laquelle en priorité si plusieurs alertes tombent ensemble, et s'il faut appeler l'infirmier, le médecin ou le 15. **À moyen terme** : l'**infirmier coordinateur** et le **médecin coordonnateur** adaptent le plan de prévention des chutes du résident à partir de l'historique (chutes, levers nocturnes, tendances). La mesure **aide à décider** ; elle ne pose pas de diagnostic et ne décide pas à la place du soignant. |

**Le problème en une phrase :**

> « Aujourd'hui, **l'équipe de nuit d'un EHPAD** ne peut pas **savoir à temps qu'un résident est tombé ou fait un malaise dans sa chambre** parce qu'**elle dépend de rondes espacées et d'un bouton d'appel que le résident ne peut pas ou ne pense pas à utiliser**, ce qui entraîne **des stations prolongées au sol et des prises en charge tardives** (hypothermie, déshydratation, escarres, hospitalisation, perte d'autonomie). »

**Repères chiffrés**

| Donnée | Source | Statut |
| --- | --- | --- |
| 10 000 décès par an en France liés aux chutes des personnes âgées | Cahier des charges du projet (MBA 1), [`docs/cahier-des-charges-projet2.pdf`](../docs/cahier-des-charges-projet2.pdf) | **à vérifier** (source primaire : Santé publique France) |
| Rester au sol plus d'une heure aggrave fortement le pronostic | Notion couramment citée en gériatrie | **à vérifier** (trouver la publication) |
| Rondes de nuit toutes les 2 h, 2 soignants pour 80 résidents | Ordre de grandeur, aucune source | **hypothèse** |

### 1.2 Les 4 personas

Personnages inventés mais réalistes. Les noms, âges et citations sont **fictifs**.

| | Patient | Aidant | Soignant | Opérateur de télésurveillance |
| --- | --- | --- | --- | --- |
| Profil (âge, situation) | **Jeanne**, 87 ans, résidente depuis 2 ans, veuve. Arthrose, hypertension traitée, troubles de mémoire légers. Marche avec un déambulateur. Deux chutes la nuit en allant aux toilettes l'an dernier. | **Philippe**, 58 ans, fils de Jeanne, cadre, vit à 300 km. Vient une fois par mois, appelle deux fois par semaine. Référent famille auprès de l'EHPAD. | **Sarah**, 34 ans, aide-soignante de nuit depuis 8 ans. En binôme pour environ 80 résidents répartis sur 3 étages (**hypothèse**). | **Thomas**, 41 ans, opérateur sur une plateforme de télésurveillance qui supervise la nuit plusieurs EHPAD du groupe. Ancien ambulancier. |
| Objectif | Garder son autonomie (se lever seule la nuit) sans avoir peur de rester au sol. Ne pas se sentir « surveillée ». | Être prévenu rapidement d'un événement important et être rassuré, sans recevoir tout le détail médical. | Savoir **où aller en priorité** et ne plus découvrir un résident au sol pendant une ronde. | **Qualifier vite** chaque alerte (vraie ou fausse), s'assurer qu'elle est prise en charge, escalader au 15 si besoin. |
| Freins aujourd'hui | Oublie le médaillon sur la table de nuit. N'ose pas sonner la nuit pour « ne pas déranger ». Retire ce qu'elle porte au poignet pour la toilette. Craint d'être filmée. | Apprend les chutes plusieurs jours après, par hasard. Difficile de joindre l'EHPAD. Culpabilité liée à la distance. | Rondes longues qui réveillent les résidents. Toutes les sonnettes se ressemblent (un verre d'eau ou une chute). Trop de bips : fatigue d'alarme. Pas d'écran dans le couloir, seulement le téléphone de service. | Une alerte arrive sans contexte (antécédents, consignes, soignant de garde). Impossible de distinguer un capteur hors ligne d'un résident immobile. |
| Aisance avec le numérique | **Très faible** : pas de smartphone. L'objet doit fonctionner **sans aucune action** de sa part. | **Bonne** : smartphone, applications, messagerie. | **Moyenne** : smartphone personnel, logiciel de soins rempli en fin de poste. | **Élevée** : multi-écrans, logiciels de supervision et de téléphonie. |
| Critère de succès | En cas de chute, un soignant arrive en moins de 10 min sans qu'elle ait appuyé sur quoi que ce soit (**hypothèse** de seuil). Elle garde l'objet au poignet jour et nuit sans s'en plaindre. | Il est informé **le jour même** d'une chute, par un message clair et sans jargon médical (avec l'accord de sa mère). | Au plus 2 fausses alertes par nuit (**hypothèse**). L'alerte se lit en 3 secondes sur l'appareil qu'elle porte déjà : chambre, niveau, motif. | 100 % des alertes de niveau 4 acquittées ou escaladées en moins de 3 min (règle d'escalade du cahier des charges). Chaque alerte est tracée. |
| Citation (inventée) | « Je ne veux pas déranger les filles la nuit, elles ont tellement de travail. » | « J'ai appris sa chute trois jours après, au détour d'une conversation. » | « On est deux pour 80 résidents, je ne peux pas être dans toutes les chambres. » | « Une alerte sans contexte, je ne sais pas si j'appelle le 15 ou l'aide-soignante. » |

### 1.3 Le parcours du patient

Les moments de mesure sont numérotés **M0 à M5**, les ruptures **R1 à R15**.

| Étape | Qui ? | Fait quoi ? | Moment de mesure ? | Ce qui peut casser (rupture) |
| --- | --- | --- | --- | --- |
| Décision d'utiliser l'objet | Médecin coordonnateur et infirmier coordinateur, avec la résidente et sa famille | Évaluent le risque de chute à l'entrée ou après une chute. Décident d'équiper. Informent et recueillent le consentement (finalité, données collectées, qui les voit). | **M0 — évaluation initiale** : grille ou test de risque de chute (test de marche chronométré, **à vérifier** avec un soignant), constantes de référence. | **R1** La résidente refuse : sentiment d'être surveillée. **R2** Elle ne peut pas consentir seule (troubles cognitifs) : il faut passer par la famille ou le tuteur. **R3** Critères flous : on équipe tout le monde ou personne. |
| Installation | Aide-soignant référent et référent technique de l'EHPAD | Posent le bracelet, l'associent à la résidente et à sa chambre dans le tableau de bord, installent les capteurs de chambre (présence, porte), déclenchent une alerte test. | **M1 — période de référence** : 7 jours de données pour apprendre le « normal » de la résidente (le modèle actuel s'entraîne sur 7 jours, aujourd'hui **synthétiques**). | **R4** Bracelet associé à la mauvaise résidente : alerte envoyée dans la mauvaise chambre. **R5** Wi-Fi absent ou faible dans la chambre (**à vérifier** sur site). **R6** Période de référence faussée si la résidente est malade cette semaine-là. |
| Usage quotidien | La résidente (porte l'objet), les soignants (rechargent, consultent) | Porte le bracelet jour et nuit et le retire pour la toilette. Les soignants le rechargent (**hypothèse** : une fois par semaine) et consultent le tableau de bord au poste. | **M2 — mesure continue** : mouvement en continu (accéléromètre), fréquence cardiaque et SpO2 à intervalle régulier, capteurs de chambre (présence au lit, ouverture de porte), tendance calculée sur 15 min. | **R7** Bracelet non remis après la toilette. **R8** Batterie vide. **R9** Perte de signal : le silence est pris pour « tout va bien ». |
| Alerte | Le système, vers le soignant assigné | Détecte une chute (chute libre, choc, immobilité), une constante hors seuil ou un risque prédit. Envoie une alerte de niveau 1 à 5 avec la chambre et le motif. | **M3 — l'événement** : pic d'accélération, immobilité au sol, SpO2 < 93 %, FC hors seuil, heure exacte de détection. | **R10** Chute lente (glissade le long du lit) non détectée. **R11** Fausse alerte (s'asseoir lourdement) répétée : les soignants n'y croient plus. **R12** L'alerte reste sur l'écran du poste et personne ne la voit la nuit. |
| Traitement de l'alerte | Aide-soignante de garde, infirmier, opérateur de télésurveillance, SAMU si niveau 5 | Acquitte l'alerte, va dans la chambre, évalue et relève la résidente, appelle l'infirmier, le médecin ou le 15, puis clôture avec un motif (vraie chute, fausse alerte). | **M4 — les délais** : détection → acquittement → arrivée dans la chambre, et le motif de clôture (sert à mesurer la performance réelle). | **R13** Soignante occupée ailleurs : l'alerte n'est pas acquittée et doit escalader (2→3 en 10 min, 3→4 en 5 min, 4→5 en 3 min). **R14** L'événement n'est pas reporté dans le dossier de soins (ressaisie à la main, oubli). |
| Fin | Médecin coordonnateur, équipe soignante, famille | Arrêt de l'objet : risque réévalué, résidente alitée, hospitalisation, départ ou décès. Le bracelet est dissocié, nettoyé, réattribué. Les données sont archivées puis supprimées. | **M5 — bilan** : chutes détectées, délais moyens, fausses alertes par nuit ; réévaluation périodique du risque (**hypothèse** : tous les 3 mois). | **R15** Bracelet réattribué sans réinitialiser le profil : le modèle garde le « normal » de l'ancienne résidente. Données conservées sans limite de durée (RGPD). Oubli de désactiver : alertes fantômes. |

**À retenir pour le tour de 11:15**

- **Le problème** : la nuit, une chute en chambre est découverte trop tard, parce que tout repose sur des rondes et sur un bouton que la résidente n'utilise pas.
- **Les mesures clés** : M2 (mesure continue sans action de la résidente), M3 (détection de l'événement), M4 (délai jusqu'à l'arrivée du soignant, notre vrai indicateur de succès).
- **Les ruptures clés** : R7-R8 (bracelet non porté ou vide), R11 (fausses alertes qui tuent la confiance), R12 (alerte qui ne sort pas de l'écran la nuit).

---

## Partie 2 — La phrase et la classe (exercice 2)

> **Exercice 2 (11:45-12:15) — Même objet, autre phrase : autre statut.**
> 1. Écrivez votre phrase de notice (2.1).
> 2. Dispositif médical ou pas ? Classe et règle, avec le raisonnement (2.2).
> 3. Écrivez une variante bien-être et ce qu'elle change (2.3).

_À remplir à partir de 11:45. Point de départ : [`analyses/m3/reponses.md`](../analyses/m3/reponses.md), question 5._

### 2.1 La phrase de notice

« [Produit] est destiné à [action] chez [patients] afin de [but]. »

**Notre phrase :**

**Ce que le produit ne fait pas :**

### 2.2 Statut et classe

| Question | Notre réponse et pourquoi |
| --- | --- |
| 1. Finalité médicale ? (diagnostiquer, surveiller, prévenir, traiter) | |
| 2. Quelle règle ? (règle 10 : l'appareil qui mesure ; règle 11 : le logiciel) | |
| 3. Quelle classe ? (la plus élevée) | |
| Organisme notifié ? (obligatoire dès IIa) | |

### 2.3 La variante bien-être

**Phrase sans finalité médicale :**

**Ce que ça change** (statut, preuves, coût, délai, confiance des soignants), en 5 lignes :

---

## Partie 3 — L'architecture (exercice 3)

> **Exercice 3 (14:15-14:55) — Du capteur à l'alerte, du prototype au vrai produit.**
> 1. Dessinez le schéma de bout en bout ; marquez ce qui vient de MBA 1 (3.1).
> 2. Choisissez le capteur du vrai produit : fabriquer ou acheter, et pourquoi (3.2).
> 3. Remplissez le tableau des écarts : au moins 6 lignes (3.3).

_À remplir à partir de 14:15. Points de départ : [`docs/architecture.md`](../docs/architecture.md) et [`docs/etat-des-lieux.pdf`](../docs/etat-des-lieux.pdf) (16 écarts déjà cotés)._

### 3.1 Le schéma de bout en bout

Schéma : capteurs → carte → réseau → cloud → tableau de bord → alertes.

| Étape | Dans le prototype | Repris de MBA 1 ? |
| --- | --- | --- |
| Capteurs | | |
| Carte (ESP32) | | |
| Réseau | | |
| Cloud (hébergeur de données de santé) | | |
| Tableau de bord | | |
| Alertes (qui les reçoit ?) | | |

### 3.2 Le capteur du vrai produit

| Question | Réponse |
| --- | --- |
| Ce qu'on mesure | |
| Capteur du prototype | |
| Capteur du vrai produit | |
| Fabriquer (build) ou acheter un dispositif CE existant (buy) ? | |
| Pourquoi (délai, coût, preuves, dépendance) | |

### 3.3 Les écarts entre prototype et produit

| Sujet | Prototype | Vrai produit | Ce qu'il faudra faire |
| --- | --- | --- | --- |
| Capteur et précision | | | |
| Énergie et autonomie | | | |
| Réseau | | | |
| Sécurité (mots de passe, mises à jour) | | | |
| Boîtier, nettoyage, contact avec la peau | | | |
| Statut réglementaire | | | |

---

## Partie 4 — La preuve de concept (exercice 4)

> **Exercice 4 (15:00-16:30) — Prouver le principe, sans attendre le matériel.**
> 1. Copiez votre projet Wokwi du module 1 et ajoutez les capteurs de votre projet (4.1).
> 2. Publiez en MQTT et vérifiez l'arrivée dans le tableau de bord (4.1).
> 3. Enregistrez une première série de vraies données dans `projet1/donnees/` (4.2).
>
> Jamais de chute humaine : le téléphone tombe sur un coussin.

_À remplir à partir de 15:00. Point de départ : [`firmware/m1_wokwi/`](../firmware/m1_wokwi/)._

### 4.1 Wokwi

| | |
| --- | --- |
| Lien du projet Wokwi | |
| Capteurs simulés (et ce qu'ils remplacent) | |
| Topic MQTT et contenu d'un message | |
| Capture du tableau de bord | |

### 4.2 Les vraies données

| | |
| --- | --- |
| Source (phyphox, jeu de données) | |
| Fichier dans `projet1/donnees/` | |
| Ce qu'on a enregistré (activités, durée) | |

### 4.3 Pour le 13 novembre

| | |
| --- | --- |
| Traitement (filtre, seuil, comptage) | |
| Alerte de bout en bout (capture) | |
| Autonomie calculée (calculateur du module 2) et hypothèses | |

---

## Bilan — Les 3 tâches pour le 13 novembre

> **Bilan (16:30-17:00)** : écrivez vos 3 tâches, puis déposez le dossier dans `projet1/` avant 18:00.

| Tâche | Qui | Pour quand |
| --- | --- | --- |
| | | |
| | | |
| | | |

_Le 13 novembre, on ajoutera deux parties : l'analyse de risques et l'analyse d'impact sur les données personnelles (AIPD)._
