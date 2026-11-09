// Canales de mensajería. Sin credenciales, imprime en consola (modo demostración).
// Con credenciales, usa la API de WhatsApp Cloud (Meta) y un proveedor de SMS.

const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

async function whatsapp(destino, texto) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.log(`[WhatsApp demo] → ${destino}: ${texto}`);
    return;
  }
  const r = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: destino, type: 'text', text: { body: texto } }),
  });
  if (!r.ok) throw new Error(`WhatsApp respondió ${r.status}`);
}

async function sms(destino, texto) {
  // Integrar aquí el proveedor de SMS elegido (por cotizar).
  console.log(`[SMS demo] → ${destino}: ${texto}`);
}

module.exports = { whatsapp, sms };
