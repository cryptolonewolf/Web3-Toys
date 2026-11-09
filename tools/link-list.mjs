// Builds data/link-check.json: every page of the site (each folder with an
// index.html) and every outside https link found in the pages and data files.
// The weekly link check (supabase/functions/ops-check) visits this list.
// Run: node tools/link-list.mjs   (a test checks it is up to date)

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'data/link-check.json');
const SKIP = new Set(['node_modules', '.git', 'tests', 'tools', 'docs', 'supabase', 'admin', 'marketing', 'assets', 'images', 'styles', 'js', 'api']);
// Pages that only work with a code or a login, or that are not public.
const SKIP_PAGES = new Set(['/verify/', '/advertise/stats/']);
// Files whose links are examples, not real links: scam messages used in the
// toys (never visit those), regex rules and price data sources.
const SKIP_FILES = /(^|\/)(test_messages|scam_rules|scam-[a-z-]+|link-check|review-index)\.json$|\/data\/prices\//;
// Hosts that refuse automatic checks (they answer bots with errors), and
// placeholders used in examples.
const SKIP_HOSTS = /^(x\.com|twitter\.com|www\.linkedin\.com|linkedin\.com|t\.me|example\.com|www\.example\.com|[a-z0-9-]+\.example)$/i;

function walk(dir, out) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP.has(n) && !n.startsWith('.')) walk(p, out); }
    else out.push(p);
  }
  return out;
}

export function build() {
  const all = walk(ROOT, []);
  const pages = all.filter((p) => p.endsWith('index.html')).map((p) => '/' + relative(ROOT, p).replace(/\\/g, '/').replace(/index\.html$/, ''))
    .filter((p) => !SKIP_PAGES.has(p)).sort();
  const links = new Map(); // url -> where it was first found
  for (const p of all.filter((x) => /\.(html|json)$/.test(x) && !SKIP_FILES.test(x.replace(/\\/g, '/')))) {
    const text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(/https:\/\/[^\s"'<>)\\]+/g)) {
      let u = m[0].replace(/[.,;]+$/, '');
      let host;
      try { host = new URL(u).hostname; } catch { continue; }
      if (host === 'web3.toys' || host.endsWith('.web3.toys') || SKIP_HOSTS.test(host)) continue;
      if (/fonts\.(googleapis|gstatic)\.com|supabase\.co|checkout\.razorpay\.com|cdn\.|unpkg\.com/.test(host)) continue;
      if (/[${}()\\|^]|%7B/.test(u)) continue;
      if (!links.has(u)) links.set(u, '/' + relative(ROOT, p).replace(/\\/g, '/').replace(/index\.html$/, ''));
    }
  }
  return { _help: 'Made by tools/link-list.mjs. Do not edit by hand. The weekly link check (ops-check) visits these pages and links.', pages, links: [...links.keys()].sort().map((u) => [u, links.get(u)]) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, JSON.stringify(build(), null, 1) + '\n');
  const b = build();
  console.log(`data/link-check.json: ${b.pages.length} pages, ${b.links.length} links`);
}
