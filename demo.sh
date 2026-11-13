#!/usr/bin/env bash
# Démo du Projet 1 (cas A, chute) en une commande :
#   ./demo.sh        lance la stack, puis ouvre le tableau de bord et la carte Wokwi
#   ./demo.sh stop   arrête la stack
#
# Il reste un seul geste à la main : cliquer sur ▶ dans Wokwi, qui ne démarre pas
# la simulation tout seul, et garder son onglet visible (masqué, il ralentit).
set -euo pipefail
cd "$(dirname "$0")"

# Projet Wokwi du Projet 1 (firmware/p1_wokwi), sauvegardé sur le compte de l'équipe.
WOKWI_URL="${WOKWI_URL:-https://wokwi.com/projects/480574192585000961}"

# Sans Ollama : son image pèse 2,7 Go et il ne sert qu'aux résumés quotidiens.
SERVICES="mosquitto redis influxdb simulator backend ws-gateway frontend"

if [ "${1:-}" = "stop" ]; then
  docker compose down
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Démarrage de Docker..."
  open -a OrbStack 2>/dev/null || open -a Docker
  until docker info >/dev/null 2>&1; do sleep 2; done
fi

docker compose up -d $SERVICES

printf "Attente du tableau de bord"
until curl -sf http://localhost:8000/health >/dev/null && curl -sf http://localhost:3000 >/dev/null; do
  printf "."
  sleep 2
done
echo " OK"

open http://localhost:3000
if [[ "$WOKWI_URL" == *A_REMPLIR* ]]; then
  echo "Lien Wokwi pas encore renseigné : voir firmware/p1_wokwi/README.md pour charger la carte à la main."
  open https://wokwi.com/projects/new/esp32
else
  open "$WOKWI_URL"
fi

echo
echo "Dans Wokwi : cliquer sur ▶ et garder l'onglet visible."
echo "Tableau de bord : http://localhost:3000, résident R021 (chambre 121) = la carte."
echo "Arrêt : ./demo.sh stop"
