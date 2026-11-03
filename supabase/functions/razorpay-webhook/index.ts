// razorpay-webhook: Razorpay tells us about payments here, even when the
// buyer closed the page before it finished. Checks Razorpay's signature with
// RAZORPAY_WEBHOOK_SECRET. Events: payment.captured and order.paid (paid),
// payment.failed (failed), refund.processed (refunded).
// In Supabase, switch OFF "Verify JWT" for this function (Razorpay has no login).

const env = (k: string) => Deno.env.get(k) || '';

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
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

function update(orderId: string, onlyIf: string, patch: Record<string, unknown>) {
  return fetch(`${env('SUPABASE_URL')}/rest/v1/orders?razorpay_order_id=eq.${encodeURIComponent(orderId)}&${onlyIf}`, { method: 'PATCH', headers: dbHeaders(), body: JSON.stringify(patch) });
}

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('RAZORPAY_WEBHOOK_SECRET')) return new Response('Not set up.', { status: 503 });
  const raw = await req.text();
  const expected = await hmacHex(env('RAZORPAY_WEBHOOK_SECRET'), raw);
  if (!same(expected, req.headers.get('x-razorpay-signature') || '')) return new Response('Bad signature.', { status: 400 });

  let ev: Record<string, any>;
  try { ev = JSON.parse(raw); } catch { return new Response('Bad body.', { status: 400 }); }
  const pay = ev.payload?.payment?.entity || {};
  const orderId = pay.order_id || ev.payload?.order?.entity?.id;
  if (!orderId) return new Response('ok');

  if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
    await update(orderId, 'status=eq.created', { status: 'paid', razorpay_payment_id: pay.id || null, paid_at: new Date().toISOString() });
  } else if (ev.event === 'payment.failed') {
    await update(orderId, 'status=eq.created', { status: 'failed' });
  } else if (ev.event === 'refund.processed') {
    await update(orderId, 'status=eq.paid', { status: 'refunded' });
  }
  return new Response('ok');
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
