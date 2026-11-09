/*
  PiscIA - Nodo de campo (ESP32)
  Lee temperatura (DS18B20), oxígeno disuelto (sensor analógico galvánico) y pH (sensor analógico),
  publica por MQTT cada INTERVALO_MS y guarda las lecturas en memoria si no hay conexión,
  para enviarlas cuando vuelva la señal (requisito RF2 del plan de negocios).

  Librerías: PubSubClient, OneWire, DallasTemperature, ArduinoJson.
  La calibración de oxígeno y pH es de referencia: ajústela con soluciones patrón.
*/
#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

const char* WIFI_SSID   = "RED_GRANJA";
const char* WIFI_PASS   = "CLAVE";
const char* MQTT_HOST   = "broker.piscia.local";
const int   MQTT_PORT   = 1883;
const char* UNIDAD_ID   = "jaula-3";
const unsigned long INTERVALO_MS = 60000;   // 1 lectura por minuto

const int PIN_TEMP = 4;
const int PIN_OD   = 34;
const int PIN_PH   = 35;

// Calibración (valores de ejemplo)
const float OD_MV_SATURACION = 1600.0;  // mV con el sensor en aire saturado a la temperatura de calibración
const float OD_SAT_MGL       = 8.0;     // mg/L de saturación a esa temperatura
const float PH_PENDIENTE     = -5.70;   // pH por voltio
const float PH_OFFSET        = 21.34;

OneWire oneWire(PIN_TEMP);
DallasTemperature sensorTemp(&oneWire);
WiFiClient red;
PubSubClient mqtt(red);

// Búfer circular para guardar lecturas sin conexión
struct Lectura { unsigned long ts; float od, t, ph; };
const int MAX_BUFFER = 720;  // 12 horas a 1 lectura/minuto
Lectura buffer[MAX_BUFFER];
int inicio = 0, cantidad = 0;

float leerMilivoltios(int pin) {
  long suma = 0;
  for (int i = 0; i < 20; i++) { suma += analogReadMilliVolts(pin); delay(5); }
  return suma / 20.0;
}

Lectura leer() {
  sensorTemp.requestTemperatures();
  float t  = sensorTemp.getTempCByIndex(0);
  float od = leerMilivoltios(PIN_OD) * OD_SAT_MGL / OD_MV_SATURACION;
  float ph = PH_PENDIENTE * (leerMilivoltios(PIN_PH) / 1000.0) + PH_OFFSET;
  return { millis(), od, t, ph };
}

void guardar(const Lectura& l) {
  int pos = (inicio + cantidad) % MAX_BUFFER;
  buffer[pos] = l;
  if (cantidad < MAX_BUFFER) cantidad++; else inicio = (inicio + 1) % MAX_BUFFER;
}

bool publicar(const Lectura& l) {
  StaticJsonDocument<128> doc;
  doc["od"] = l.od; doc["t"] = l.t; doc["ph"] = l.ph; doc["uptime"] = l.ts;
  char json[128];
  serializeJson(doc, json);
  String topic = String("piscia/") + UNIDAD_ID + "/mediciones";
  return mqtt.publish(topic.c_str(), json);
}

void reconectar() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.begin(WIFI_SSID, WIFI_PASS); delay(3000); }
  if (WiFi.status() == WL_CONNECTED && !mqtt.connected()) mqtt.connect(UNIDAD_ID);
}

void setup() {
  Serial.begin(115200);
  sensorTemp.begin();
  WiFi.mode(WIFI_STA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  reconectar();
}

unsigned long ultima = 0;
void loop() {
  if (millis() - ultima >= INTERVALO_MS) {
    ultima = millis();
    guardar(leer());
    reconectar();
    // Envía primero lo pendiente, en orden
    while (cantidad > 0 && mqtt.connected()) {
      if (!publicar(buffer[inicio])) break;
      inicio = (inicio + 1) % MAX_BUFFER; cantidad--;
    }
    Serial.printf("Pendientes en búfer: %d\n", cantidad);
  }
  mqtt.loop();
}
