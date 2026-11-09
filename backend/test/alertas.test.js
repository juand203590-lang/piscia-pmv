const test = require('node:test');
const assert = require('node:assert');
const { evaluar, debeNotificar, enviarConRespaldo } = require('../src/alertas');

test('oxígeno bajo el umbral es crítico', () => {
  const r = evaluar({ od: 2.9, t: 29, ph: 7.5 });
  assert.equal(r.nivel, 'critico');
  assert.match(r.motivos[0], /Oxígeno/);
});

test('oxígeno cerca del umbral es atención', () => {
  assert.equal(evaluar({ od: 4.1, t: 28, ph: 7.4 }).nivel, 'atencion');
});

test('valores normales no generan alerta', () => {
  assert.equal(evaluar({ od: 6.2, t: 27.9, ph: 7.2 }).nivel, 'ok');
});

test('no repite la misma alerta antes del tiempo de espera', () => {
  const ultimo = { nivel: 'critico', enviadoMs: 0 };
  assert.equal(debeNotificar('critico', ultimo, 10 * 60 * 1000), false);
  assert.equal(debeNotificar('critico', ultimo, 31 * 60 * 1000), true);
});

test('avisa de inmediato si el nivel empeora', () => {
  assert.equal(debeNotificar('critico', { nivel: 'atencion', enviadoMs: 0 }, 1000), true);
});

test('si WhatsApp falla, usa SMS de respaldo', async () => {
  const canales = {
    whatsapp: async () => { throw new Error('caído'); },
    sms: async () => {},
  };
  const r = await enviarConRespaldo('prueba', ['573000000000'], canales, { reintentos: 1 });
  assert.equal(r[0].canal, 'sms');
});
