// ops-digest: the daily Operations email to you, at 9:00 India time
// (supabase/018_ops_schedule.sql). It has the queue counts, anything red
// (waiting more than 72 hours) and yesterday's numbers, and links to the
// admin Operations home. No email when every queue is empty.
// Secrets in Supabase: RESEND_API_KEY, CRON_SECRET (the same password as in
// 018_ops_schedule.sql), OPS_EMAIL (where it goes; hi@web3.toys if missing),
// OPS_FROM (the sender; LAUNCH_FROM or RECEIPT_FROM if missing) and SITE_URL
// (optional, https://web3.toys by default).
// In Supabase, switch OFF "Verify JWT" for this function.
// Send one now to try it: POST with {"force": true} and the x-cron-key header.

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'ops-digest';
const VERSION = 1;
const HOUR = 36e5;

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}
const db = (path: string, init: RequestInit = {}) => fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(), ...((init.headers as Record<string, string>) || {}) } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function age(iso: string | null, now: number) {
  if (!iso) return '';
  const h = (now - Date.parse(iso)) / HOUR;
  return h < 48 ? `${Math.max(1, Math.floor(h))} h` : `${Math.floor(h / 24)} days`;
}

// The email, from ops_data() and data/ops.json. null when nothing waits.
export function digest(D: any, O: any, site: string, now: number, force = false) {
  const meta: Record<string, any> = {};
  O.queues.forEach((q: any) => { meta[q.id] = q; });
  const queues = O.queues.map((m: any) => D.queues.find((q: any) => q.id === m.id) || { id: m.id, count: 0 })
    .map((q: any) => ({ ...q, hours: q.oldest ? (now - Date.parse(q.oldest)) / HOUR : 0 }))
    .sort((a: any, b: any) => b.hours - a.hours);
  const waiting = queues.filter((q: any) => Number(q.count) > 0);
  if (!waiting.length && !force) return null;
  const red = waiting.filter((q: any) => q.hours >= O.hours.red);
  const amber = waiting.filter((q: any) => q.hours >= O.hours.amber && q.hours < O.hours.red);
  const total = waiting.reduce((s: number, q: any) => s + Number(q.count), 0);
  const y = D.numbers.yesterday || {};
  const H = D.health || {};
  const healthBits = [
    H.errors ? `${H.errors} page errors in 24 h` : '',
    H.webhook ? `${H.webhook} payment webhook failures this week` : '',
    (H.links || []).length ? `${H.links.length} broken links` : '',
    ((H.slow || []).length + (H.slowCheck || []).length) ? `${(H.slow || []).length + (H.slowCheck || []).length} slow pages` : '',
  ].filter(Boolean);
  const admin = `${site}/admin/`;
  const dot = (q: any) => (q.hours >= O.hours.red ? '🔴' : q.hours >= O.hours.amber ? '🟠' : '🟢');
  const subject = `web3.toys today: ${total} waiting${red.length ? `, ${red.length} overdue` : ''}`;
  const row = (q: any) => `<tr><td style="padding:6px 8px">${dot(q)} ${esc(meta[q.id].label)}</td><td style="padding:6px 8px;text-align:right;font-weight:bold">${q.count}</td><td style="padding:6px 8px;color:#5A5470">${esc(age(q.oldest, now))}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8E1;font-family:Arial,Helvetica,sans-serif;color:#1F1B2E">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:bold;margin:0 0 4px">web3.toys · Operations</p>
<p style="margin:0 0 16px;color:#5A5470">${esc(new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }))}</p>
${red.length ? `<div style="background:#FFE3DF;border:2px solid #1F1B2E;border-radius:12px;padding:10px 14px;margin:0 0 14px"><b>Overdue (more than ${O.hours.red} hours):</b><br>${red.map((q: any) => `${esc(meta[q.id].label)}: ${q.count}, oldest ${esc(age(q.oldest, now))}`).join('<br>')}</div>` : ''}
<table style="width:100%;border-collapse:collapse;background:#fff;border:2px solid #1F1B2E;border-radius:12px">${waiting.length ? waiting.map(row).join('') : '<tr><td style="padding:10px">Nothing waiting. 🎉</td></tr>'}</table>
<p style="margin:18px 0 6px;font-weight:bold">Yesterday</p>
<p style="margin:0;line-height:1.6">🎮 ${Number(y.plays || 0).toLocaleString('en-US')} plays · 🙋 ${y.accounts || 0} new accounts · 📧 ${y.signups || 0} email signups · 🎓 ${y.certificates || 0} certificates</p>
${healthBits.length ? `<p style="margin:14px 0 0">🩺 ${esc(healthBits.join(' · '))}</p>` : ''}
<p style="margin:22px 0"><a href="${admin}" style="background:#1F1B2E;color:#FFD93D;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Open Operations</a></p>
<p style="font-size:12px;color:#5A5470">Sent every day at 9:00 India time when something is waiting. Change it in data/ops.json and the OPS_EMAIL secret.</p>
</div></body></html>`;
  const text = [subject, '', ...(red.length ? ['OVERDUE:', ...red.map((q: any) => `- ${meta[q.id].label}: ${q.count}, oldest ${age(q.oldest, now)}`), ''] : []),
    ...waiting.map((q: any) => `${meta[q.id].label}: ${q.count} (oldest ${age(q.oldest, now)})`), '',
    `Yesterday: ${y.plays || 0} plays, ${y.accounts || 0} new accounts, ${y.signups || 0} email signups, ${y.certificates || 0} certificates`,
    ...(healthBits.length ? ['Site health: ' + healthBits.join(', ')] : []), '', admin].join('\n');
  return { subject, html, text, waiting: total, red: red.length, amber: amber.length };
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, email: !!env('RESEND_API_KEY') }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('CRON_SECRET') || req.headers.get('x-cron-key') !== env('CRON_SECRET')) return new Response('Not allowed.', { status: 401 });
  const from = env('OPS_FROM') || env('LAUNCH_FROM') || env('RECEIPT_FROM');
  if (!env('RESEND_API_KEY') || !from) return new Response('Emails are not set up yet.', { status: 503 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const [O, index, approvals] = await Promise.all([
    fetch(`${site}/data/ops.json`).then((r) => r.json()),
    fetch(`${site}/data/review-index.json`).then((r) => r.json()).catch(() => ({ items: [] })),
    db('review_approvals?select=file,item,hash').then((r) => (r.ok ? r.json() : [])),
  ]);
  const ok: Record<string, string> = {};
  approvals.forEach((a: any) => { ok[a.file + '|' + a.item] = a.hash; });
  const pending = index.items.filter((it: any) => ok[it.file + '|' + it.item] !== it.hash).map((it: any) => it.hash);
  const D = await db('rpc/ops_data', { method: 'POST', body: JSON.stringify({ p_review: pending }) }).then((r) => (r.ok ? r.json() : null));
  if (!D) return new Response('Could not read the queues. Has supabase/017_ops.sql been run?', { status: 500 });
  const m = digest(D, O, site, Date.now(), body.force === true);
  if (!m) return new Response(JSON.stringify({ sent: false, reason: 'every queue is empty' }), { headers: { 'Content-Type': 'application/json' } });
  const to = env('OPS_EMAIL') || (O.digest && O.digest.to) || 'hi@web3.toys';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: m.subject, html: m.html, text: m.text }),
  });
  return new Response(JSON.stringify({ sent: r.ok, waiting: m.waiting, red: m.red }), { status: r.ok ? 200 : 502, headers: { 'Content-Type': 'application/json' } });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
