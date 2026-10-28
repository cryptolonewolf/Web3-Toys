// Checks for the design upgrade: every page has the menu bar and the same
// fonts, toy looks are complete, and the shop, books, Real Toys, About and
// Book a Call content files are filled in. Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

const PAGES = ['index.html', ...readdirSync(new URL('../', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory() && exists(`${d.name}/index.html`))
  .map((d) => `${d.name}/index.html`)];

describe('every page', () => {
  it('includes the new pages', () => {
    for (const p of ['real-toys', 'books', 'about', 'book-a-call']) assert.ok(PAGES.includes(`${p}/index.html`), p);
  });

  for (const page of PAGES) {
    it(`${page}: menu bar, shared script and at most 6 fonts`, () => {
      const html = read(page);
      assert.match(html, /id="topbar"/);
      assert.match(html, /js\/site\.js/);
      const fonts = html.match(/fonts\.googleapis\.com\/css2\?([^"]+)/)[1].match(/family=/g);
      assert.ok(fonts.length <= 6, `${fonts.length} fonts`);
      assert.doesNotMatch(html, /chimpx/i);
    });
  }
});

describe('toy looks', () => {
  const FONTS = ['luckiest', 'bungee', 'bangers', 'chewy'];
  const ACCENTS = ['blue', 'mint', 'coral', 'violet', 'yellow'];
  const home = json('data/home.json');
  const built = home.shelves.flatMap((s) => s.cards).filter((c) => c.status === 'live' && c.kind !== 'game');

  it('each built toy has its own name, font and colour', () => {
    assert.equal(new Set(built.map((c) => c.font)).size, built.length);
    assert.equal(new Set(built.map((c) => c.accent)).size, built.length);
    for (const c of built) {
      assert.ok(FONTS.includes(c.font) && ACCENTS.includes(c.accent) && c.topic, c.id);
      const html = read(`${c.id}/index.html`);
      assert.ok(html.includes(`data-font="${c.font}"`) && html.includes(`data-accent="${c.accent}"`), `${c.id} page look`);
    }
  });

  it('every home card has a colour, a placeholder object and a blurb', () => {
    const covers = read('js/covers.js');
    const colors = ['yellow', 'blue', 'coral', 'mint', 'violet', 'orange', 'pink', 'teal'];
    const ids = home.shelves.flatMap((s) => s.cards.map((c) => c.id));
    assert.equal(new Set(ids).size, ids.length, 'card ids must be unique');
    for (const c of home.shelves.flatMap((s) => s.cards)) {
      assert.ok(colors.includes(c.color), `${c.id}: color ${c.color}`);
      assert.ok(new RegExp(`\\b${c.object}:`).test(covers), `${c.id}: object ${c.object}`);
      assert.ok(c.blurb, `${c.id}: blurb`);
      assert.ok(new RegExp(`\\b${c.pattern}:`).test(covers), `${c.id}: pattern ${c.pattern}`);
      assert.ok(['tape', 'notch', 'corner', 'stamp', 'pin', 'round'].includes(c.edge), `${c.id}: edge ${c.edge}`);
    }
    const looks = home.shelves.flatMap((s) => s.cards.map((c) => `${c.color} ${c.pattern}`));
    assert.equal(new Set(looks).size, looks.length, 'every card needs its own colour and pattern pair');
  });

  it('the five new toys are on the home page as coming soon', () => {
    const where = { 'web3-hacks': 'beginners', 'hall-of-fame': 'degens', 'ways-to-moon': 'pros', 'dead-projects': 'games', 'invest-100': 'games' };
    for (const [id, shelfId] of Object.entries(where)) {
      const s = home.shelves.find((x) => x.id === shelfId);
      const c = s.cards.find((x) => x.id === id);
      assert.ok(c && (c.status || s.status) === 'soon', id);
    }
  });

  it('mascot pictures in config.js exist', () => {
    const paths = read('config.js').match(/assets\/mascot\/[\w.-]+/g);
    assert.ok(paths.length >= 4);
    for (const p of paths) assert.ok(exists(p), p);
    assert.ok(exists('assets/mascot/placeholder.svg'));
  });
});

describe('content for the shop and new pages', () => {
  const item = (x, where) => {
    assert.ok(x.title && x.price && 'url' in x, `${where}: ${x.title}`);
    if (x.cover) assert.ok(exists(x.cover), x.cover);
  };

  it('shop.json: every toy page has items', () => {
    const shop = json('data/shop.json');
    for (const id of ['crypto-in-5', 'getting-started', 'dont-lose-money', 'earn-small', 'scam']) {
      const list = shop.toys[id] || shop.default;
      assert.ok(list.length, id);
      list.forEach((x) => { item(x, id); assert.ok(['Report', 'Book', 'Service'].includes(x.kind), x.kind); });
    }
  });

  it('books.json, real-toys.json, about.json and book-a-call.json are complete', () => {
    json('data/books.json').books.forEach((b) => item(b, 'books'));
    const real = json('data/real-toys.json');
    assert.deepEqual(real.concepts.map((c) => c.name), ['HODL Plush', 'Seed Vault', 'Block Stack']);
    real.concepts.forEach((c) => assert.ok(exists(c.cover) && c.points.length, c.name));
    assert.ok(real.form.heading && real.form.button);
    assert.ok(json('data/about.json').paragraphs.length);
    const call = json('data/book-a-call.json');
    assert.ok(call.get.length && call.for.length && call.price && call.button);
  });
});
