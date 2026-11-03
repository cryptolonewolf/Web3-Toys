// Builds data/review-index.json: every item marked "review": true in the
// data files, for the Review queue in the admin dashboard. Each item gets a
// short fingerprint of its content, so editing an item asks for a new review.
// Run: node tools/review-index.mjs   (a test checks it is up to date)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'data/review-index.json');

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : n.endsWith('.json') ? [p] : [];
  });
}

const hash = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12);
const label = (o, fallback) => String(o.title || o.name || o.label || o.question || o.text || o.id || fallback).slice(0, 120);

export function build() {
  const items = [];
  for (const path of files(join(ROOT, 'data')).sort()) {
    const file = relative(ROOT, path).replace(/\\/g, '/');
    if (file === 'data/review-index.json') continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const walk = (node, where) => {
      if (Array.isArray(node)) return node.forEach((x, i) => walk(x, `${where}[${i}]`));
      if (!node || typeof node !== 'object') return;
      if (node.review === true) {
        const top = where === '';
        items.push({
          file,
          item: top ? '(whole file)' : String(node.id || where),
          label: top ? label(node, file) : label(node, where),
          note: String(node.source || node._help || '').slice(0, 200),
          hash: hash(node),
        });
      }
      for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') walk(v, where ? `${where}.${k}` : k);
    };
    walk(data, '');
  }
  return { _help: 'Made by tools/review-index.mjs from every "review": true in data/. Do not edit by hand.', items };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = build();
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`${out.items.length} items to review, written to data/review-index.json`);
}
