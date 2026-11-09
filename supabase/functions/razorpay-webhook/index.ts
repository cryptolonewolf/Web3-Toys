// razorpay-webhook: Razorpay tells us about payments here, even when the
// buyer closed the page before it finished. Checks Razorpay's signature with
// RAZORPAY_WEBHOOK_SECRET. Events: payment.captured and order.paid (paid),
// payment.failed (failed), refund.processed (refunded), payment.dispute.created
// (marks the order disputed for the admin Operations home). Anything that
// goes wrong is recorded in ops_health (supabase/017_ops.sql).
// In Supabase, switch OFF "Verify JWT" for this function (Razorpay has no login).

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'razorpay-webhook';
const VERSION = 2; // raise when this file changes in a way the admin to-do list should know about


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

// Records a problem for the admin Operations home (best effort).
export function problem(detail: string) {
  return fetch(`${env('SUPABASE_URL')}/rest/v1/ops_health`, { method: 'POST', headers: dbHeaders(), body: JSON.stringify({ kind: 'webhook', source: 'razorpay-webhook', detail: detail.slice(0, 300) }) }).catch(() => null);
}

async function update(orderId: string, onlyIf: string, patch: Record<string, unknown>, by = 'razorpay_order_id') {
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/orders?${by}=eq.${encodeURIComponent(orderId)}&${onlyIf}`, { method: 'PATCH', headers: dbHeaders(), body: JSON.stringify(patch) }).catch(() => null);
  if (!r || !r.ok) await problem(`Could not update order ${orderId} (${r ? 'HTTP ' + r.status : 'no connection'})`);
  return r;
}

export async function handle(req: Request): Promise<Response> {
  // Version check for the admin to-do list (no secrets, only whether they are set).
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, ready: !!env('RAZORPAY_WEBHOOK_SECRET') }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('RAZORPAY_WEBHOOK_SECRET')) return new Response('Not set up.', { status: 503 });
  const raw = await req.text();
  const expected = await hmacHex(env('RAZORPAY_WEBHOOK_SECRET'), raw);
  if (!same(expected, req.headers.get('x-razorpay-signature') || '')) {
    await problem('A webhook arrived with a wrong signature (check RAZORPAY_WEBHOOK_SECRET matches Razorpay).');
    return new Response('Bad signature.', { status: 400 });
  }

  let ev: Record<string, any>;
  try { ev = JSON.parse(raw); } catch { return new Response('Bad body.', { status: 400 }); }
  const pay = ev.payload?.payment?.entity || {};
  if (String(ev.event || '').startsWith('payment.dispute.')) {
    const d = ev.payload?.dispute?.entity || {};
    const paymentId = d.payment_id || pay.id;
    if (paymentId) {
      const note = `${ev.event.replace('payment.dispute.', 'Dispute ')}: ${d.reason_description || d.reason_code || 'no reason given'}${d.respond_by ? ' · respond by ' + new Date(d.respond_by * 1000).toISOString().slice(0, 10) : ''}`;
      await update(paymentId, 'id=not.is.null', { disputed_at: new Date().toISOString(), dispute_note: note.slice(0, 300), ops_reviewed_at: null }, 'razorpay_payment_id');
    }
    return new Response('ok');
  }
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
