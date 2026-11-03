// create-order: starts a Razorpay payment for one product.
// POST { product, item?, currency: 'INR' | 'USD' } with the player's login.
// The price comes from data/products.json on the live site, never from the
// browser. Needs secrets RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (and
// SITE_URL if the site is not https://web3.toys).

const env = (k: string) => Deno.env.get(k) || '';
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

async function loadProducts() {
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const r = await fetch(`${site}/data/products.json`);
  if (!r.ok) throw new Error('products');
  return (await r.json()).products as Array<Record<string, unknown>>;
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!env('RAZORPAY_KEY_ID') || !env('RAZORPAY_KEY_SECRET')) return json(503, { error: 'Payments are not switched on yet.' });

  const user = await loginUser(req);
  if (user instanceof Response) return user;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'Could not read the request.' }); }
  const currency = body.currency === 'INR' ? 'INR' : 'USD';
  const item = body.item == null || body.item === '' ? null : String(body.item);
  if (item && !/^[a-z0-9:._-]{1,60}$/i.test(item)) return json(400, { error: 'Unknown item.' });

  let products;
  try { products = await loadProducts(); } catch { return json(502, { error: 'Could not load the price list. Try again.' }); }
  const product = products.find((p) => p.id === body.product);
  if (!product) return json(404, { error: 'Unknown product.' });
  if (product.perItem && !item) return json(400, { error: 'Which one is this for?' });

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
