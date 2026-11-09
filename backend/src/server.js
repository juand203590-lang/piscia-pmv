// Servidor del PMV: recibe mediciones por MQTT, evalúa umbrales, envía alertas y expone una API para el tablero.
const express = require('express');
const mqtt = require('mqtt');
const path = require('path');
const { UMBRALES_POR_DEFECTO, evaluar, debeNotificar, enviarConRespaldo, redactar } = require('./alertas');
const canales = require('./notificador');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const PORT = process.env.PORT || 3000;
const DESTINOS = (process.env.ALERTA_DESTINOS || '573105550142').split(',');

// Almacenamiento en memoria para el PMV (en producción: PostgreSQL + base de series de tiempo).
const mediciones = {};   // unidad -> [{ts, od, t, ph}]
const alertas = [];
const ultimaAlerta = {}; // unidad -> {nivel, enviadoMs}
let umbrales = { ...UMBRALES_POR_DEFECTO };

const cliente = mqtt.connect(MQTT_URL);
cliente.on('connect', () => {
  console.log(`Conectado a ${MQTT_URL}`);
  cliente.subscribe('piscia/+/mediciones');
});

cliente.on('message', async (topic, payload) => {
  const unidad = topic.split('/')[1];
  let m;
  try { m = JSON.parse(payload.toString()); } catch { return; }
  const ts = m.ts || Date.now();
  (mediciones[unidad] ||= []).push({ ts, od: m.od, t: m.t, ph: m.ph });
  if (mediciones[unidad].length > 2000) mediciones[unidad].shift();

  const ev = evaluar(m, umbrales);
  if (debeNotificar(ev.nivel, ultimaAlerta[unidad], Date.now())) {
    const texto = redactar(unidad, ev);
    const entrega = await enviarConRespaldo(texto, DESTINOS, canales);
    ultimaAlerta[unidad] = { nivel: ev.nivel, enviadoMs: Date.now() };
    alertas.unshift({ ts, unidad, nivel: ev.nivel, motivos: ev.motivos, entrega });
  }
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'prototipo')));

app.get('/api/unidades', (_req, res) => {
  res.json(Object.entries(mediciones).map(([unidad, serie]) => {
    const ultima = serie[serie.length - 1];
    return { unidad, ultima, estado: evaluar(ultima, umbrales).nivel };
  }));
});
app.get('/api/mediciones/:unidad', (req, res) => {
  const desde = Date.now() - 24 * 3600 * 1000;
  res.json((mediciones[req.params.unidad] || []).filter((x) => x.ts >= desde));
});
app.get('/api/alertas', (_req, res) => res.json(alertas.slice(0, 100)));
app.get('/api/umbrales', (_req, res) => res.json(umbrales));
app.put('/api/umbrales', (req, res) => {
  const n = {};
  for (const k of Object.keys(UMBRALES_POR_DEFECTO)) {
    const v = Number(req.body[k]);
    if (!Number.isFinite(v)) return res.status(400).json({ error: `Valor inválido para ${k}` });
    n[k] = v;
  }
  if (n.tMin >= n.tMax || n.phMin >= n.phMax) return res.status(400).json({ error: 'El mínimo debe ser menor que el máximo' });
  umbrales = n;
  res.json(umbrales);
});

app.listen(PORT, () => console.log(`API de PiscIA en http://localhost:${PORT}`));
