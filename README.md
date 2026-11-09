# PiscIA · Producto Mínimo Viable

Monitoreo inteligente de la calidad del agua en cultivos de tilapia del Huila.
Proyecto académico del Grupo 5 · Emprendimiento · Ingeniería de Software, FET (Neiva), 2026-II.

PiscIA mide oxígeno disuelto, temperatura y pH en cada jaula o estanque y avisa por WhatsApp (con SMS de respaldo) cuando un valor cruza el umbral que define el productor. Este repositorio contiene el PMV descrito en la sección 5 del plan de negocios.

## Estructura

| Carpeta | Contenido |
|---|---|
| `firmware/piscia_nodo/` | Código del nodo de campo (ESP32): lee los sensores, publica por MQTT y guarda lecturas si no hay señal. |
| `backend/` | API en Node.js: recibe las mediciones, evalúa umbrales y envía alertas con reintentos y SMS de respaldo. |
| `simulador/` | Publica mediciones de 3 unidades con la caída de oxígeno de la madrugada, para demostrar el PMV sin sensores. |
| `prototipo/` | Prototipo navegable del tablero (HTML con datos de ejemplo). |
| `infra/` y `docker-compose.yml` | Broker MQTT (Mosquitto) para correr todo en local. |

## Arquitectura

```
[ESP32 + sensores] --MQTT--> [Broker Mosquitto] --> [Backend Node.js] --> [WhatsApp / SMS]
                                                         |
                                                         +--> API REST --> [Tablero web]
```

## Cómo correrlo

Requisitos: Node.js 18 o superior y Docker (para el broker MQTT).

```bash
docker compose up -d          # broker MQTT en el puerto 1883
cd backend
npm install
npm test                      # pruebas de la lógica de alertas
npm start                     # API en http://localhost:3000
npm run simular               # en otra terminal: envía mediciones simuladas
```

Endpoints: `GET /api/unidades`, `GET /api/mediciones/:unidad`, `GET /api/alertas`, `GET/PUT /api/umbrales`.

Sin credenciales, las alertas se imprimen en consola. Para WhatsApp real, defina `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `ALERTA_DESTINOS` (números separados por comas).

## Funcionalidades del PMV (MoSCoW)

- **Debe tener:** lectura de temperatura y oxígeno, envío por MQTT, almacenamiento local en el nodo, alerta por umbral, tablero con gráfica de 24 h.
- **Debería tener:** pH, umbrales configurables, historial de alertas.
- **No tendrá por ahora:** control automático de aireadores, analítica predictiva.

## Equipo

- Juan Diego González Marín · Líder técnico
- Santiago Cardoso Padilla · Desarrollo y calidad
- Jhojan Steven Saavedra Chantris · Responsable comercial
- Andrés Felipe Torres Barreiro · Producto y finanzas
