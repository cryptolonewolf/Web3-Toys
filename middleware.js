// Vercel middleware: keeps scheduled toys locked on the server until their
// release time, so nobody can play early by typing the address. A locked
// toy's folder sends visitors to its teaser page (soon/?toy=...).
// The schedule is data/releases.json; Release now / Delay from the admin
// dashboard are read from Supabase (release_overrides) with the secret key
// already set in Vercel (SUPABASE_URL, SUPABASE_SECRET_KEY).
// When you add a new scheduled toy, add its folder to matcher below (the
// automatic checks remind you).

export const config = {
  matcher: [
    '/crypto-in-5/:path*',
    '/scam/:path*',
    '/invest-100/:path*',
    '/dead-projects/:path*',
    '/builder/tokenomics/:path*',
    '/web3-hacks/:path*',
    '/dont-lose-money/:path*',
    '/builder/pitch-deck/:path*',
    '/builder/launch-budget/:path*',
    '/token-split/:path*',
    '/builder/kol-scorecard/:path*',
    '/getting-started/:path*',
    '/builder/links-checker/:path*',
    '/earn-small/:path*',
    '/builder/launch-checklist/:path*',
    '/builder/cap-table/:path*',
    '/builder/agreements/:path*',
    '/builder/airdrop-planner/:path*',
    '/builder/mcap-fdv/:path*',
    '/builder/gas-converter/:path*',
    '/builder/meme-kit/:path*',
    '/web3-roles/:path*',
    '/tokenomics-basics/:path*',
    '/ways-to-moon/:path*',
    '/first-job/:path*',
    '/raise-first-round/:path*',
  ],
};

const DAY = 864e5;

// Same as expand() and decide() in js/releases.js (the checks compare them).
export function expand(rel) {
  var when = {};
  (rel.schedule || []).forEach(function (s) {
    (s.items || []).forEach(function (n) { when[n] = { date: s.date + 'T10:00:00+05:30', only: s.onlyIfReady === true }; });
  });
  (rel.toys || []).forEach(function (t) {
    var w = when[t.name || t.id];
    if (rel.schedule) t.date = w ? w.date : null;
    t.onlyIfReady = Boolean(w && w.only);
    t.playableNow = t.openNow === true || (!rel.schedule && t.playableNow === true);
  });
  return rel;
}

export function decide(toy, nowMs, override, newDays) {
  var at = toy.date ? Date.parse(toy.date) : NaN;
  var o = override || null;
  if (o && o.action === 'delay') at = o.until ? Date.parse(o.until) : NaN;
  var on = Boolean(toy.ready) && (!toy.onlyIfReady || Boolean(o && (o.ready === true || o.action === 'release')));
  var released;
  if (!on) released = false;
  else if (o && o.action === 'release') released = true;
  else if (o && o.action === 'delay') released = !isNaN(at) && nowMs >= at;
  else released = Boolean(toy.playableNow) || (!isNaN(at) && nowMs >= at);
  // When did it go live, for the New sticker.
  var liveAt = o && o.action === 'release' ? Math.min(Date.parse(o.updated_at || '') || at, isNaN(at) ? Infinity : at) : at;
  var status = released ? 'live'
    : (o && o.action === 'delay') || (!on && !isNaN(at) && nowMs >= at) ? 'delayed' : 'locked';
  return {
    status: status,
    at: isNaN(at) ? null : new Date(at),
    isNew: released && !toy.playableNow && nowMs >= liveAt && nowMs - liveAt < (newDays || 7) * DAY,
    toy: toy,
  };
}

async function override(id) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) return null;
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  try {
    const r = await fetch(`${url}/rest/v1/release_overrides?toy_id=eq.${encodeURIComponent(id)}&select=*`, { headers });
    if (!r.ok) return null;
    return (await r.json())[0] || null;
  } catch {
    return null;
  }
}

// Your private preview: open a locked toy once with ?preview=YOUR_KEY (the
// PREVIEW_KEY setting in Vercel) and this browser can play locked toys for
// 30 days. Without PREVIEW_KEY set, there is no preview.
function previewOk(request, url) {
  const key = process.env.PREVIEW_KEY || '';
  if (key.length < 12) return { ok: false };
  if (url.searchParams.get('preview') === key) {
    const clean = new URL(url);
    clean.searchParams.delete('preview');
    return { ok: true, response: new Response(null, { status: 307, headers: {
      Location: clean.toString(),
      'Set-Cookie': `w3preview=${encodeURIComponent(key)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    } }) };
  }
  const cookie = request.headers.get('cookie') || '';
  return { ok: cookie.split(/;\s*/).includes(`w3preview=${encodeURIComponent(key)}`) };
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const preview = previewOk(request, url);
  if (preview.response) return preview.response;
  // Your preview: with the preview key, a preview date (admin, Releases tab)
  // locks and unlocks as on that date; with no date, everything opens.
  const cookie = request.headers.get('cookie') || '';
  const asOf = Number((cookie.match(/(?:^|;\s*)w3previewAt=(\d{10,15})/) || [])[1]);
  if (preview.ok && !(asOf > 0)) return;
  const path = url.pathname.replace(/^\/+/, '');
  let id = '';
  try {
    const rel = expand(await (await fetch(new URL('/data/releases.json', url))).json());
    const toy = rel.toys.find((t) => {
      const p = String(t.path || t.id + '/').replace(/\/$/, '');
      return path === p || path.startsWith(p + '/');
    });
    if (!toy) return; // not scheduled: carry on as normal
    id = toy.id;
    const now = preview.ok ? asOf : Date.now();
    if (decide(toy, now, await override(toy.id), rel.newDays).status === 'live') return;
  } catch {
    // Could not check: keep it locked.
  }
  return Response.redirect(new URL(`/soon/?toy=${encodeURIComponent(id || path.split('/')[0])}`, url), 307);
}
