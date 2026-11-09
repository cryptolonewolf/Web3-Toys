// admin-refund: the Refund in full button in the admin dashboard.
// POST { orderId, action?: 'refund' | 'mark' } with an admin's login.
//   refund: refunds a Razorpay payment in full through Razorpay, then marks
//           the order refunded (its request or booking follows).
//   mark:   for crypto (Paymento) payments, which you refund yourself from
//           Paymento: marks the order refunded once you have.
// Uses the secrets payments already have: RAZORPAY_KEY_ID,
// RAZORPAY_KEY_SECRET, SERVICE_KEY. In Supabase, switch OFF "Verify JWT".

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'admin-refund';
const VERSION = 2; // raise when this file changes in a way the admin to-do list should know about

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function dbHeaders(extra: Record<string, string> = {}) {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...extra };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}
const db = (path: string, init: RequestInit = {}) => fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: dbHeaders((init.headers as Record<string, string>) || {}) });

async function adminUser(req: Request): Promise<Record<string, any> | Response> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token.startsWith('eyJ')) return json(401, { error: 'Log in first.' });
  const key = env('SUPABASE_ANON_KEY') || dbHeaders().apikey;
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  const u = r.ok ? await r.json() : null;
  if (!u || !u.id) return json(401, { error: 'Your login has expired. Log in again.' });
  const a = await db(`admins?user_id=eq.${u.id}&select=user_id`).then((x) => (x.ok ? x.json() : []));
  if (!a.length) return json(403, { error: 'Admins only.' });
  return u;
}

export async function handle(req: Request): Promise<Response> {
  // Version check for the admin to-do list (no secrets, only whether they are set).
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  const admin = await adminUser(req);
  if (admin instanceof Response) return admin;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: 'Could not read the request.' }); }
  const id = String(b.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: 'Unknown order.' });
  const order = (await db(`orders?id=eq.${id}&select=*`).then((x) => (x.ok ? x.json() : [])))[0];
  if (!order) return json(404, { error: 'Unknown order.' });
  if (order.status === 'refunded') return json(200, { status: 'refunded', already: true });
  if (order.status !== 'paid') return json(409, { error: 'This order is not paid, so there is nothing to refund.' });

  // Marks the order refunded and records who did it in the audit log (017_ops.sql).
  const mark = async (how: string) => {
    await db(`orders?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'refunded' }) });
    await db('admin_audit', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ admin_id: admin.id, action: how, target_kind: 'orders', target_id: id, detail: { label: order.title, amount: order.amount, currency: order.currency } }) }).catch(() => null);
  };
  if ((order.provider || 'razorpay') !== 'razorpay') {
    if (b.action !== 'mark') return json(409, { error: 'This was a crypto payment. Refund it from your Paymento dashboard, then press Mark refunded.', crypto: true });
    await mark('marked refunded (crypto)');
    return json(200, { status: 'refunded', manual: true });
  }
  if (!order.razorpay_payment_id) return json(409, { error: 'No Razorpay payment is linked to this order.' });
  const rz = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.razorpay_payment_id)}/refund`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: order.amount, speed: 'normal', notes: { reason: String(b.reason || 'Declined after review').slice(0, 200), by: admin.id } }),
  });
  if (!rz.ok) {
    const e = await rz.json().catch(() => ({}));
    return json(502, { error: 'Razorpay did not accept the refund: ' + ((e.error && e.error.description) || rz.status) });
  }
  await mark('refunded in full');
  return json(200, { status: 'refunded' });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
