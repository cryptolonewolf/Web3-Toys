// crypto-order: crypto payments with Paymento (non-custodial: the buyer pays
// from their wallet straight to yours).
// POST { action: 'create', product, item? } with the player's login: makes
//   the order and returns the Paymento checkout link. Price in US dollars
//   from data/products.json on the live site, never from the browser.
// POST { action: 'check', orderId } with the player's login: asks Paymento
//   (verify) and marks the order paid once Paymento approves it.
// Secrets: PAYMENTO_API_KEY, SERVICE_KEY, SITE_URL.

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'crypto-order';
const VERSION = 2; // raise when this file changes in a way the admin to-do list should know about

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

// Who is logged in. Uses Supabase's built-in public key for the check (always
// present in Edge Functions), so a wrong SERVICE_KEY cannot block logins.
// Returns the user, or a Response explaining what went wrong.
async function loginUser(req: Request): Promise<Record<string, any> | Response> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !token.startsWith('eyJ')) return json(401, { error: 'Log in first.' });
  const keys = [env('SUPABASE_ANON_KEY'), dbHeaders().apikey].filter(Boolean);
  let last = '';
  for (const key of keys) {
    const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const u = await r.json();
      if (u && u.id) return u;
    }
    last = await r.text().catch(() => '');
    if (!/api ?key/i.test(last)) break;
  }
  if (/api ?key/i.test(last)) return json(503, { error: 'Payment server setup problem: the Supabase key in the Edge Function secrets (SERVICE_KEY) is not accepted.' });
  return json(401, { error: 'Your login has expired. Log out, log in again, then retry.' });
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

// For Projects deposits, worked out from data/business/ (US dollars only).
// The same rule as create-order and js/pay.js (the checks compare them).
export function businessProducts(toy: any, test: any, ads?: any) {
  const out: Array<Record<string, unknown>> = [];
  const add = (kind: string, file: any, label: string) => {
    if (!file || !Array.isArray(file.tiers)) return;
    const share = Number(file.deposit) || 0.5;
    file.tiers.forEach((t: any) => {
      if (!(Number(t.price) > 0)) return;
      out.push({ id: `deposit-${kind}-${t.id}`, type: 'project', perItem: true, usd: Math.round(Number(t.price) * share * 100) / 100,
        title: `${label}: ${t.name} deposit (${Math.round(share * 100)}%)` });
    });
  };
  add('toy', toy, 'Launch Your Own Toy');
  add('test', test, 'Test Your Product');
  // Sponsor a Toy: ad-toy-TOY (one toy, one month), ad-toy-TOY-round (with a
  // sponsored round), ad-site and ad-newsletter. The booking id is the item.
  if (ads && ads.toyMonth) {
    Object.keys(ads.toyMonth).forEach((id) => {
      const p = Number(ads.toyMonth[id]);
      if (!(p > 0)) return;
      out.push({ id: `ad-toy-${id}`, type: 'ad', perItem: true, usd: p, title: 'Sponsor a Toy: one toy, one month' });
      if ((ads.roundToys || []).includes(id) && Number(ads.sponsoredRound) > 0) out.push({ id: `ad-toy-${id}-round`, type: 'ad', perItem: true, usd: p + Number(ads.sponsoredRound), title: 'Sponsor a Toy: one toy, one month, with a sponsored round' });
    });
    if (Number(ads.siteWide) > 0) out.push({ id: 'ad-site', type: 'ad', perItem: true, usd: Number(ads.siteWide), title: 'Sponsor a Toy: site-wide, one month' });
    if (Number(ads.newsletter) > 0) out.push({ id: 'ad-newsletter', type: 'ad', perItem: true, usd: Number(ads.newsletter), title: 'Sponsor a Toy: one newsletter issue' });
  }
  return out;
}

export async function handle(req: Request): Promise<Response> {
  // Version check for the admin to-do list (no secrets, only whether they are set).
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, ready: !!env('PAYMENTO_API_KEY') }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!env('PAYMENTO_API_KEY')) return json(503, { error: 'Crypto payments are not switched on yet.' });
  const user = await loginUser(req);
  if (user instanceof Response) return user;
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
  const get = (f: string) => fetch(`${site()}/data/business/${f}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  const [toyTiers, testTiers, adSlots] = await Promise.all([get('toy_tiers.json'), get('test_tiers.json'), get('ad_slots.json')]);
  const product = (await list.json()).products.concat(businessProducts(toyTiers, testTiers, adSlots)).find((p: Record<string, unknown>) => p.id === b.product);
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
