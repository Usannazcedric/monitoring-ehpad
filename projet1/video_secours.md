# Vidéo de secours : le script (3 minutes)

Le guide « La démo idéale » impose une vidéo de secours de 2 à 3 minutes : le même
scénario que la démo en direct, avec votre voix. Si la démo échoue le 27/11, on la lance
en 10 secondes.

**Règles du guide :**
- **Pas de fichier vidéo dans le dépôt.** Mettez la vidéo sur Teams ou sur Drive, puis son
  lien dans le `README.md` avant 11:00 le 27/11.
- **Aucun mot de passe à l'écran** (moins 5 points). Avant d'enregistrer, fermez les onglets
  de compte et les gestionnaires de mots de passe. Coupez aussi les notifications.

## Avant d'enregistrer (5 minutes)

1. Lancez `./demo.sh` : la stack démarre et le tableau de bord s'ouvre, en mode présentation
   (chambre 121 seule).
2. Dans Wokwi, lancez la simulation (▶) et attendez `MQTT : connexion … OK` dans le moniteur
   série. Gardez l'onglet Wokwi **visible** : masqué, il ralentit.
   Au démarrage, le moniteur doit afficher `Bracelet : porte`. S'il affiche `Bracelet : RETIRE`,
   cliquez sur l'interrupteur de droite jusqu'à lire `[PORT] bracelet remis` : après un
   redimensionnement de la fenêtre, Wokwi peut dessiner l'interrupteur dans la mauvaise position.
3. Dans l'onglet **Démo**, cliquez sur « Tout clôturer » pour partir d'un tableau propre.
4. Ouvrez le dossier à la partie 4.2, sur la figure du benchmark (`resultats/benchmark/regles_par_jeu.png`).
5. Mettez Wokwi et le tableau de bord **côte à côte**, en deux fenêtres. Enregistrez l'écran
   avec QuickTime (Fichier → Nouvel enregistrement de l'écran), micro activé.

## Le script

| Temps | À l'écran | Ce que vous dites |
| --- | --- | --- |
| **0:00-0:20** Le persona | Tableau de bord, chambre 121 | « Voici Jeanne, 87 ans. Elle marche avec un déambulateur et elle est tombée deux fois la nuit l'an dernier, en allant aux toilettes. La nuit, deux soignants veillent sur 80 résidents. Veilleur prévient le soignant quand elle tombe. » |
| **0:20-0:45** Le montage | Wokwi : montrer chaque composant | « Dans Wokwi, la carte ESP32 joue le bracelet. Le MPU-6050 est son accéléromètre. Le bouton rouge sert à appeler, le vert à annuler une fausse alerte. Le bouton jaune rejoue une chute pour la démo, et c'est la vraie règle qui la juge. L'interrupteur de droite dit si le bracelet est porté. » |
| **0:45-1:05** La situation normale | Moniteur série, puis la fiche de la chambre 121 | « Toutes les 2 secondes, la carte publie un message MQTT : pouls et position. Il arrive ici. Tant que tout va bien, rien ne sonne. » |
| **1:05-1:55** La chute | Appui sur le bouton jaune CHUTE ; les bips ; l'Urgence sur le tableau de bord ; clic sur « Je prends en charge » | « Jeanne tombe. La carte voit un choc, puis 3 secondes d'immobilité, puis une position couchée : c'est une chute. Elle a 15 secondes pour annuler si elle va bien. … Elle n'annule pas : l'alerte arrive chez le soignant de nuit, en Urgence. Il clique sur « Je prends en charge ». Sans réponse, l'alerte serait montée jusqu'à l'infirmier de garde, puis au 15. » |
| **1:55-2:30** Les vraies données | Figure du benchmark (dossier, 4.2) | « Wokwi prouve la chaîne, pas la règle. Pour la règle, nous l'avons testée sur deux jeux publics. Avec le capteur à la taille, elle détecte 97 % des chutes de SisFall, avec 3 fausses alertes par heure. Mais au poignet, sur FallAllD, elle n'en détecte que 52 % : le bras bouge après la chute. C'est notre limite principale, et nous l'avons mesurée. » |
| **2:30-2:45** Robustesse et autonomie | Wokwi : l'interrupteur « porté » basculé **dès 2:00**, pendant la figure (l'alerte part 30 s après) ; la fiche de la chambre 121 en Attention, « bracelet non porté » | « Bracelet retiré pour la toilette : la carte n'envoie plus de mesure fausse, et le poste est prévenu. Autonomie calculée : 10 jours sur une batterie de 300 mAh. » |
| **2:45-3:00** Les limites | Tableau de bord | « Nos chutes de référence sont jouées par des volontaires sur un tapis. Au Projet 2, nous apprendrons une règle sur de vraies données au poignet, ou nous placerons le capteur au cou. » |

## Après

- Regardez la vidéo en entier : pas de mot de passe, pas de notification, le son est audible.
- Déposez-la sur Teams ou Drive, en accès « toute personne de l'école ayant le lien ».
- Ajoutez son lien dans le `README.md`, à la ligne prévue, puis poussez.
