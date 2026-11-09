// Lógica de alertas de PiscIA (sin dependencias, fácil de probar).

const UMBRALES_POR_DEFECTO = {
  odMin: 3.5,   // mg/L de oxígeno disuelto (lo define el productor con su asesor)
  tMin: 24,     // °C
  tMax: 32,     // °C
  phMin: 6.5,
  phMax: 8.5,
};

/**
 * Evalúa una medición contra los umbrales.
 * @param {{od:number,t:number,ph:number}} m medición
 * @param {object} u umbrales
 * @returns {{nivel:'ok'|'atencion'|'critico', motivos:string[]}}
 */
function evaluar(m, u = UMBRALES_POR_DEFECTO) {
  const motivos = [];
  let nivel = 'ok';
  const subir = (n) => { if (n === 'critico' || nivel === 'ok') nivel = n; };

  if (m.od < u.odMin) { motivos.push(`Oxígeno disuelto ${m.od} mg/L (mínimo ${u.odMin})`); subir('critico'); }
  else if (m.od < u.odMin + 1) { motivos.push(`Oxígeno disuelto ${m.od} mg/L, cerca del mínimo`); subir('atencion'); }

  if (m.t < u.tMin || m.t > u.tMax) { motivos.push(`Temperatura ${m.t} °C fuera de ${u.tMin}–${u.tMax}`); subir('critico'); }
  if (m.ph < u.phMin || m.ph > u.phMax) { motivos.push(`pH ${m.ph} fuera de ${u.phMin}–${u.phMax}`); subir('atencion'); }

  return { nivel, motivos };
}

/**
 * Evita alertas repetidas: solo avisa si el nivel empeora o si pasó el tiempo de espera.
 * Reduce las alertas falsas o duplicadas (meta del PMV: ≤ 15 %).
 */
function debeNotificar(nivelNuevo, ultimo, ahoraMs, esperaMs = 30 * 60 * 1000) {
  if (nivelNuevo === 'ok') return false;
  if (!ultimo) return true;
  const peso = { ok: 0, atencion: 1, critico: 2 };
  if (peso[nivelNuevo] > peso[ultimo.nivel]) return true;
  return ahoraMs - ultimo.enviadoMs >= esperaMs;
}

/**
 * Envía por WhatsApp con reintentos y usa SMS como respaldo
 * (ajuste tipo Plan B de la sección 5.4 del plan de negocios).
 */
async function enviarConRespaldo(mensaje, destinos, canales, { reintentos = 2 } = {}) {
  const resultado = [];
  for (const destino of destinos) {
    let entregado = false;
    for (let i = 0; i <= reintentos && !entregado; i++) {
      try { await canales.whatsapp(destino, mensaje); entregado = true; resultado.push({ destino, canal: 'whatsapp', intento: i + 1 }); }
      catch (_) { /* reintentar */ }
    }
    if (!entregado) {
      try { await canales.sms(destino, mensaje); resultado.push({ destino, canal: 'sms', intento: reintentos + 2 }); }
      catch (e) { resultado.push({ destino, canal: 'ninguno', error: String(e.message || e) }); }
    }
  }
  return resultado;
}

function redactar(unidad, ev) {
  return `PiscIA: ${unidad} en estado ${ev.nivel.toUpperCase()}. ${ev.motivos.join('; ')}. Revise la aireación. Responda OK para confirmar.`;
}

module.exports = { UMBRALES_POR_DEFECTO, evaluar, debeNotificar, enviarConRespaldo, redactar };
