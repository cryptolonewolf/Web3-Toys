// crypto-order: crypto payments with Paymento (non-custodial: the buyer pays
// from their wallet straight to yours).
// POST { action: 'create', product, item? } with the player's login: makes
//   the order and returns the Paymento checkout link. Price in US dollars
//   from data/products.json on the live site, never from the browser.
// POST { action: 'check', orderId } with the player's login: asks Paymento
//   (verify) and marks the order paid once Paymento approves it.
// Secrets: PAYMENTO_API_KEY, SERVICE_KEY, SITE_URL.

const env = (k: string) => Deno.env.get(k) || '';
const API = 'https://api.paymento.io';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const site = () => (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function loginUser(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: dbHeaders().apikey, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function paymento(path: string, body: unknown) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Api-Key': env('PAYMENTO_API_KEY'), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

function patchOrder(id: string, patch: Record<string, unknown>, extra = '') {
  return fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${id}${extra}`, { method: 'PATCH', headers: { ...dbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
}

// Ask Paymento for the real status. 8 = Approve (paid and confirmed).
async function confirm(order: Record<string, any>) {
  if (order.status === 'paid' || !order.provider_token) return order.status;
  const v = await paymento('/v1/payment/verify', { token: order.provider_token });
  const st = Number(v?.body?.orderStatus ?? -1);
  if (v?.success === true) {
    await patchOrder(order.id, { status: 'paid', paid_at: new Date().toISOString(), provider_status: 8 }, '&status=neq.paid');
    return 'paid';
  }
  if ([4, 5, 9].includes(st)) await patchOrder(order.id, { status: 'failed', provider_status: st }, '&status=eq.created');
  else if (st === 10) await patchOrder(order.id, { status: 'refunded', provider_status: st }, '&status=eq.paid');
  else if (st >= 0) await patchOrder(order.id, { provider_status: st });
  return st === 10 ? 'refunded' : [4, 5, 9].includes(st) ? 'failed' : 'created';
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!env('PAYMENTO_API_KEY')) return json(503, { error: 'Crypto payments are not switched on yet.' });
  const user = await loginUser(req);
  if (!user) return json(401, { error: 'Log in first.' });
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json(400, { error: 'Could not read the request.' }); }

  if (b.action === 'check') {
    if (!/^[0-9a-f-]{36}$/i.test(String(b.orderId || ''))) return json(400, { error: 'Unknown order.' });
    const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${b.orderId}&select=*`, { headers: dbHeaders() });
    const order = r.ok ? (await r.json())[0] : null;
    if (!order || order.user_id !== user.id || order.provider !== 'paymento') return json(404, { error: 'Order not found.' });
    const status = await confirm(order);
    return json(200, { status, waiting: order.provider_status === 2 || order.provider_status === 3 });
  }

  const item = b.item == null || b.item === '' ? null : String(b.item);
  if (item && !/^[a-z0-9:._-]{1,60}$/i.test(item)) return json(400, { error: 'Unknown item.' });
  const list = await fetch(`${site()}/data/products.json`);
  if (!list.ok) return json(502, { error: 'Could not load the price list. Try again.' });
  const product = (await list.json()).products.find((p: Record<string, unknown>) => p.id === b.product);
  if (!product) return json(404, { error: 'Unknown product.' });
  if (product.perItem && !item) return json(400, { error: 'Which one is this for?' });
  const usd = Number(product.usd);
  if (!(usd > 0)) return json(400, { error: 'This product has no price yet.' });
  const title = String(product.title) + (item ? ` (${item})` : '');
  const id = crypto.randomUUID();

  const saved = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders`, {
    method: 'POST',
    headers: { ...dbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ id, user_id: user.id, email: user.email || null, product_id: product.id, item, title, currency: 'USD', amount: Math.round(usd * 100), provider: 'paymento' }),
  });
  if (!saved.ok) return json(502, { error: 'Could not save the order. Try again.' });

  const pr = await paymento('/v1/payment/request', {
    fiatAmount: usd.toFixed(2),
    fiatCurrency: 'USD',
    returnUrl: `${site()}/progress/?order=${id}#purchases`,
    orderId: id,
    riskSpeed: 1,
    emailAddress: user.email || undefined,
    additionalData: [{ key: 'product', value: String(product.id) }, { key: 'item', value: item || '' }],
  }).catch(() => null);
  const token = pr && pr.success && (typeof pr.body === 'string' ? pr.body : pr.body?.token);
  if (!token) {
    await patchOrder(id, { status: 'failed' });
    return json(502, { error: 'The crypto payment could not start. Try again in a minute.' });
  }
  await patchOrder(id, { provider_token: token });
  return json(200, { orderId: id, url: `https://app.paymento.io/gateway?token=${encodeURIComponent(token)}` });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
