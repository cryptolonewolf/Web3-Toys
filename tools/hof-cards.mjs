// Makes the X preview image for every Hall of Fame person:
// images/people/cards/ID.png (1200 x 675), drawn by js/hof-card.js.
// Needs Playwright and the local preview running:
//   CERT_SECRET=test PORT=3001 node tools/dev-server.mjs
//   node tools/hof-cards.mjs [http://localhost:3001]
// Run it again after adding portraits.

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.argv[2] || 'http://localhost:3001';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const data = JSON.parse(readFileSync(root + 'data/hall-of-fame-people.json', 'utf8'));
const cats = Object.fromEntries(data.categories.map((c) => [c.id, c]));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + '/hall-of-fame/' + data.people[0].id + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.Web3HofCard);
mkdirSync(root + 'images/people/cards', { recursive: true });
for (const p of data.people) {
  const url = await page.evaluate(([person, cat]) => {
    const c = document.createElement('canvas');
    return window.Web3HofCard.draw(c, person, cat, { root: '../../' }).then(() => c.toDataURL('image/png'));
  }, [p, cats[p.cat]]);
  writeFileSync(root + `images/people/cards/${p.id}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
console.log(`Made ${data.people.length} cards in images/people/cards/.`);
