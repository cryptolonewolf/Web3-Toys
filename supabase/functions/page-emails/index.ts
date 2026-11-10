// page-emails: reminds page owners before their Pro ends (14 and 3 days
// before, from data/business/pages.json pro.remindDays), with an offer to
// renew through a new toy, course or test. Each reminder goes out once.
// Runs every day (supabase/018_ops_schedule.sql). Secrets in Supabase:
// RESEND_API_KEY, CRON_SECRET, PAGES_FROM (the sender; OPS_FROM, LAUNCH_FROM
// or RECEIPT_FROM if missing) and SITE_URL (optional).
// In Supabase, switch OFF "Verify JWT" for this function.

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'page-emails';
const VERSION = 1;

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}
const db = (path: string, init: RequestInit = {}) => fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(), ...((init.headers as Record<string, string>) || {}) } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function reminder(r: { handle: string; name: string; pro_until: string; days: number }, site: string) {
  const end = new Date(r.pro_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const subject = r.days <= 3 ? `Your web3.toys Pro ends in ${r.days} days` : `Your web3.toys Pro ends on ${end}`;
  const link = (path: string) => `${site}/${path}`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8E1;font-family:Arial,Helvetica,sans-serif;color:#1F1B2E">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:bold;margin:0 0 16px">web3.toys</p>
<h1 style="font-size:22px;margin:0 0 10px">Pro for ${esc(r.name)} ends on ${esc(end)}</h1>
<p style="font-size:15px;line-height:1.5">After that, web3.toys/@${esc(r.handle)} stays free and live, but detailed analytics, the fan export, the directory spot, embed codes and the sponsor-free page switch off.</p>
<p style="font-size:15px;line-height:1.5">Pro comes with what you build on web3.toys. Keep it going with:</p>
<ul style="font-size:15px;line-height:1.6">
<li><a href="${link('launch-your-toy/')}">A new toy</a> (Mini Toy 3 months, Full Game 6, Launch Tournament 12)</li>
<li><a href="${link('academy/list-your-project/')}">An Academy course</a> (3 months)</li>
<li><a href="${link('test-your-product/')}">A product test</a> with real players</li>
</ul>
<p style="margin:20px 0"><a href="${link('book-a-call/')}" style="background:#1F1B2E;color:#FFD93D;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Book a call</a></p>
<p style="font-size:12px;color:#5A5470">You get this because you own web3.toys/@${esc(r.handle)} and it has Pro. Build With Aki, Dehradun, Uttarakhand, India.</p>
</div></body></html>`;
  const text = `Pro for ${r.name} ends on ${end}.\n\nAfter that, web3.toys/@${r.handle} stays free and live, but the Pro extras switch off.\nKeep it going with a new toy (${link('launch-your-toy/')}), an Academy course (${link('academy/list-your-project/')}) or a product test (${link('test-your-product/')}).\n\nBook a call: ${link('book-a-call/')}`;
  return { subject, html, text };
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, email: !!env('RESEND_API_KEY') }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('CRON_SECRET') || req.headers.get('x-cron-key') !== env('CRON_SECRET')) return new Response('Not allowed.', { status: 401 });
  const from = env('PAGES_FROM') || env('OPS_FROM') || env('LAUNCH_FROM') || env('RECEIPT_FROM');
  if (!env('RESEND_API_KEY') || !from) return new Response('Emails are not set up yet.', { status: 503 });
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const P = await fetch(`${site}/data/business/pages.json`).then((r) => r.json()).catch(() => ({ pro: { remindDays: [14, 3] } }));
  const due = await db('rpc/pro_reminders_due', { method: 'POST', body: JSON.stringify({ p_days: P.pro.remindDays || [14, 3] }) }).then((r) => (r.ok ? r.json() : []));
  let sent = 0;
  for (const r of due) {
    if (!r.email) continue;
    const m = reminder(r, site);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [r.email], subject: m.subject, html: m.html, text: m.text }),
    });
    if (!res.ok) continue;
    await db('page_pro_reminders', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ page_id: r.page_id, pro_until: r.pro_until, days: r.days }) });
    sent += 1;
  }
  return new Response(JSON.stringify({ due: due.length, sent }), { headers: { 'Content-Type': 'application/json' } });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
