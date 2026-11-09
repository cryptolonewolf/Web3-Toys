// launch-emails: the Notify me emails for scheduled toys.
// Runs every hour (supabase/013_launch_emails.sql schedules it) and sends:
//   - "Tomorrow at 10:00" to everyone who tapped Notify me, once the toy is
//     less than 26 hours away;
//   - "It's live" once the toy is out (within its first 12 hours).
// Each person gets each email once. Every email has an unsubscribe link
// (GET this function with ?unsub=...). Rows are removed 90 days after the
// launch email, as the privacy page says.
// Secrets in Supabase: RESEND_API_KEY, LAUNCH_FROM (for example
// "web3.toys <hello@web3.toys>"; RECEIPT_FROM is used if missing) and
// CRON_SECRET (the same password as in 013_launch_emails.sql).
// In Supabase, switch OFF "Verify JWT" for this function.

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'launch-emails';
const VERSION = 2; // raise when this file changes in a way the admin to-do list should know about

const HOUR = 36e5;

function dbHeaders(extra: Record<string, string> = {}) {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...extra };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: dbHeaders((init.headers as Record<string, string>) || {}) });

async function hmac(text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('CRON_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// The same rule as decide() in js/releases.js.
export function decide(toy: any, nowMs: number, o: any) {
  let at = Date.parse(toy.date);
  if (o && o.action === 'delay') at = o.until ? Date.parse(o.until) : NaN;
  let released: boolean;
  if (!toy.ready) released = false;
  else if (o && o.action === 'release') released = true;
  else if (o && o.action === 'delay') released = !isNaN(at) && nowMs >= at;
  else released = toy.playableNow || nowMs >= at;
  const liveAt = o && o.action === 'release' ? Math.min(Date.parse(o.updated_at || toy.date) || at, at) : at;
  return { released, at, liveAt };
}

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
}

export function email(kind: 'day_before' | 'launch', t: { id: string; title: string; hook: string; link: string; at: number }, spotsLeft: number | null, site: string, unsub: string) {
  const subject = kind === 'day_before'
    ? `Tomorrow at 10:00: ${t.title} unlocks on web3.toys`
    : `${t.title} is live on web3.toys`;
  const bird = spotsLeft == null ? '' : spotsLeft > 0
    ? `🐣 Early Bird: ${spotsLeft.toLocaleString('en-US')} spots left. The first players to earn the certificate get 2x coins.`
    : '🐣 Early Bird is full, but the toy is free to play.';
  const lead = kind === 'day_before'
    ? `It unlocks ${esc(dayLabel(t.at))} at 10:00 India time. You asked us to tell you.`
    : 'It is out now. You asked us to tell you.';
  const img = `${site}/marketing/launches/img/${t.id}-${kind === 'day_before' ? 'teaser' : 'launch'}-x.png`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8E1;font-family:Arial,Helvetica,sans-serif;color:#1F1B2E">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:bold;margin:0 0 16px">web3.toys</p>
<img src="${img}" width="528" alt="${esc(t.title)}" style="width:100%;max-width:528px;height:auto;border:3px solid #1F1B2E;border-radius:16px;display:block" />
<h1 style="font-size:24px;margin:20px 0 8px">${esc(t.title)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 8px">${esc(t.hook)}</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">${lead}</p>
${bird ? `<p style="font-size:15px;line-height:1.5;margin:0 0 16px;font-weight:bold">${esc(bird)}</p>` : ''}
<p style="margin:20px 0"><a href="${t.link}" style="background:#1F1B2E;color:#FFD93D;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">${kind === 'day_before' ? 'See the toy' : 'Play now'}</a></p>
<p style="font-size:12px;color:#5A5470;line-height:1.5;margin-top:28px">Educational only. Not financial advice.<br>You get this because you tapped Notify me for this toy. <a href="${unsub}" style="color:#5A5470">Unsubscribe</a>.<br>Build With Aki, Dehradun, Uttarakhand, India.</p>
</div></body></html>`;
  const text = `${t.title}\n\n${t.hook}\n\n${lead.replace(/&[a-z]+;/g, ' ')}\n${bird}\n\n${t.link}\n\nUnsubscribe: ${unsub}`;
  return { subject, html, text };
}

async function unsubscribe(token: string) {
  const [id, sig] = token.split('.');
  const page = (msg: string, status = 200) => new Response(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:Arial;padding:32px;background:#FFF8E1;color:#1F1B2E"><h1>web3.toys</h1><p>${msg}</p><p><a href="https://web3.toys/">Back to web3.toys</a></p></body>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (!/^\d+$/.test(id || '') || sig !== await hmac('unsub:' + id)) return page('This unsubscribe link is not valid.', 400);
  await db(`release_notify?id=eq.${id}`, { method: 'DELETE' });
  return page('Done. You will not get emails about this toy.');
}

export async function handle(req: Request): Promise<Response> {
  // Version check for the admin to-do list (no secrets, only whether they are set).
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, email: !!env('RESEND_API_KEY') }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  const url = new URL(req.url);
  if (req.method === 'GET' && url.searchParams.get('unsub')) return unsubscribe(url.searchParams.get('unsub') || '');
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('CRON_SECRET') || req.headers.get('x-cron-key') !== env('CRON_SECRET')) return new Response('Not allowed.', { status: 401 });
  const from = env('LAUNCH_FROM') || env('RECEIPT_FROM');
  if (!env('RESEND_API_KEY') || !from) return new Response('Emails are not set up yet.', { status: 503 });

  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const fnUrl = `${env('SUPABASE_URL')}/functions/v1/launch-emails`;
  const now = env('WEB3TOYS_TEST') && url.searchParams.get('now') ? Number(url.searchParams.get('now')) : Date.now();
  const [rel, home, overrides, counts] = await Promise.all([
    fetch(`${site}/data/releases.json`).then((r) => r.json()),
    fetch(`${site}/data/home.json`).then((r) => r.json()),
    db('release_overrides?select=toy_id,action,until,updated_at').then((r) => r.ok ? r.json() : []),
    db('rpc/early_bird_counts', { method: 'POST', body: '{}' }).then((r) => r.ok ? r.json() : []).catch(() => []),
  ]);
  const cards: Record<string, any> = {};
  home.shelves.forEach((s: any) => s.cards.forEach((c: any) => { cards[c.id] = c; }));
  const over: Record<string, any> = {};
  overrides.forEach((o: any) => { over[o.toy_id] = o; });
  const left: Record<string, number> = {};
  (counts || []).forEach((c: any) => { left[c.toy] = Math.max(0, c.spots - Number(c.used || 0)); });

  const sent: Record<string, number> = {};
  let budget = 300;
  for (const toy of rel.toys) {
    if (toy.playableNow) continue;
    const d = decide(toy, now, over[toy.id]);
    let kind: 'day_before' | 'launch' | null = null;
    if (toy.ready && !d.released && !isNaN(d.at) && d.at > now && d.at - now <= 26 * HOUR) kind = 'day_before';
    if (d.released && now >= d.liveAt && now - d.liveAt < 12 * HOUR) kind = 'launch';
    if (!kind) continue;
    const col = kind === 'day_before' ? 'sent_day_before' : 'sent_launch';
    const rows = await db(`release_notify?toy_id=eq.${encodeURIComponent(toy.id)}&${col}=is.null&select=id,email&order=id&limit=${budget}`).then((r) => r.ok ? r.json() : []);
    const card = cards[toy.id] || {};
    const t = {
      id: toy.id,
      title: card.title || toy.id,
      hook: toy.hook || card.blurb || '',
      link: kind === 'launch' && card.path ? `${site}/${card.path}` : `${site}/soon/?toy=${toy.id}`,
      at: d.at,
    };
    for (const row of rows) {
      const unsub = `${fnUrl}?unsub=${row.id}.${await hmac('unsub:' + row.id)}`;
      const m = email(kind, t, left[toy.id] ?? null, site, unsub);
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [row.email], subject: m.subject, html: m.html, text: m.text, headers: { 'List-Unsubscribe': `<${unsub}>` } }),
      });
      if (!r.ok) continue;
      await db(`release_notify?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ [col]: new Date(now).toISOString() }) });
      sent[`${toy.id}:${kind}`] = (sent[`${toy.id}:${kind}`] || 0) + 1;
      if (--budget <= 0) break;
    }
    if (budget <= 0) break;
  }
  // Keep the list only as long as needed: 90 days after the launch email.
  await db(`release_notify?sent_launch=lt.${new Date(now - 90 * 24 * HOUR).toISOString()}`, { method: 'DELETE' });
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
