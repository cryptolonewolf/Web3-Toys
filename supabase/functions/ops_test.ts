// Tests for ops-digest and ops-check: WEB3TOYS_TEST=1 deno test --allow-env --allow-read --allow-net supabase/functions/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { digest } from './ops-digest/index.ts';
import { check, run } from './ops-check/index.ts';
import { handle as webhook } from './razorpay-webhook/index.ts';

const O = JSON.parse(await Deno.readTextFile(new URL('../../data/ops.json', import.meta.url)));
const HOUR = 36e5;
const now = Date.parse('2026-11-20T03:30:00Z');
const empty: any = { queues: O.queues.map((q: any) => ({ id: q.id, count: 0, oldest: null })), numbers: { yesterday: { plays: 5 } }, health: {} };

Deno.test('digest: no email when every queue is empty, unless forced', () => {
  assertEquals(digest(empty, O, 'https://web3.toys', now), null);
  assert(digest(empty, O, 'https://web3.toys', now, true));
});

Deno.test('digest: counts, overdue first, and yesterday numbers', () => {
  const D = structuredClone(empty);
  D.queues.find((q: any) => q.id === 'refunds').count = 2;
  D.queues.find((q: any) => q.id === 'refunds').oldest = new Date(now - 80 * HOUR).toISOString();
  D.queues.find((q: any) => q.id === 'contact').count = 1;
  D.queues.find((q: any) => q.id === 'contact').oldest = new Date(now - 2 * HOUR).toISOString();
  D.numbers.yesterday = { plays: 1234, accounts: 9, signups: 4, certificates: 30 };
  D.health = { errors: 3, links: [{}] };
  const m = digest(D, O, 'https://web3.toys', now)!;
  assertEquals(m.subject, 'web3.toys today: 3 waiting, 1 overdue');
  assert(m.html.indexOf('Refund requests') < m.html.indexOf('Contact form messages'));
  assert(m.html.includes('Overdue (more than 72 hours)'));
  assert(m.text.includes('1234 plays, 9 new accounts'));
  assert(m.text.includes('3 page errors in 24 h, 1 broken links'));
  assert(!/<script/i.test(m.html));
});

Deno.test('ops-check: broken, slow and robot-blocked links', async () => {
  const fake = async (url: string) => {
    if (url.endsWith('/data/link-check.json')) return new Response(JSON.stringify({ pages: ['/', '/gone/'], links: [['https://a.example/ok', '/x/'], ['https://b.example/404', '/data/y.json'], ['https://c.example/403', '/z/']] }));
    if (url.includes('/gone/') || url.includes('404')) return new Response('', { status: 404 });
    if (url.includes('403')) return new Response('', { status: 403 });
    return new Response('ok');
  };
  const rows = await run('https://web3.toys', fake as any);
  const links = rows.filter((r) => r.kind === 'link');
  assertEquals(links.map((r) => r.source).sort(), ['/data/y.json', '/gone/']);
  assert(rows[rows.length - 1].detail.includes('2 pages and 3 links checked: 2 broken'));
  const dead = await check('https://nowhere.example', (async () => { throw new TypeError('dns'); }) as any);
  assertEquals(dead.broken, true);
});

Deno.test('webhook: a dispute marks the order and a bad signature is recorded', async () => {
  Deno.env.set('RAZORPAY_WEBHOOK_SECRET', 'whsec');
  Deno.env.set('SUPABASE_URL', 'https://db.test');
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: string, init: RequestInit) => { calls.push(`${init?.method} ${u} ${init?.body || ''}`); return new Response(null, { status: 204 }); }) as any;
  try {
    const body = JSON.stringify({ event: 'payment.dispute.created', payload: { payment: { entity: { id: 'pay_1' } }, dispute: { entity: { payment_id: 'pay_1', reason_description: 'Not received' } } } });
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    assertEquals((await webhook(new Request('https://f/', { method: 'POST', body, headers: { 'x-razorpay-signature': sig } }))).status, 200);
    assert(calls.some((c) => c.startsWith('PATCH https://db.test/rest/v1/orders?razorpay_payment_id=eq.pay_1') && c.includes('Not received')));
    assertEquals((await webhook(new Request('https://f/', { method: 'POST', body, headers: { 'x-razorpay-signature': 'bad' } }))).status, 400);
    assert(calls.some((c) => c.startsWith('POST https://db.test/rest/v1/ops_health') && c.includes('wrong signature')));
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('page-emails: the Pro reminder names the end date and the ways to renew', async () => {
  const { reminder } = await import('./page-emails/index.ts');
  const m = reminder({ handle: 'LumenFi', name: 'Lumen', pro_until: '2026-12-01T10:00:00Z', days: 3 }, 'https://web3.toys');
  assertEquals(m.subject, 'Your web3.toys Pro ends in 3 days');
  assert(m.html.includes('1 December 2026') && m.html.includes('/launch-your-toy/') && m.html.includes('/academy/list-your-project/') && m.html.includes('/test-your-product/'));
  assert(!m.html.includes('<script'));
});
