#!/usr/bin/env bash
# Compile sketch.ino pour l'ESP32 et depose le binaire la ou wokwi.toml l'attend.
#
# arduino-cli impose que le fichier principal porte le nom de son dossier.
# Le notre s'appelle sketch.ino parce que wokwi.com l'exige : on recopie donc
# le sketch dans un dossier temporaire .build/sketch/ avant de compiler.
set -euo pipefail

cd "$(dirname "$0")"

FQBN="esp32:esp32:esp32"

rm -rf .build
mkdir -p .build/sketch
cp sketch.ino .build/sketch/sketch.ino

echo "Compilation ($FQBN)..."
arduino-cli compile \
  --fqbn "$FQBN" \
  --output-dir build \
  .build/sketch

echo
echo "OK. Binaire : build/sketch.ino.bin"
echo "Lancer la simulation : VS Code -> Cmd+Shift+P -> \"Wokwi: Start Simulator\""
