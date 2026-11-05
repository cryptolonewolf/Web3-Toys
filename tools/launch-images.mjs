// Makes the launch kit images for every toy in data/releases.json, using the
// toy's own home page cover, the hexagon 3 logo and its release date:
//   marketing/launches/img/ID-teaser-x.png      1200 x 675  (X, before)
//   marketing/launches/img/ID-launch-x.png      1200 x 675  (X, launch day)
//   marketing/launches/img/ID-teaser-story.png  1080 x 1920 (stories, before)
//   marketing/launches/img/ID-launch-story.png  1080 x 1920 (stories, launch)
// The launch emails use the -x pictures.
// Needs Playwright and the local preview running:
//   CERT_SECRET=test PORT=3001 node tools/dev-server.mjs
//   node tools/launch-images.mjs [http://localhost:3001]

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.argv[2] || 'http://localhost:3001';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const rel = JSON.parse(readFileSync(root + 'data/releases.json', 'utf8'));
const home = JSON.parse(readFileSync(root + 'data/home.json', 'utf8'));
const cards = {};
home.shelves.forEach((s) => s.cards.forEach((c) => { cards[c.id] = c; }));

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
const out = root + 'marketing/launches/img/';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(base + '/', { waitUntil: 'networkidle' });

for (const t of rel.toys) {
  const c = cards[t.id];
  for (const kind of ['teaser', 'launch']) {
    for (const [fmt, w, h] of [['x', 1200, 675], ['story', 1080, 1920]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(({ c, t, kind, fmt, w, h, when }) => {
        const esc = (s) => String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]);
        const story = fmt === 'story';
        const cardW = story ? 960 : 1000;
        const label = kind === 'teaser' ? (t.playableNow ? 'Launching ' + when : 'Unlocks ' + when) : 'Out now';
        const sub = kind === 'teaser' ? '10:00 India time · free to play' : 'Free to play · Early Bird 2x coins';
        document.body.innerHTML = `<div id="shot" style="position:fixed;inset:0;width:${w}px;height:${h}px;background:#FFF8E1;display:flex;flex-direction:column;align-items:center;justify-content:${story ? 'center' : 'space-between'};gap:${story ? 56 : 0}px;padding:${story ? '80px 60px' : '40px 60px 44px'};box-sizing:border-box;font-family:Fredoka,Nunito,sans-serif;color:#1F1B2E;overflow:hidden">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg, rgba(255,217,61,.22) 0 18px, transparent 18px 40px)"></div>
          <div style="position:relative;display:flex;align-items:center;gap:16px;align-self:${story ? 'center' : 'flex-start'}">
            <img src="images/brand/web3toys-icon.svg" width="${story ? 110 : 72}" height="${story ? 110 : 72}">
            <span style="font:700 ${story ? 64 : 44}px Fredoka,sans-serif">web3.toys</span>
            ${kind === 'teaser' && !story ? '<span style="margin-left:18px;padding:6px 18px;border:3px solid #1F1B2E;border-radius:999px;background:#fff;font:800 24px Nunito,sans-serif">Coming soon</span>' : ''}
          </div>
          <div class="xcard xcard--${esc(c.id)}" style="position:relative;width:${cardW}px;border-radius:40px;${kind === 'teaser' && !t.playableNow ? 'filter:saturate(.85)' : ''}">${window.Web3Cards.card(c.id, c.title, esc) || '<span class="xtitle">' + esc(c.title) + '</span>'}
            ${kind === 'teaser' && !t.playableNow ? '<span style="position:absolute;top:22px;right:26px;width:74px;height:74px;display:grid;place-items:center;font-size:38px;background:#fff;border:4px solid #1F1B2E;border-radius:50%">🔒</span>' : ''}</div>
          <div style="position:relative;text-align:center;display:grid;gap:${story ? 22 : 8}px;justify-items:center;max-width:${story ? 920 : 1080}px">
            <span style="display:inline-block;padding:${story ? '14px 40px' : '8px 28px'};background:${kind === 'launch' ? '#6BCB77' : '#FFD93D'};border:4px solid #1F1B2E;border-radius:999px;box-shadow:6px 6px 0 #1F1B2E;font:700 ${story ? 64 : 40}px Fredoka,sans-serif">${esc(label)}</span>
            <span style="font:800 ${story ? 44 : 28}px/1.3 Nunito,sans-serif">${esc(t.hook)}</span>
            <span style="font:700 ${story ? 34 : 22}px Nunito,sans-serif;color:#4A4560">${esc(sub)} · web3.toys</span>
          </div>
        </div>`;
      }, { c, t, kind, fmt, w, h, when: day(t.date) });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      await page.locator('#shot').screenshot({ path: `${out}${t.id}-${kind}-${fmt}.png` });
    }
  }
}
await browser.close();
console.log(`Made ${rel.toys.length * 4} images in marketing/launches/img/. To make them smaller, run: python3 tools/shrink-png.py marketing/launches/img`);
