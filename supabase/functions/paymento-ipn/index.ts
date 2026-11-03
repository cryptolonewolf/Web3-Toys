// paymento-ipn: Paymento's payment notices (IPN). Checks the signature
// (HMAC-SHA256 of the raw body with PAYMENTO_IPN_SECRET, header
// X-HMAC-SHA256-Signature), then confirms with Paymento's verify API before
// marking an order paid, as Paymento recommends. Paymento retries until we
// answer 2xx, so this is safe to receive twice.
// In Supabase, switch OFF "Verify JWT" for this function.
// Secrets: PAYMENTO_API_KEY, PAYMENTO_IPN_SECRET, SERVICE_KEY.

const env = (k: string) => Deno.env.get(k) || '';

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

const API = 'https://api.paymento.io';

function patchOrder(id: string, patch: Record<string, unknown>, extra = '') {
  return fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${id}${extra}`, { method: 'PATCH', headers: { ...dbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
}

// Ask Paymento for the real status. 8 = Approve (paid and confirmed).
// (The same check as in crypto-order; each function is pasted on its own.)
async function confirm(order: Record<string, any>) {
  if (order.status === 'paid' || !order.provider_token) return order.status;
  const v = await fetch(`${API}/v1/payment/verify`, {
    method: 'POST',
    headers: { 'Api-Key': env('PAYMENTO_API_KEY'), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token: order.provider_token }),
  }).then((r) => r.json());
  const st = Number(v?.body?.orderStatus ?? -1);
  if (v?.success === true) {
    const r = await patchOrder(order.id, { status: 'paid', paid_at: new Date().toISOString(), provider_status: 8 }, '&status=neq.paid');
    if (!r.ok) throw new Error('db');
    return 'paid';
  }
  if ([4, 5, 9].includes(st)) await patchOrder(order.id, { status: 'failed', provider_status: st }, '&status=eq.created');
  else if (st === 10) await patchOrder(order.id, { status: 'refunded', provider_status: st }, '&status=eq.paid');
  else if (st >= 0) await patchOrder(order.id, { provider_status: st });
  return st;
}

async function hmacHex(secret: string, raw: ArrayBuffer) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, raw);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'PUT') return new Response('Use POST.', { status: 405 });
  if (!env('PAYMENTO_IPN_SECRET') || !env('PAYMENTO_API_KEY')) return new Response('Not set up.', { status: 503 });
  const raw = await req.arrayBuffer();
  const expected = await hmacHex(env('PAYMENTO_IPN_SECRET'), raw);
  if (!same(expected, req.headers.get('x-hmac-sha256-signature') || '')) return new Response('Bad signature.', { status: 401 });

  let ev: Record<string, any>;
  try { ev = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Bad body.', { status: 400 }); }
  const orderId = String(ev.OrderId ?? ev.orderId ?? '');
  const token = String(ev.Token ?? ev.token ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return new Response('ok');

  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${orderId}&select=*`, { headers: dbHeaders() });
  if (!r.ok) return new Response('Database busy.', { status: 503 });
  const order = (await r.json())[0];
  if (!order || order.provider !== 'paymento') return new Response('ok');
  if (token && order.provider_token && token !== order.provider_token) return new Response('ok');
  if (!order.provider_token && token) {
    order.provider_token = token;
    await patchOrder(order.id, { provider_token: token });
  }

  // Never trust the notice alone: ask Paymento.
  try {
    await confirm(order);
  } catch {
    return new Response('Try again.', { status: 503 });
  }
  return new Response('ok');
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
