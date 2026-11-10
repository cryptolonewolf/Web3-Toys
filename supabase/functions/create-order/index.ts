// create-order: starts a Razorpay payment for one product.
// POST { product, item?, currency: 'INR' | 'USD' } with the player's login.
// The price comes from data/products.json on the live site, never from the
// browser. Needs secrets RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (and
// SITE_URL if the site is not https://web3.toys).

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'create-order';
const VERSION = 3; // raise when this file changes in a way the admin to-do list should know about

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

// For Projects deposits, worked out from data/business/ (US dollars only):
// deposit-toy-TIER and deposit-test-TIER cost price x deposit. The same rule
// is in js/pay.js (the checks compare them).
export function businessProducts(toy: any, test: any, ads?: any, pages?: any) {
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
  // Pro page for a year (pages.json pro.yearly), only while switched on. The page id is the item.
  const y = pages && pages.pro && pages.pro.yearly;
  if (y && y.on === true && Number(y.usd) > 0) out.push({ id: 'pro-year', type: 'pro', perItem: true, usd: Number(y.usd), title: 'Pro page: one year' });
  return out;
}

async function loadProducts() {
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const r = await fetch(`${site}/data/products.json`);
  if (!r.ok) throw new Error('products');
  const base = (await r.json()).products as Array<Record<string, unknown>>;
  const get = (f: string) => fetch(`${site}/data/business/${f}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  const [toy, test, ads, pages] = await Promise.all([get('toy_tiers.json'), get('test_tiers.json'), get('ad_slots.json'), get('pages.json')]);
  return base.concat(businessProducts(toy, test, ads, pages));
}

export async function handle(req: Request): Promise<Response> {
  // Version check for the admin to-do list (no secrets, only whether they are set).
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, live: env('RAZORPAY_KEY_ID').startsWith('rzp_live'), ready: !!(env('RAZORPAY_KEY_ID') && env('RAZORPAY_KEY_SECRET')) }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!env('RAZORPAY_KEY_ID') || !env('RAZORPAY_KEY_SECRET')) return json(503, { error: 'Payments are not switched on yet.' });

  const user = await loginUser(req);
  if (user instanceof Response) return user;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'Could not read the request.' }); }
  const item = body.item == null || body.item === '' ? null : String(body.item);
  if (item && !/^[a-z0-9:._-]{1,60}$/i.test(item)) return json(400, { error: 'Unknown item.' });

  let products;
  try { products = await loadProducts(); } catch { return json(502, { error: 'Could not load the price list. Try again.' }); }
  const product = products.find((p) => p.id === body.product);
  if (!product) return json(404, { error: 'Unknown product.' });
  if (product.perItem && !item) return json(400, { error: 'Which one is this for?' });
  // Rupees only when the product has a rupee price; otherwise US dollars.
  const currency = body.currency === 'INR' && product.inr ? 'INR' : 'USD';

  const price = Number(currency === 'INR' ? product.inr : product.usd);
  const amount = Math.round(price * 100);
  if (!(amount > 0)) return json(400, { error: 'This product has no price yet.' });
  const title = String(product.title) + (item ? ` (${item})` : '');

  const rz = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, receipt: `w3t_${Date.now().toString(36)}`, notes: { product: String(product.id), item: item || '', user: user.id } }),
  });
  if (!rz.ok) return json(502, { error: 'The payment could not start. Try again in a minute.' });
  const order = await rz.json();

  const saved = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders`, {
    method: 'POST',
    headers: { ...dbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: user.id, email: user.email || null, product_id: product.id, item, title, currency, amount, razorpay_order_id: order.id }),
  });
  if (!saved.ok) return json(502, { error: 'Could not save the order. Try again.' });

  return json(200, { orderId: order.id, amount, currency, keyId: env('RAZORPAY_KEY_ID'), title, email: user.email || '' });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
