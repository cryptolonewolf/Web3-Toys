// cal-webhook: Cal.com tells us about bookings here (booked, paid,
// rescheduled, cancelled), so paid calls show in the admin dashboard.
// Checks Cal.com's signature: HMAC-SHA256 of the raw body with
// CAL_WEBHOOK_SECRET, in the X-Cal-Signature-256 header.
// In Supabase, switch OFF "Verify JWT" for this function.

const env = (k: string) => Deno.env.get(k) || '';

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function hmacHex(secret: string, raw: ArrayBuffer) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, raw))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string) {
  a = a.toLowerCase();
  b = b.toLowerCase().replace(/^sha256=/, '');
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const STATUS: Record<string, string> = {
  BOOKING_CREATED: 'booked',
  BOOKING_REQUESTED: 'booked',
  BOOKING_PAID: 'paid',
  BOOKING_RESCHEDULED: 'rescheduled',
  BOOKING_CANCELLED: 'cancelled',
  BOOKING_REJECTED: 'cancelled',
};

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('CAL_WEBHOOK_SECRET')) return new Response('Not set up.', { status: 503 });
  const raw = await req.arrayBuffer();
  const expected = await hmacHex(env('CAL_WEBHOOK_SECRET'), raw);
  if (!same(expected, req.headers.get('x-cal-signature-256') || '')) return new Response('Bad signature.', { status: 401 });

  let ev: Record<string, any>;
  try { ev = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Bad body.', { status: 400 }); }
  const status = STATUS[String(ev.triggerEvent || '')];
  const p = ev.payload || {};
  const uid = String(p.uid || p.bookingUid || '');
  if (!status || !uid) return new Response('ok');
  const who = (p.attendees || [])[0] || {};
  const paid = status === 'paid' || p.paid === true || (p.payment && p.payment.success === true);

  const row: Record<string, unknown> = {
    uid,
    title: p.title || p.eventTitle || null,
    start_time: p.startTime || null,
    end_time: p.endTime || null,
    name: who.name || null,
    email: who.email || null,
    status,
    last_event: ev.triggerEvent,
    updated_at: new Date().toISOString(),
  };
  if (typeof p.price === 'number') row.price = p.price;
  if (p.currency) row.currency = String(p.currency).toUpperCase();
  if (paid) row.paid = true;

  // A paid booking stays marked paid even if an older notice arrives later.
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/bookings?on_conflict=uid`, {
    method: 'POST',
    headers: { ...dbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) return new Response('Database busy.', { status: 503 });

  // A rescheduled booking gets a new uid: mark the old one.
  const old = p.rescheduleUid || p.fromReschedule;
  if (status === 'rescheduled' && old && old !== uid) {
    await fetch(`${env('SUPABASE_URL')}/rest/v1/bookings?uid=eq.${encodeURIComponent(old)}`, { method: 'PATCH', headers: { ...dbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'rescheduled', updated_at: new Date().toISOString() }) });
  }
  return new Response('ok');
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
