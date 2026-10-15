# TP M2-3 — Bluetooth basse consommation (nRF Connect) — livrable

Module 2 — 9 octobre 2026 — MBA Santé, IA & IoT — Epitech.
Trames fictives, usage pédagogique, aucune finalité diagnostique.

## Contenu du dossier

| Fichier | Contenu |
|---|---|
| `trames_decodees.csv` | Les 6 trames décodées par le notebook `TP_M2_3_BLE_decodeur.ipynb` |
| `trames_decodees.md` | Les trames 3, 5 et 2 décodées à la main (modèles complétés + tableau de réponses), plus les bonus 1, 4 et 6 |
| `capture_nrfconnect.png` | **À ajouter** : capture du scan ou du service Heart Rate, noms personnels floutés |

## Voie utilisée

**Voie C** (trames fournies). <!-- À corriger en A ou B si l'équipe a capturé de vraies trames ; les coller alors dans le Bonus A du notebook. -->

## Étape 1 — Tableau des 5 appareils scannés (anonymisé)

> À compléter avec le scan nRF Connect de l'équipe. Ne jamais recopier un nom personnel : « écouteurs d'un membre », « montre », « inconnu ».

| # | Nom affiché (anonymisé) | RSSI (dBm) | Services annoncés (UUID) | Données fabricant ? | Ce que l'annonce révèle |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

RSSI de l'appareil d'un membre : à 30 cm = … dBm ; à 3 m = … dBm ; derrière une porte = … dBm.

## Réponses — Étape 1

**a. Pourquoi le RSSI ne suffit pas pour mesurer une distance précise ?**
Le signal à 2,4 GHz fluctue fortement : réflexions (multitrajets), obstacles, absorption par le corps humain (eau), orientation de l'antenne. La puissance d'émission varie aussi d'un appareil à l'autre. On obtient une proximité grossière (près / loin), pas une distance au mètre près.

**b. Quels noms peuvent trahir leur propriétaire ? Quel risque pour un dispositif médical ?**
Les noms par défaut du type « iPhone de Prénom », « AirPods de Prénom » ou « Montre de Prénom » identifient la personne. Un dispositif qui diffuse « Pompe de M. X » ou « Holter chambre 12 » révèle à n'importe qui une donnée de santé (diabète, suivi cardiaque) et une localisation (RGPD art. 9, secret médical). Il permet aussi de suivre la personne et de cibler l'appareil pour une attaque (connexion, brouillage). Le nom diffusé doit être un identifiant d'appareil neutre.

**c. Les adresses changent-elles ? À quoi cela sert-il ?**
Oui, pour beaucoup de téléphones et d'objets récents : ce sont des adresses privées aléatoires (RPA) renouvelées périodiquement, environ toutes les 15 minutes. Elles empêchent le pistage d'une personne dans le temps. Seuls les appareils appairés, qui possèdent la clé IRK, savent les relier au vrai appareil.

## Réponses — Questions du notebook (section 4)

1. **Pourquoi une FC sur 2 octets ?** La norme est générique : elle doit couvrir les valeurs supérieures à 255 bpm (tachyarythmies, nouveau-nés, usage vétérinaire) sans changer de format. Le bit 0 économise un octet dans le cas courant.
2. **Trame `04 3E`** (détection prise en charge, pas de contact) : l'application doit afficher « pas de contact / capteur mal positionné ». Elle ne doit **pas** envoyer 62 bpm au soignant comme une mesure valide : au mieux, la marquer invalide et lever une alerte technique, pour éviter une fausse réassurance ou une fausse alarme.
3. **Deux RR pour une FC (trame 6)** : le capteur notifie environ 1 fois par seconde, mais à 78 bpm le cœur bat environ 1,3 fois par seconde. Tous les battements depuis la dernière notification sont envoyés, du plus ancien au plus récent. La FC, elle, est une moyenne sur quelques secondes.
4. **Trame 5 lue en big-endian** : `20 03` → `0x2003` = 8195 → 8195 / 1024 ≈ **8,0 s** entre deux battements (≈ 7,5 bpm) au lieu de 0,781 s. Contrôle de bon sens : un RR humain est entre ~0,3 et 2 s, et 60 / RR doit être proche de la FC annoncée (75 bpm → RR ≈ 0,8 s).
5. **Intérêt d'un format normalisé** : interopérabilité (toute application ou passerelle compatible lit le capteur, sans dépendre d'un fournisseur) ; spécification publique et éprouvée, donc moins d'ambiguïtés et de bugs ; outils de test existants (nRF Connect le décode) ; documentation et traçabilité facilitées pour la conformité réglementaire (MDR, IEC 62304).

## Vérification Python (étape 5)

- Tableau des 6 trames : FC 72, 90, 62, 85, 75, 78 bpm.
- `OK` pour chaque FC décodée à la main.
- `Tous les tests sont passés.`
