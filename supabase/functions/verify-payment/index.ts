// verify-payment: called by the page right after Razorpay says "paid".
// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } with
// the player's login. Checks Razorpay's signature with the secret key, then
// marks the order paid. Optional: RESEND_API_KEY and RECEIPT_FROM send our
// own receipt email (Razorpay also emails its receipt).

const env = (k: string) => Deno.env.get(k) || '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

async function hmacHex(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sendReceipt(order: Record<string, unknown>) {
  if (!env('RESEND_API_KEY') || !env('RECEIPT_FROM') || !order.email || order.receipt_sent_at) return;
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const amount = (Number(order.amount) / 100).toFixed(order.currency === 'INR' ? 0 : 2);
  const price = order.currency === 'INR' ? `₹${amount}` : `$${amount}`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('RECEIPT_FROM'),
      to: [order.email],
      subject: `Your web3.toys receipt: ${order.title}`,
      text: `Thanks for your purchase!\n\n${order.title}\nPaid: ${price}\nPayment reference: ${order.razorpay_payment_id}\nDate: ${new Date().toISOString().slice(0, 10)}\n\nDownload it any time from My Progress, Purchases: ${site}/progress/#purchases\n\nRefunds and delivery: ${site}/refunds/\nQuestions: reply to this email.\n\nweb3.toys by Build With Aki, Dehradun, India`,
    }),
  });
  if (r.ok) {
    await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${order.id}`, { method: 'PATCH', headers: { ...dbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ receipt_sent_at: new Date().toISOString() }) });
  }
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!env('RAZORPAY_KEY_SECRET')) return json(503, { error: 'Payments are not switched on yet.' });
  const user = await loginUser(req);
  if (!user) return json(401, { error: 'Log in first.' });

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json(400, { error: 'Could not read the payment.' }); }
  const orderId = String(b.razorpay_order_id || '');
  const paymentId = String(b.razorpay_payment_id || '');
  const expected = await hmacHex(env('RAZORPAY_KEY_SECRET'), `${orderId}|${paymentId}`);
  if (!orderId || !paymentId || !same(expected, String(b.razorpay_signature || ''))) return json(400, { error: 'The payment could not be confirmed.' });

  const found = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*`, { headers: dbHeaders() });
  const rows = found.ok ? await found.json() : [];
  const order = rows[0];
  if (!order || order.user_id !== user.id) return json(404, { error: 'Order not found.' });

  if (order.status !== 'paid') {
    const upd = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?id=eq.${order.id}&status=neq.paid`, {
      method: 'PATCH',
      headers: { ...dbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'paid', razorpay_payment_id: paymentId, paid_at: new Date().toISOString() }),
    });
    if (!upd.ok) return json(502, { error: 'Paid, but we could not save it yet. It will show in a few minutes.' });
    order.status = 'paid';
    order.razorpay_payment_id = paymentId;
  }
  try { await sendReceipt(order); } catch { /* the receipt is a bonus */ }
  return json(200, { paid: true, order: { id: order.id, product_id: order.product_id, item: order.item, title: order.title } });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
