/*
  Digi5 - Module 1 - TP "Du simulateur Python au firmware ESP32 (Wokwi)"
  Projet EHPAD - monitoring-ehpad

  Ce firmware REMPLACE le simulateur Python du projet Digi4 : meme hierarchie de
  topics, memes cles JSON, memes seuils d'alerte. Le dashboard n'a pas a changer.
  Voir docs/contrat_mqtt.md a la racine du depot.

  Materiel (Wokwi, puis vraie carte le 30/10) :
    ESP32 + MPU-6050 (I2C SDA=21 SCL=22) + bouton SOS + buzzer + potentiometre.
  Le potentiometre tient lieu de capteur de FC en attendant le MAX30102.

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
                   // 1 : cluster HiveMQ Cloud:8883 (TLS) - etape 10

const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const int   WIFI_CHANNEL  = 6;  // 6 accelere Wokwi ; mettre 0 sur la vraie carte

// LA SEULE LIGNE A CHANGER SI L'INTERVENANT IMPOSE UN NOM D'EQUIPE :
const char* TEAM_ID = "equipe-ehpad";

// Identifiants FICTIFS, alignes sur simulator/profiles.json du projet Digi4.
// RESIDENT_ID doit matcher ^R\d{3}$ : le backend rejette tout le reste.
const char* RESIDENT_ID = "R001";
const char* ROOM_ID     = "101";
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

// ======================= 2. BROCHAGE (identique sur la vraie carte) =======================
const int PIN_SOS    = 18;  // bouton vers GND, pull-up interne
const int PIN_BUZZER = 19;
const int PIN_HR_POT = 34;  // ADC1 : l'ADC2 est inutilisable quand le Wi-Fi est actif
const int PIN_SDA    = 21;
const int PIN_SCL    = 22;
const uint8_t MPU_ADDR = 0x68;

// ======================= 3. PARAMETRES =======================
const unsigned long PUBLISH_PERIOD_MS = 2000;  // 1 message / 2 s
const unsigned long IMU_PERIOD_MS     = 20;    // lecture IMU a 50 Hz
const unsigned long ALARM_DURATION_MS = 3000;
const float G_TO_MS2 = 9.80665;  // le projet Digi4 publie des m/s2, pas des g

// Seuil de chute : 2,5 g, exprime en m/s2 pour rester dans l'unite du projet.
const float FALL_THRESHOLD_MS2 = 2.5 * G_TO_MS2;

// Seuils de FC : repris A L'IDENTIQUE de backend/app/alerts/rules.py, pour que
// l'alerte du device et celle du backend ne puissent pas se contredire.
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

String topicVitals, topicMotion, topicAlerts, topicStatus, clientId;
bool imuOk = false;
float ax = 0, ay = 0, az = 0;   // derniere acceleration, en g
float peakMs2 = 0;              // pic de norme sur la fenetre, en m/s2
unsigned long lastPublish = 0, lastImu = 0, lastMqttAttempt = 0, alarmUntil = 0;
unsigned long lastFallAlert = 0, fallUntil = 0;
unsigned long seqVitals = 0, seqMotion = 0;
int lastButton = HIGH;
unsigned long lastButtonChange = 0;
int lastHrLevel = LEVEL_NONE;

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
// Le projet Digi4 horodate en ISO 8601 UTC avec les millisecondes et un Z final
// (simulator/app/resident.py). On reproduit exactement ce format.
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
  // constrain() est une macro : jamais d'appel de fonction a l'interieur
  return constrain(bpm, 30, 180);
}

// Reproduit la cascade de backend/app/alerts/rules.py, FC seule.
// L5 et L3 exigent la SpO2, que ce device ne mesure pas : inatteignables ici.
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

// Activite deduite de l'agitation. Le backend ne teste que la valeur "fall"
// (rules.py:31) : c'est donc celle-la qu'il faut emettre pour declencher la L4.
const char* currentActivity() {
  if (millis() < fallUntil) return "fall";
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

  // Le backend parse "timestamp" en datetime : sans heure NTP, isoTimestamp()
  // rend une chaine vide et le message est rejete. On attend la synchro, 10 s au
  // plus pour ne pas bloquer la demo si le NTP est injoignable.
  Serial.print("NTP : synchronisation");
  unsigned long deadline = millis() + 10000;
  while (time(nullptr) < 1700000000 && millis() < deadline) {
    delay(200);
    Serial.print(".");
  }
  Serial.println(time(nullptr) < 1700000000 ? " echec (horodatage indisponible)" : " OK");
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
    char online[160];
    snprintf(online, sizeof(online),
             "{\"state\":\"online\",\"device_id\":\"%s\",\"resident_id\":\"%s\",\"timestamp\":\"%s\"}",
             DEVICE_ID, RESIDENT_ID, isoTimestamp().c_str());
    mqtt.publish(topicStatus.c_str(), online, true);  // message retenu
  } else {
    Serial.printf("echec, etat = %d\n", mqtt.state());
  }
  return ok;
}

// ======================= 8. PUBLICATIONS =======================
// Format exact de backend/app/models.py:Alert, pour que le dashboard affiche
// l'alerte du device comme n'importe quelle alerte du backend.
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
  Serial.printf("[ALERTE %s L%d] %s\n", ok ? "envoyee" : "NON ENVOYEE", level, payload);
  if (level >= LEVEL_URGENCE) startAlarm();
}

// Enveloppe de simulator/app/resident.py:tick().
// "values" porte uniquement ce que ce device MESURE : la FC. SpO2, pression et
// temperature sont absentes et non inventees (voir docs/contrat_mqtt.md s.4).
// "measured" les liste explicitement pour qu'absent ne se lise pas comme normal.
void publishVitals() {
  int bpm = readHeartRate();
  String ts = isoTimestamp();

  char payload[448];
  snprintf(payload, sizeof(payload),
           "{\"timestamp\":\"%s\",\"resident_id\":\"%s\","
           "\"values\":{\"hr\":%d},\"vitals\":{\"hr\":%d},"
           "\"scenario\":\"normal\",\"seq\":%lu,"
           "\"source\":\"esp32\",\"device_id\":\"%s\",\"measured\":[\"hr\"]}",
           ts.c_str(), RESIDENT_ID, bpm, bpm, seqVitals++, DEVICE_ID);
  bool ok = mqtt.publish(topicVitals.c_str(), payload);
  Serial.printf("[%s] %s\n", ok ? "PUB vitals" : "ERREUR PUB", payload);

  // Alerte seulement quand le niveau CHANGE : sinon on republierait la meme
  // alerte toutes les 2 s et le journal du dashboard serait illisible.
  int level = hrLevel(bpm);
  if (level != lastHrLevel && level != LEVEL_NONE) {
    char reason[64];
    hrReason(bpm, level, reason, sizeof(reason));
    publishAlert(level, reason);
  }
  lastHrLevel = level;
}

// Enveloppe de simulator/app/resident.py:tick_motion().
// Le MPU fournit les quatre champs exiges par MotionValues, en m/s2.
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

// ======================= 9. CAPTEURS LOCAUX =======================
void readImu() {
  if (!imuOk) return;
  mpuReadAccel();
  float normMs2 = sqrt(ax * ax + ay * ay + az * az) * G_TO_MS2;
  if (normMs2 > peakMs2) peakMs2 = normMs2;

  // Detection de chute NAIVE : pic de norme au-dessus du seuil, une alerte au
  // plus toutes les 10 s. Sera remplacee par du TinyML au module 4.
  if (normMs2 > FALL_THRESHOLD_MS2 && millis() - lastFallAlert > 10000) {
    lastFallAlert = millis();
    fallUntil = millis() + 5000;  // l'activite reste "fall" pendant 5 s
    publishAlert(LEVEL_URGENCE, "fall detected");
  }
}

void readSosButton() {
  int state = digitalRead(PIN_SOS);
  // Anti-rebond logiciel : on ignore les changements trop rapproches (< 50 ms)
  if (state != lastButton && millis() - lastButtonChange > 50) {
    lastButtonChange = millis();
    lastButton = state;
    if (state == LOW) {  // pull-up : LOW = bouton presse
      publishAlert(LEVEL_DANGER_VITAL, "appel SOS du resident");
    }
  }
}

// ======================= 10. SETUP / LOOP =======================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_SOS, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  analogReadResolution(12);

  Wire.begin(PIN_SDA, PIN_SCL);
  imuOk = mpuBegin();
  Serial.println(imuOk ? "MPU-6050 detecte (0x68)"
                       : "MPU-6050 introuvable : verifier SDA=21, SCL=22, VCC=3V3, GND");

  // Hierarchie Digi4, prefixee par l'equipe : broker.hivemq.com est public et
  // partage par toute la promo, un topic "ehpad/..." nu entrerait en collision.
  String base = String("digi5/") + TEAM_ID + "/ehpad";
  topicVitals = base + "/vitals/resident/" + RESIDENT_ID;
  topicMotion = base + "/motion/resident/" + RESIDENT_ID;
  topicAlerts = base + "/alerts/new";
  topicStatus = base + "/device/" + DEVICE_ID + "/status";
  clientId    = String("digi5-") + TEAM_ID + "-" + DEVICE_ID + "-"
              + String((uint32_t)esp_random(), HEX);

  Serial.println("Topics :");
  Serial.printf("  vitals : %s\n", topicVitals.c_str());
  Serial.printf("  motion : %s\n", topicMotion.c_str());
  Serial.printf("  alerts : %s\n", topicAlerts.c_str());
  Serial.printf("  status : %s\n", topicStatus.c_str());

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
  mqtt.loop();  // keep-alive + reception

  unsigned long now = millis();
  if (now - lastImu >= IMU_PERIOD_MS) { lastImu = now; readImu(); }
  readSosButton();
  if (now - lastPublish >= PUBLISH_PERIOD_MS && mqtt.connected()) {
    lastPublish = now;
    publishVitals();
    publishMotion();
  }
  if (alarmUntil && now > alarmUntil) { noTone(PIN_BUZZER); alarmUntil = 0; }
}
