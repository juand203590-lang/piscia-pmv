// Simula 3 nodos de campo publicando mediciones cada 5 s (un "minuto" acelerado),
// con la caída de oxígeno típica de la madrugada. Útil para demostrar el PMV sin sensores.
const mqtt = require('../backend/node_modules/mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const unidades = [
  { id: 'jaula-3', base: 5.4, caida: 2.6 },
  { id: 'jaula-5', base: 5.6, caida: 1.6 },
  { id: 'estanque-1', base: 6.6, caida: 0.8 },
];

const cliente = mqtt.connect(MQTT_URL);
let hora = 0; // hora simulada del día

function medir(u, h) {
  const madrugada = Math.exp(-Math.pow((h - 4.5) / 2.6, 2));
  const od = u.base + 1.6 * Math.sin(((h - 9) / 24) * 2 * Math.PI) - u.caida * madrugada + (Math.random() - 0.5) * 0.2;
  const t = 28 + 1.5 * Math.sin(((h - 15) / 24) * 2 * Math.PI) + (Math.random() - 0.5) * 0.2;
  const ph = 7.3 + (Math.random() - 0.5) * 0.2;
  return { od: +od.toFixed(2), t: +t.toFixed(1), ph: +ph.toFixed(2), ts: Date.now() };
}

cliente.on('connect', () => {
  console.log('Simulador conectado. Publicando en piscia/<unidad>/mediciones');
  setInterval(() => {
    hora = (hora + 0.25) % 24;
    for (const u of unidades) {
      const m = medir(u, hora);
      cliente.publish(`piscia/${u.id}/mediciones`, JSON.stringify(m));
      console.log(`${hora.toFixed(2).padStart(5)}h ${u.id}: OD ${m.od} mg/L, ${m.t} °C, pH ${m.ph}`);
    }
  }, 5000);
});
