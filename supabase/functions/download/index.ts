// download: gives a link to a paid file that works for 5 minutes.
// POST { orderId } with the player's login. Only for the buyer's own paid
// order, and only for products with a file in data/products.json.

const env = (k: string) => Deno.env.get(k) || '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const LINK_SECONDS = 300;

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

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  const user = await loginUser(req);
  if (!user) return json(401, { error: 'Log in first.' });
  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json(400, { error: 'Could not read the request.' }); }
  if (!/^[0-9a-f-]{36}$/i.test(String(b.orderId || ''))) return json(400, { error: 'Unknown order.' });

  const found = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${b.orderId}&select=*`, { headers: dbHeaders() });
  const order = found.ok ? (await found.json())[0] : null;
  if (!order || order.user_id !== user.id) return json(404, { error: 'Order not found.' });
  if (order.status !== 'paid') return json(402, { error: 'This order is not paid.' });

  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const list = await fetch(`${site}/data/products.json`);
  const product = list.ok ? (await list.json()).products.find((p: Record<string, unknown>) => p.id === order.product_id) : null;
  if (!product || !product.file) return json(404, { error: 'This purchase has no file to download.' });

  const path = String(product.file).split('/').map(encodeURIComponent).join('/');
  const signed = await fetch(`${env('SUPABASE_URL')}/storage/v1/object/sign/paid-files/${path}`, {
    method: 'POST',
    headers: dbHeaders(),
    body: JSON.stringify({ expiresIn: LINK_SECONDS }),
  });
  if (!signed.ok) return json(404, { error: 'The file is not uploaded yet. We will email you when it is ready.' });
  const s = await signed.json();
  return json(200, { url: `${env('SUPABASE_URL')}/storage/v1${s.signedURL}`, seconds: LINK_SECONDS });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
