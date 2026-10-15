# TP M2-3 — Décodage à la main des trames Heart Rate Measurement (0x2A37)

Trames fictives, usage pédagogique, aucune finalité diagnostique.
Ordre de lecture : flags (1 octet) → FC (1 ou 2 octets) → énergie (2 octets si bit 3) → RR (2 × n octets si bit 4).

## Trame 3 : `06 3E`

| Octet(s) | Je le transforme | Ce que ça veut dire |
|---|---|---|
| `06` (interrupteurs) | 0 → `0000` ; 6 → `0110` ; donc `0000 0110` | bit 0 : 0 → FC sur 1 octet (uint8) ; bits 1 et 2 : 1 et 1 → contact pris en charge **et détecté** ; bit 3 : 0 → pas d'énergie ; bit 4 : 0 → pas de RR |
| `3E` | 3 × 16 + 14 = 62 | FC = **62 bpm** |
| Reste-t-il un octet ? | non (2 octets lus sur 2) | trame complète |

## Trame 5 : `16 4B 20 03`

| Octet(s) | Je le transforme | Ce que ça veut dire |
|---|---|---|
| `16` (interrupteurs) | `0001 0110` | bit 0 : 0 → FC sur 1 octet ; bits 1 et 2 : 1 et 1 → contact détecté ; bit 3 : 0 → pas d'énergie ; bit 4 : 1 → RR présent(s) |
| `4B` | 4 × 16 + 11 = 75 | FC = **75 bpm** |
| `20 03` | je retourne : `03 20` → 3 × 256 + 32 = 800 | RR = 800 / 1024 = 0,781 s = **781 ms** ; FC instantanée = 60 / 0,781 ≈ **76,8 bpm** |
| Reste-t-il un octet ? | non (4 octets lus sur 4) | trame complète |

## Trame 2 : `01 5A 00`

| Octet(s) | Je le transforme | Ce que ça veut dire |
|---|---|---|
| `01` (interrupteurs) | `0000 0001` | bit 0 : 1 → FC sur **2 octets** (uint16) ; bits 1 et 2 : 0 et 0 → détection de contact **non prise en charge** (on ignore le bit 1) ; bit 3 : 0 → pas d'énergie ; bit 4 : 0 → pas de RR |
| `5A 00` | je retourne : `00 5A` → 0 × 256 + 90 = 90 | FC = **90 bpm** (lu à l'endroit, `5A 00` donnerait 23 040 bpm : absurde) |
| Reste-t-il un octet ? | non (3 octets lus sur 3) | trame complète |

## Tableau de réponses

| n° | Flags (interrupteurs) | Format FC | Contact | FC (bpm) | Énergie (kJ) | RR (ms) | FC instantanée 60/RR (bpm) |
|---|---|---|---|---|---|---|---|
| 3 | `0000 0110` | uint8 | détecté | 62 | — | — | — |
| 5 | `0001 0110` | uint8 | détecté | 75 | — | 781 | 76,8 |
| 2 | `0000 0001` | uint16 | non pris en charge | 90 | — | — | — |

## Bonus : trames 1, 4 et 6

| n° | Trame | Flags | Format FC | Contact | FC (bpm) | Énergie (kJ) | RR (ms) | FC instantanée (bpm) |
|---|---|---|---|---|---|---|---|---|
| 1 | `00 48` | `0000 0000` | uint8 | non pris en charge | 48 → 4 × 16 + 8 = **72** | — | — | — |
| 4 | `0E 55 E8 03` | `0000 1110` | uint8 | détecté | 55 → 5 × 16 + 5 = **85** | `03 E8` → 3 × 256 + 232 = **1000** | — | — |
| 6 | `1E 4E C8 00 F0 02 10 03` | `0001 1110` | uint8 | détecté | 4E → 4 × 16 + 14 = **78** | `00 C8` → **200** | `02 F0` = 752 → **734** ; `03 10` = 784 → **766** | 81,7 ; 78,4 |

Toutes les valeurs concordent avec le décodeur du notebook (`OK` pour les 6 trames, « Tous les tests sont passés. »).
