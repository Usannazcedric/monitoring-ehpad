/*
  Digi5 - Projet 1 - Preuve de concept du cas A (chute) - produit "Veilleur"
  Projet EHPAD - monitoring-ehpad

  Copie du firmware du module 1 (firmware/m1_wokwi), avec les capteurs du projet :
    - interrupteur "bracelet porte"  : tient lieu de la detection de port (contact peau)
    - detecteur de presence (PIR)    : capteur de chambre
    - interrupteur de porte          : capteur d'ouverture de la porte de chambre
  et deux traitements embarques, repris des TP du module 2 :
    - chute = choc, PUIS immobilite, PUIS position allongee (TP M2-2) ;
    - une FC instable n'est pas envoyee (regle qualite du TP M2-1).

  Memes topics, memes cles JSON et memes seuils que le simulateur Python : le
  backend et le dashboard n'ont pas a changer. Voir docs/contrat_mqtt.md.

  DONNEES FICTIVES - usage pedagogique - aucune finalite diagnostique.
  broker.hivemq.com est public : n'y publier aucune donnee reelle.
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <time.h>
#include <sys/time.h>
#include <esp_random.h>
#include <PubSubClient.h>

// ======================= 1. CONFIGURATION A ADAPTER =======================
#define USE_TLS 0  // 0 : broker.hivemq.com:1883 (public, non chiffre)
                   // 1 : cluster HiveMQ Cloud:8883 (TLS) - Projet 2

const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const int   WIFI_CHANNEL  = 6;  // 6 accelere Wokwi ; mettre 0 sur la vraie carte

// LA SEULE LIGNE A CHANGER SI L'INTERVENANT IMPOSE UN NOM D'EQUIPE :
const char* TEAM_ID = "equipe-ehpad";

// Identifiants FICTIFS, identiques au module 1 : R021 est hors de la plage du
// simulateur Python (R001..R020) et declare dans backend/app/profiles.py.
const char* RESIDENT_ID = "R021";
const char* ROOM_ID     = "121";
const char* DEVICE_ID   = "esp32-01";

#if USE_TLS
const char*    MQTT_HOST = "VOTRE-CLUSTER.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT = 8883;
const char*    MQTT_USER = "UTILISATEUR_TP";   // placeholder : jamais de vrai secret dans Git
const char*    MQTT_PASS = "MOT_DE_PASSE_TP";
const char* ROOT_CA = R"PEM(
-----BEGIN CERTIFICATE-----
COLLER ICI LE CERTIFICAT RACINE (format PEM)
-----END CERTIFICATE-----
)PEM";
WiFiClientSecure netClient;
#else
const char*    MQTT_HOST = "broker.hivemq.com";
const uint16_t MQTT_PORT = 1883;
const char*    MQTT_USER = nullptr;
const char*    MQTT_PASS = nullptr;
WiFiClient netClient;
#endif

// ======================= 2. BROCHAGE =======================
const int PIN_SOS    = 18;  // bouton vers GND, pull-up interne
const int PIN_BUZZER = 19;
const int PIN_HR_POT = 34;  // ADC1 : l'ADC2 est inutilisable quand le Wi-Fi est actif
const int PIN_SDA    = 21;
const int PIN_SCL    = 22;
const int PIN_WORN   = 32;  // interrupteur vers GND : LOW = bracelet porte
const int PIN_DOOR   = 33;  // interrupteur vers GND : LOW = porte fermee
const int PIN_PIR    = 27;  // sortie du PIR : HIGH = mouvement dans la chambre
const uint8_t MPU_ADDR = 0x68;

// ======================= 3. PARAMETRES =======================
const unsigned long PUBLISH_PERIOD_MS = 2000;  // constantes et mouvement : 1 message / 2 s
const unsigned long ROOM_PERIOD_MS    = 5000;  // chambre : 0,2 Hz, comme le simulateur
const unsigned long IMU_PERIOD_MS     = 20;    // lecture IMU a 50 Hz
const unsigned long HR_SAMPLE_MS      = 200;   // 10 lectures de FC par fenetre de 2 s
const unsigned long ALARM_DURATION_MS = 3000;
const float G_TO_MS2 = 9.80665;  // le projet Digi4 publie des m/s2, pas des g

// Chute "choc + immobilite + orientation" (TP M2-2, section "pour aller plus loin").
// Pas de phase de chute libre : une personne agee ne tombe pas comme un telephone.
const float IMPACT_G            = 2.0;    // choc : norme > 2 g (TP M2-2)
const float NAIVE_G             = 2.5;    // regle naive du module 1, affichee pour comparaison
const unsigned long STILL_START_MS   = 1000;   // on ignore la 1re seconde apres le choc (rebond)
const unsigned long STILL_WINDOW_MS  = 3000;   // immobile = 3 s d'affilee...
const float STILL_STD_G         = 0.05;   // ...avec un ecart-type de la norme < 0,05 g (TP M2-2)
const unsigned long STILL_TIMEOUT_MS = 15000;  // pas d'immobilite 15 s apres le choc : pas de chute
const float LYING_ANGLE_DEG     = 50.0;   // orientation : pesanteur tournee de plus de 50 degres
const unsigned long FALL_ACTIVITY_MS = 5000;   // l'activite reste "fall" 5 s (2 messages au moins)

// Regle qualite de la FC (TP M2-1) : coefficient de variation des 10 lectures
// de la fenetre. Au-dessus de 0,15, la mesure n'est PAS envoyee.
const float HR_CV_MAX = 0.15;

// Bracelet retire : alerte technique apres ce delai. 30 s pour la demo ;
// dans le vrai produit, 30 min (analyse de risques M3-2, ligne 4).
const unsigned long NOT_WORN_ALERT_MS = 30000;

// Seuils de FC : repris A L'IDENTIQUE de backend/app/alerts/rules.py.
//   L4 URGENCE     : hr < 40 ou hr > 140
//   L2 ATTENTION   : hr > 100
//   L1 INFORMATION : 50 <= hr < 58
const int HR_CRITICAL_LOW  = 40;
const int HR_CRITICAL_HIGH = 140;
const int HR_ELEVATED      = 100;
const int HR_MILD_LOW_MIN  = 50;
const int HR_MILD_LOW_MAX  = 58;

// Niveaux du projet Digi4 (backend/app/models.py:AlertLevel)
const int LEVEL_NONE = 0, LEVEL_INFORMATION = 1, LEVEL_ATTENTION = 2;
const int LEVEL_URGENCE = 4, LEVEL_DANGER_VITAL = 5;

// ======================= 4. ETAT =======================
PubSubClient mqtt(netClient);

String topicVitals, topicMotion, topicAlerts, topicStatus, topicAmbient, topicDoor, clientId;
bool imuOk = false;
float ax = 0, ay = 0, az = 1;   // derniere acceleration, en g
float gx = 0, gy = 0, gz = 1;   // pesanteur estimee (moyenne glissante), en g
float peakMs2 = 0;              // pic de norme sur la fenetre de publication, en m/s2
unsigned long lastPublish = 0, lastRoomPublish = 0, lastImu = 0, lastHrSample = 0;
unsigned long lastMqttAttempt = 0, alarmUntil = 0, fallUntil = 0;
unsigned long seqVitals = 0, seqMotion = 0, seqRoom = 0;
int lastButton = HIGH;
unsigned long lastButtonChange = 0;
int lastHrLevel = LEVEL_NONE;

// Port du bracelet
bool worn = true;
unsigned long notWornSince = 0;
bool notWornAlertSent = false;

// Chambre
int pirState = 0, doorState = 0;
unsigned long lastDoorChange = 0;

// Fenetre de FC (regle qualite)
const int HR_N = 10;
int hrWin[HR_N];
int hrCount = 0;

// Historique de la pesanteur : 1 point / 100 ms sur 3 s, pour lire l'orientation
// AVANT le choc (2 s avant), comme le propose le TP M2-2.
const int GH_N = 30;
float ghx[GH_N], ghy[GH_N], ghz[GH_N];
int ghIdx = 0, ghCount = 0, imuTick = 0;

// Fenetre d'immobilite : 3 s de normes a 50 Hz.
const int STILL_N = STILL_WINDOW_MS / IMU_PERIOD_MS;
float normWin[STILL_N];
int nwIdx = 0, nwCount = 0;

enum FallState { FS_IDLE, FS_AFTER_IMPACT };
FallState fallState = FS_IDLE;
unsigned long impactAt = 0;
float impactPeakG = 0;
float preX = 0, preY = 0, preZ = 1;  // pesanteur 2 s avant le choc

// ======================= 5. MPU-6050 EN DIRECT (registres I2C) =======================
void mpuWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

bool mpuBegin() {
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) return false;  // personne ne repond a 0x68
  mpuWrite(0x6B, 0x00);  // PWR_MGMT_1 : sortir du mode veille
  mpuWrite(0x1C, 0x10);  // ACCEL_CONFIG : plage +/-8 g (4096 unites par g)
  return true;
}

void mpuReadAccel() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom((int)MPU_ADDR, 6);
  int16_t rx = (Wire.read() << 8) | Wire.read();
  int16_t ry = (Wire.read() << 8) | Wire.read();
  int16_t rz = (Wire.read() << 8) | Wire.read();
  ax = rx / 4096.0;
  ay = ry / 4096.0;
  az = rz / 4096.0;
}

// ======================= 6. OUTILS =======================
String isoTimestamp() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return "";  // heure NTP pas encore synchronisee
  struct tm t;
  time_t secs = tv.tv_sec;
  gmtime_r(&secs, &t);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &t);
  char out[40];
  snprintf(out, sizeof(out), "%s.%03ldZ", buf, (long)(tv.tv_usec / 1000));
  return String(out);
}

// Identifiant d'alerte : le backend utilise uuid4().hex, on produit 32 caracteres hex.
String makeAlertId() {
  char buf[33];
  for (int i = 0; i < 32; i += 8) snprintf(buf + i, 9, "%08x", (unsigned)esp_random());
  buf[32] = '\0';
  return String(buf);
}

int readHeartRate() {
  int raw = analogRead(PIN_HR_POT);       // 0..4095 (ADC 12 bits)
  int bpm = map(raw, 0, 4095, 30, 180);   // potentiometre -> 30..180 bpm
  bpm += (int)random(-2, 3);              // petit bruit de mesure
  return constrain(bpm, 30, 180);
}

// Reproduit la cascade de backend/app/alerts/rules.py, FC seule.
int hrLevel(int bpm) {
  if (bpm < HR_CRITICAL_LOW || bpm > HR_CRITICAL_HIGH) return LEVEL_URGENCE;
  if (bpm > HR_ELEVATED) return LEVEL_ATTENTION;
  if (bpm >= HR_MILD_LOW_MIN && bpm < HR_MILD_LOW_MAX) return LEVEL_INFORMATION;
  return LEVEL_NONE;
}

void hrReason(int bpm, int level, char* out, size_t n) {
  if (level == LEVEL_URGENCE)        snprintf(out, n, "hr critical (%d)", bpm);
  else if (level == LEVEL_ATTENTION) snprintf(out, n, "hr elevated (%d)", bpm);
  else                               snprintf(out, n, "rythme cardiaque legerement bas (%d)", bpm);
}

float angleDeg(float x1, float y1, float z1, float x2, float y2, float z2) {
  float n1 = sqrt(x1 * x1 + y1 * y1 + z1 * z1);
  float n2 = sqrt(x2 * x2 + y2 * y2 + z2 * z2);
  if (n1 < 0.1 || n2 < 0.1) return 0;
  float c = (x1 * x2 + y1 * y2 + z1 * z2) / (n1 * n2);
  c = constrain(c, -1.0f, 1.0f);
  return acos(c) * 180.0 / PI;
}

// Activite publiee. Le backend ne teste que "fall" (rules.py) ; le dashboard
// connait aussi "walking", "sitting" et "lying".
const char* currentActivity() {
  if (millis() < fallUntil) return "fall";
  if (angleDeg(0, 0, 1, gx, gy, gz) > LYING_ANGLE_DEG) return "lying";
  float agitation = fabs(peakMs2 - G_TO_MS2);
  if (agitation > 2.0) return "walking";
  return "sitting";
}

void startAlarm() {
  tone(PIN_BUZZER, 2000);
  alarmUntil = millis() + ALARM_DURATION_MS;
}

// ======================= 7. RESEAU =======================
void connectWifi() {
  Serial.printf("Wi-Fi : connexion a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.printf("\nWi-Fi OK, IP = %s\n", WiFi.localIP().toString().c_str());
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  // Sans heure NTP, isoTimestamp() rend une chaine vide et le backend rejette
  // le message. On attend la synchro, 10 s au plus.
  Serial.print("NTP : synchronisation");
  unsigned long deadline = millis() + 10000;
  while (time(nullptr) < 1700000000 && millis() < deadline) {
    delay(200);
    Serial.print(".");
  }
  Serial.println(time(nullptr) < 1700000000 ? " echec (horodatage indisponible)" : " OK");
}

void publishStatus() {
  char online[192];
  snprintf(online, sizeof(online),
           "{\"state\":\"online\",\"device_id\":\"%s\",\"resident_id\":\"%s\","
           "\"worn\":%s,\"timestamp\":\"%s\"}",
           DEVICE_ID, RESIDENT_ID, worn ? "true" : "false", isoTimestamp().c_str());
  mqtt.publish(topicStatus.c_str(), online, true);  // message retenu
}

bool connectMqtt() {
  Serial.printf("MQTT : connexion a %s:%u (client %s)... ", MQTT_HOST, MQTT_PORT, clientId.c_str());
  // Last Will : ce que le broker publiera a notre place si l'ESP32 disparait.
  char willMsg[128];
  snprintf(willMsg, sizeof(willMsg),
           "{\"state\":\"offline\",\"device_id\":\"%s\",\"resident_id\":\"%s\"}",
           DEVICE_ID, RESIDENT_ID);
  bool ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS,
                         topicStatus.c_str(), 1, true, willMsg);
  if (ok) {
    Serial.println("OK");
    publishStatus();
  } else {
    Serial.printf("echec, etat = %d\n", mqtt.state());
  }
  return ok;
}

// ======================= 8. PUBLICATIONS =======================
// Alerte LOCALE : buzzer et moniteur serie, rien sur MQTT. Le backend recoit
// deja les vitals et le motion et les evalue avec les memes seuils : republier
// ferait apparaitre chaque alerte deux fois dans le dashboard (voir module 1).
void localAlert(int level, const char* reason) {
  Serial.printf("[ALERTE locale L%d] %s\n", level, reason);
  if (level >= LEVEL_URGENCE) startAlarm();
}

// Alerte PUBLIEE, au format de backend/app/models.py:Alert. Reservee a ce que
// le backend ne peut pas deduire des mesures : l'appel SOS, et le bracelet
// retire (le backend voit seulement que les mesures s'arretent).
void publishAlert(int level, const char* reason) {
  String ts = isoTimestamp();
  String id = makeAlertId();
  char payload[448];
  snprintf(payload, sizeof(payload),
           "{\"id\":\"%s\",\"resident_id\":\"%s\",\"level\":%d,\"reason\":\"%s\","
           "\"status\":\"active\",\"created_at\":\"%s\",\"updated_at\":\"%s\","
           "\"last_seen\":\"%s\",\"acknowledged_by\":null,"
           "\"source\":\"esp32\",\"device_id\":\"%s\"}",
           id.c_str(), RESIDENT_ID, level, reason,
           ts.c_str(), ts.c_str(), ts.c_str(), DEVICE_ID);
  bool ok = mqtt.publish(topicAlerts.c_str(), payload, false);
  Serial.printf("[ALERTE %s L%d] %s\n", ok ? "publiee" : "NON PUBLIEE", level, payload);
  if (level >= LEVEL_URGENCE) startAlarm();
}

// Enveloppe de simulator/app/resident.py:tick(). "values" ne porte que ce que
// la carte MESURE : la FC. "measured" le dit explicitement.
//
// Regle qualite (TP M2-1) : la FC publiee est la moyenne des 10 lectures de la
// fenetre de 2 s. Si leur coefficient de variation depasse 0,15, la mesure
// n'est pas fiable (au poignet : un mouvement) et elle n'est PAS envoyee.
// Une valeur fausse coute plus cher qu'une valeur absente.
void publishVitals() {
  if (hrCount == 0) return;
  float sum = 0, sum2 = 0;
  for (int i = 0; i < hrCount; i++) { sum += hrWin[i]; sum2 += (float)hrWin[i] * hrWin[i]; }
  float mean = sum / hrCount;
  float var = sum2 / hrCount - mean * mean;
  float cv = (mean > 0 && var > 0) ? sqrt(var) / mean : 0;
  int n = hrCount;
  hrCount = 0;  // nouvelle fenetre

  if (cv > HR_CV_MAX) {
    Serial.printf("[REJET FC] %d lectures, moyenne %.0f bpm, CV = %.2f > %.2f : "
                  "mesure instable, NON envoyee\n", n, mean, cv, HR_CV_MAX);
    return;
  }

  int bpm = (int)(mean + 0.5);
  String ts = isoTimestamp();
  char payload[448];
  snprintf(payload, sizeof(payload),
           "{\"timestamp\":\"%s\",\"resident_id\":\"%s\","
           "\"values\":{\"hr\":%d},\"vitals\":{\"hr\":%d},"
           "\"scenario\":\"normal\",\"seq\":%lu,"
           "\"source\":\"esp32\",\"device_id\":\"%s\",\"measured\":[\"hr\"],"
           "\"hr_cv\":%.3f}",
           ts.c_str(), RESIDENT_ID, bpm, bpm, seqVitals++, DEVICE_ID, cv);
  bool ok = mqtt.publish(topicVitals.c_str(), payload);
  Serial.printf("[%s] %s\n", ok ? "PUB vitals" : "ERREUR PUB", payload);

  // Alerte seulement quand le niveau CHANGE, sinon le journal serait illisible.
  int level = hrLevel(bpm);
  if (level != lastHrLevel && level != LEVEL_NONE) {
    char reason[64];
    hrReason(bpm, level, reason, sizeof(reason));
    localAlert(level, reason);  // le backend publie la sienne depuis les vitals
  }
  lastHrLevel = level;
}

// Enveloppe de simulator/app/resident.py:tick_motion(), en m/s2.
void publishMotion() {
  String ts = isoTimestamp();
  char payload[384];
  snprintf(payload, sizeof(payload),
           "{\"timestamp\":\"%s\",\"resident_id\":\"%s\","
           "\"values\":{\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"activity\":\"%s\"},"
           "\"scenario\":\"normal\",\"seq\":%lu,"
           "\"source\":\"esp32\",\"device_id\":\"%s\",\"imu_ok\":%s}",
           ts.c_str(), RESIDENT_ID,
           ax * G_TO_MS2, ay * G_TO_MS2, az * G_TO_MS2, currentActivity(),
           seqMotion++, DEVICE_ID, imuOk ? "true" : "false");
  bool ok = mqtt.publish(topicMotion.c_str(), payload);
  if (!ok) Serial.println("ERREUR PUB motion");
  peakMs2 = 0;  // nouvelle fenetre
}

// Enveloppe de simulator/app/main.py:ambient_loop() : un message PIR et un
// message porte, au format {"values": {"type": ..., "value": 0|1}}.
void publishRoom() {
  String ts = isoTimestamp();
  char payload[320];
  snprintf(payload, sizeof(payload),
           "{\"timestamp\":\"%s\",\"room_id\":\"%s\",\"resident_id\":\"%s\","
           "\"values\":{\"type\":\"pir\",\"value\":%d},\"seq\":%lu,"
           "\"source\":\"esp32\",\"device_id\":\"%s\"}",
           ts.c_str(), ROOM_ID, RESIDENT_ID, pirState, seqRoom, DEVICE_ID);
  mqtt.publish(topicAmbient.c_str(), payload);
  snprintf(payload, sizeof(payload),
           "{\"timestamp\":\"%s\",\"room_id\":\"%s\",\"resident_id\":\"%s\","
           "\"values\":{\"type\":\"door\",\"value\":%d},\"seq\":%lu,"
           "\"source\":\"esp32\",\"device_id\":\"%s\"}",
           ts.c_str(), ROOM_ID, RESIDENT_ID, doorState, seqRoom, DEVICE_ID);
  mqtt.publish(topicDoor.c_str(), payload);
  seqRoom++;
}

// ======================= 9. CAPTEURS LOCAUX =======================
void resetFallDetector() {
  fallState = FS_IDLE;
  nwCount = 0;
  nwIdx = 0;
}

// Detection de chute en trois temps, a 50 Hz :
//   1. choc : norme > 2 g ;
//   2. immobilite : 3 s d'affilee avec un ecart-type de la norme < 0,05 g,
//      cherchees entre 1 s et 15 s apres le choc ;
//   3. orientation : la pesanteur a tourne de plus de 50 degres entre 2 s avant
//      le choc et l'immobilite (debout ou assis -> allonge au sol).
// Un choc seul (s'asseoir lourdement, bracelet cogne contre un meuble) ne suffit pas.
void updateFallDetector(float normG) {
  unsigned long now = millis();

  if (fallState == FS_IDLE) {
    if (normG > IMPACT_G) {
      fallState = FS_AFTER_IMPACT;
      impactAt = now;
      impactPeakG = normG;
      nwCount = 0;
      nwIdx = 0;
      // Pesanteur 2 s avant le choc : 20 points en arriere dans l'historique.
      int back = min(20, ghCount - 1);
      if (back < 0) back = 0;
      int i = (ghIdx - 1 - back + GH_N * 2) % GH_N;
      if (ghCount > 0) { preX = ghx[i]; preY = ghy[i]; preZ = ghz[i]; }
      else { preX = 0; preY = 0; preZ = 1; }
      Serial.printf("[CHUTE ?] choc de %.2f g : on attend l'immobilite et la position\n", normG);
    }
    return;
  }

  // FS_AFTER_IMPACT
  if (normG > impactPeakG) impactPeakG = normG;
  if (now - impactAt < STILL_START_MS) return;  // rebond, on ignore

  normWin[nwIdx] = normG;
  nwIdx = (nwIdx + 1) % STILL_N;
  if (nwCount < STILL_N) nwCount++;

  if (nwCount == STILL_N) {
    float s = 0, s2 = 0;
    for (int i = 0; i < STILL_N; i++) { s += normWin[i]; s2 += normWin[i] * normWin[i]; }
    float mean = s / STILL_N;
    float var = s2 / STILL_N - mean * mean;
    float sd = var > 0 ? sqrt(var) : 0;
    if (sd < STILL_STD_G) {
      float ang = angleDeg(preX, preY, preZ, gx, gy, gz);
      bool naive = impactPeakG > NAIVE_G;
      if (ang > LYING_ANGLE_DEG) {
        char reason[96];
        snprintf(reason, sizeof(reason),
                 "fall detected (choc %.1f g, immobile 3 s, rotation %.0f deg)", impactPeakG, ang);
        fallUntil = now + FALL_ACTIVITY_MS;
        localAlert(LEVEL_URGENCE, reason);  // le backend la deduit de activity="fall"
        if (mqtt.connected() && worn) publishMotion();  // sans attendre le prochain cycle
      } else {
        Serial.printf("[CHUTE ECARTEE] choc %.1f g puis immobile, mais rotation %.0f deg "
                      "< %.0f : assis lourdement ? Pas d'alerte. (regle naive du module 1 : %s)\n",
                      impactPeakG, ang, LYING_ANGLE_DEG, naive ? "AURAIT ALERTE" : "pas d'alerte");
      }
      resetFallDetector();
      return;
    }
  }

  if (now - impactAt > STILL_TIMEOUT_MS) {
    Serial.printf("[CHUTE ECARTEE] choc %.1f g suivi de mouvement pendant 15 s : "
                  "la personne s'est relevee ou marche. Pas d'alerte.\n", impactPeakG);
    resetFallDetector();
  }
}

void readImu() {
  if (!imuOk) return;
  mpuReadAccel();
  float normG = sqrt(ax * ax + ay * ay + az * az);
  float normMs2 = normG * G_TO_MS2;
  if (normMs2 > peakMs2) peakMs2 = normMs2;

  // Pesanteur estimee : moyenne glissante (constante de temps ~0,2 s a 50 Hz).
  const float a = 0.1;
  gx += a * (ax - gx);
  gy += a * (ay - gy);
  gz += a * (az - gz);
  if (++imuTick >= 5) {  // 1 point toutes les 100 ms
    imuTick = 0;
    ghx[ghIdx] = gx; ghy[ghIdx] = gy; ghz[ghIdx] = gz;
    ghIdx = (ghIdx + 1) % GH_N;
    if (ghCount < GH_N) ghCount++;
  }

  // Bracelet retire : l'accelerometre ne dit plus rien du resident.
  if (!worn) return;
  updateFallDetector(normG);
}

void sampleHeartRate() {
  if (!worn) return;
  if (hrCount < HR_N) hrWin[hrCount++] = readHeartRate();
}

void readSosButton() {
  int state = digitalRead(PIN_SOS);
  if (state != lastButton && millis() - lastButtonChange > 50) {  // anti-rebond
    lastButtonChange = millis();
    lastButton = state;
    if (state == LOW) {  // pull-up : LOW = bouton presse
      publishAlert(LEVEL_DANGER_VITAL, "appel SOS du resident");
    }
  }
}

// Port du bracelet. Retire : plus aucune mesure n'est envoyee (ni FC, ni
// mouvement), la detection de chute est suspendue, et une alerte technique part
// si cela dure. Un silence ne doit jamais se lire comme "tout va bien".
void readWorn() {
  bool now = digitalRead(PIN_WORN) == LOW;
  if (now == worn) {
    if (!worn && !notWornAlertSent && millis() - notWornSince > NOT_WORN_ALERT_MS
        && mqtt.connected()) {
      notWornAlertSent = true;
      char reason[80];
      snprintf(reason, sizeof(reason), "bracelet non porte depuis %lu s : mesures suspendues",
               NOT_WORN_ALERT_MS / 1000);
      publishAlert(LEVEL_ATTENTION, reason);
    }
    return;
  }
  worn = now;
  if (!worn) {
    notWornSince = millis();
    notWornAlertSent = false;
    hrCount = 0;
    resetFallDetector();
    Serial.println("[PORT] bracelet RETIRE : aucune mesure n'est plus envoyee");
  } else {
    Serial.println("[PORT] bracelet remis : reprise des mesures");
  }
  if (mqtt.connected()) publishStatus();
}

void readRoom() {
  int pir = digitalRead(PIN_PIR) == HIGH ? 1 : 0;
  int door = digitalRead(PIN_DOOR) == HIGH ? 1 : 0;
  bool changed = false;
  if (pir != pirState) {
    pirState = pir;
    changed = true;
    Serial.printf("[CHAMBRE %s] presence : %s\n", ROOM_ID, pir ? "mouvement" : "calme");
  }
  if (door != doorState && millis() - lastDoorChange > 50) {
    lastDoorChange = millis();
    doorState = door;
    changed = true;
    Serial.printf("[CHAMBRE %s] porte %s\n", ROOM_ID, door ? "OUVERTE" : "fermee");
  }
  if (changed && mqtt.connected()) {
    lastRoomPublish = millis();
    publishRoom();
  }
}

// ======================= 10. SETUP / LOOP =======================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_SOS, INPUT_PULLUP);
  pinMode(PIN_WORN, INPUT_PULLUP);
  pinMode(PIN_DOOR, INPUT_PULLUP);
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  analogReadResolution(12);

  Wire.begin(PIN_SDA, PIN_SCL);
  imuOk = mpuBegin();
  Serial.println(imuOk ? "MPU-6050 detecte (0x68)"
                       : "MPU-6050 introuvable : verifier SDA=21, SCL=22, VCC=3V3, GND");

  worn = digitalRead(PIN_WORN) == LOW;
  doorState = digitalRead(PIN_DOOR) == HIGH ? 1 : 0;
  pirState = digitalRead(PIN_PIR) == HIGH ? 1 : 0;
  Serial.printf("Bracelet : %s | porte : %s\n", worn ? "porte" : "RETIRE",
                doorState ? "ouverte" : "fermee");

  // Hierarchie Digi4, prefixee par l'equipe : broker.hivemq.com est public.
  String base = String("digi5/") + TEAM_ID + "/ehpad";
  topicVitals  = base + "/vitals/resident/" + RESIDENT_ID;
  topicMotion  = base + "/motion/resident/" + RESIDENT_ID;
  topicAmbient = base + "/ambient/room/" + ROOM_ID;
  topicDoor    = base + "/door/room/" + ROOM_ID;
  topicAlerts  = base + "/alerts/new";
  topicStatus  = base + "/device/" + DEVICE_ID + "/status";
  clientId     = String("digi5-") + TEAM_ID + "-" + DEVICE_ID + "-"
               + String((uint32_t)esp_random(), HEX);

  Serial.println("Topics :");
  Serial.printf("  vitals  : %s\n", topicVitals.c_str());
  Serial.printf("  motion  : %s\n", topicMotion.c_str());
  Serial.printf("  ambient : %s\n", topicAmbient.c_str());
  Serial.printf("  door    : %s\n", topicDoor.c_str());
  Serial.printf("  alerts  : %s\n", topicAlerts.c_str());
  Serial.printf("  status  : %s\n", topicStatus.c_str());

  connectWifi();
#if USE_TLS
  netClient.setCACert(ROOT_CA);
#endif
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);  // defaut PubSubClient = 256 octets : trop juste
  mqtt.setKeepAlive(30);
}

void loop() {
  // Reconnexion MQTT non bloquante : une tentative toutes les 5 s. Aucun delay()
  // dans loop(), sinon le bouton SOS serait ignore pendant toute la pause.
  if (!mqtt.connected() && millis() - lastMqttAttempt > 5000) {
    lastMqttAttempt = millis();
    connectMqtt();
  }
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastImu >= IMU_PERIOD_MS) { lastImu = now; readImu(); }
  if (now - lastHrSample >= HR_SAMPLE_MS) { lastHrSample = now; sampleHeartRate(); }
  readSosButton();
  readWorn();
  readRoom();

  if (now - lastPublish >= PUBLISH_PERIOD_MS && mqtt.connected()) {
    lastPublish = now;
    if (worn) {
      publishVitals();
      publishMotion();
    }
  }
  if (now - lastRoomPublish >= ROOM_PERIOD_MS && mqtt.connected()) {
    lastRoomPublish = now;
    publishRoom();
  }
  if (alarmUntil && now > alarmUntil) { noTone(PIN_BUZZER); alarmUntil = 0; }
}
