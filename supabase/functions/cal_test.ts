// Tests for the Cal.com booking notices.
// Run: WEB3TOYS_TEST=1 deno test --allow-env supabase/functions/cal_test.ts
import { assertEquals } from 'jsr:@std/assert@1';

Deno.env.set('WEB3TOYS_TEST', '1');
Deno.env.set('SUPABASE_URL', 'https://db.test');
Deno.env.set('SERVICE_KEY', 'sb_secret_test');
Deno.env.set('CAL_WEBHOOK_SECRET', 'cal_secret');
const cal = (await import('./cal-webhook/index.ts')).handle;

const rows: Record<string, any> = {};
globalThis.fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  if (url.startsWith('https://db.test/rest/v1/bookings?on_conflict=uid')) {
    const b = JSON.parse(String(init.body));
    rows[b.uid] = { ...(rows[b.uid] || {}), ...b };
    return new Response(null, { status: 201 });
  }
  if (url.startsWith('https://db.test/rest/v1/bookings?uid=eq.')) {
    const uid = decodeURIComponent(url.split('uid=eq.')[1]);
    Object.assign(rows[uid] || {}, JSON.parse(String(init.body)));
    return new Response(null, { status: 204 });
  }
  throw new Error('Unexpected fetch ' + url);
};

async function sign(text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('cal_secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const send = async (ev: unknown, sig?: string) => {
  const body = JSON.stringify(ev);
  return cal(new Request('https://fn.test', { method: 'POST', headers: { 'X-Cal-Signature-256': sig ?? await sign(body) }, body }));
};

const booking = (trigger: string, extra: Record<string, unknown> = {}) => ({
  triggerEvent: trigger,
  createdAt: '2026-11-03T10:00:00Z',
  payload: { uid: 'bk1', title: '30 minute call with Aki', startTime: '2026-11-10T09:00:00Z', endTime: '2026-11-10T09:30:00Z', attendees: [{ name: 'Sam', email: 'sam@x.com' }], price: 4900, currency: 'usd', ...extra },
});

Deno.test('ignores notices without the right signature', async () => {
  assertEquals((await send(booking('BOOKING_CREATED'), 'abc')).status, 401);
  assertEquals(rows.bk1, undefined);
});

Deno.test('records a booking, then its payment and cancellation', async () => {
  assertEquals((await send(booking('BOOKING_CREATED'))).status, 200);
  assertEquals(rows.bk1.status, 'booked');
  assertEquals(rows.bk1.email, 'sam@x.com');
  assertEquals(rows.bk1.currency, 'USD');
  await send(booking('BOOKING_PAID'));
  assertEquals(rows.bk1.paid, true);
  assertEquals(rows.bk1.status, 'paid');
  await send(booking('BOOKING_CANCELLED'));
  assertEquals(rows.bk1.status, 'cancelled');
  assertEquals(rows.bk1.paid, true);
});

Deno.test('a reschedule marks the old booking', async () => {
  rows.old1 = { uid: 'old1', status: 'booked' };
  await send(booking('BOOKING_RESCHEDULED', { uid: 'bk2', rescheduleUid: 'old1' }));
  assertEquals(rows.bk2.status, 'rescheduled');
  assertEquals(rows.old1.status, 'rescheduled');
});
