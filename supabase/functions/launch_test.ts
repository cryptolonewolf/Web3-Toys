// Tests for the Notify me launch emails.
// Run: WEB3TOYS_TEST=1 deno test --allow-env supabase/functions/launch_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';

Deno.env.set('WEB3TOYS_TEST', '1');
Deno.env.set('SUPABASE_URL', 'https://db.test');
Deno.env.set('SERVICE_KEY', 'sb_secret_test');
Deno.env.set('CRON_SECRET', 'cron_secret');
Deno.env.set('RESEND_API_KEY', 're_test');
Deno.env.set('LAUNCH_FROM', 'web3.toys <hello@web3.toys>');
Deno.env.set('SITE_URL', 'https://site.test');
const mod = await import('./launch-emails/index.ts');

const T = Date.parse('2026-11-17T10:00:00+05:30');
const rows: any[] = [
  { id: 1, toy_id: 'web3-roles', email: 'a@x.com', sent_day_before: null, sent_launch: null },
  { id: 2, toy_id: 'web3-roles', email: 'b@x.com', sent_day_before: null, sent_launch: null },
  { id: 3, toy_id: 'tokenomics-basics', email: 'c@x.com', sent_day_before: null, sent_launch: null },
];
const mails: any[] = [];
const deleted: string[] = [];
globalThis.fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  if (url === 'https://site.test/data/releases.json') return Response.json({ toys: [
    { id: 'scam', date: '2026-11-10T10:00:00+05:30', playableNow: true, ready: true, hook: 'x' },
    { id: 'web3-roles', date: '2026-11-17T10:00:00+05:30', ready: true, hook: 'Every role in a web3 team.' },
    { id: 'tokenomics-basics', date: '2026-11-24T10:00:00+05:30', ready: false, hook: 'y' },
  ] });
  if (url === 'https://site.test/data/home.json') return Response.json({ shelves: [{ cards: [{ id: 'web3-roles', title: 'Roles in Web3, Explained', path: 'web3-roles/' }] }] });
  if (url.startsWith('https://db.test/rest/v1/release_overrides')) return Response.json([]);
  if (url.startsWith('https://db.test/rest/v1/rpc/early_bird_counts')) return Response.json([{ toy: 'web3-roles', spots: 1000, used: 358 }]);
  if (url.startsWith('https://db.test/rest/v1/release_notify?toy_id=eq.')) {
    const toy = decodeURIComponent(url.split('toy_id=eq.')[1].split('&')[0]);
    const col = url.includes('sent_day_before=is.null') ? 'sent_day_before' : 'sent_launch';
    return Response.json(rows.filter((r) => r.toy_id === toy && !r[col]));
  }
  if (url.startsWith('https://db.test/rest/v1/release_notify?id=eq.')) {
    const id = Number(url.split('id=eq.')[1]);
    if (init.method === 'DELETE') { deleted.push(String(id)); rows.splice(rows.findIndex((r) => r.id === id), 1); return new Response(null, { status: 204 }); }
    Object.assign(rows.find((r) => r.id === id), JSON.parse(String(init.body)));
    return new Response(null, { status: 204 });
  }
  if (url.startsWith('https://db.test/rest/v1/release_notify?sent_launch=lt.')) return new Response(null, { status: 204 });
  if (url === 'https://api.resend.com/emails') { mails.push(JSON.parse(String(init.body))); return Response.json({ id: 'm' + mails.length }); }
  throw new Error('Unexpected fetch ' + url);
};

const run = (now: number, key = 'cron_secret') => mod.handle(new Request(`https://fn.test/?now=${now}`, { method: 'POST', headers: { 'x-cron-key': key } }));

Deno.test('needs the cron password', async () => {
  assertEquals((await run(T, 'wrong')).status, 401);
});

Deno.test('nothing two days before', async () => {
  await run(T - 48 * 36e5);
  assertEquals(mails.length, 0);
});

Deno.test('day before: one email each, once; not for toys that are not built', async () => {
  await run(T - 20 * 36e5);
  await run(T - 19 * 36e5);
  assertEquals(mails.length, 2);
  assert(mails[0].subject.startsWith('Tomorrow at 10:00: Roles in Web3, Explained'));
  assert(mails[0].html.includes('642 spots left'));
  assert(mails[0].html.includes('https://site.test/soon/?toy=web3-roles'));
  assert(mails[0].headers['List-Unsubscribe'].includes('?unsub=1.'));
});

Deno.test('launch morning: the play link, once', async () => {
  await run(T + 1 * 36e5);
  await run(T + 2 * 36e5);
  assertEquals(mails.length, 4);
  assertEquals(mails[2].subject, 'Roles in Web3, Explained is live on web3.toys');
  assert(mails[2].html.includes('https://site.test/web3-roles/'));
});

Deno.test('unsubscribe link removes only with the right signature', async () => {
  const bad = await mod.handle(new Request('https://fn.test/?unsub=3.deadbeef'));
  assertEquals(bad.status, 400);
  const link = new URL(mails[0].headers['List-Unsubscribe'].slice(1, -1));
  const ok = await mod.handle(new Request('https://fn.test/?unsub=' + link.searchParams.get('unsub')));
  assertEquals(ok.status, 200);
  assertEquals(deleted, ['1']);
});
