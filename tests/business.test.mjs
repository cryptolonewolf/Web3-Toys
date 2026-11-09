// For Projects: Test Your Product (Part 4).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const json = (f) => JSON.parse(read(f));

describe('Test Your Product', () => {
  const tiers = json('data/business/test_tiers.json');
  const sql = read('supabase/016_tests.sql');
  const testers = read('js/biz-testers.js');

  it('keeps the tester rank the same in ranks.json, test_tiers.json, the database and the page', () => {
    const rank = json('data/ranks.json').ranks.find((r) => r.name === tiers.minRank);
    assert.ok(rank, tiers.minRank);
    assert.match(sql, new RegExp('tester_min_certificates\\(\\) returns int language sql immutable as \\$\\$ select ' + rank.min + ' \\$\\$'));
    assert.match(testers, new RegExp('function minCerts\\(\\) \\{ return ' + rank.min + '; \\}'));
  });

  it('has dollar prices, a 50% deposit, and a 25% tester pool', () => {
    assert.equal(tiers.currency, 'USD');
    assert.equal(tiers.deposit, 0.5);
    assert.equal(tiers.testerShare, 0.25);
    tiers.tiers.forEach((t) => { assert.ok(t.price > 0 && t.testers > 0, t.id); });
  });

  it('asks for all four safety rules on the page and in the database', () => {
    const page = json('data/business/testers_page.json');
    assert.deepEqual(page.safety.map((s) => s.id).sort(), ['noFunds', 'noSeed', 'stop', 'testnet']);
    ['testnet', 'noFunds', 'noSeed', 'stop'].forEach((k) => assert.ok(sql.includes(`p_safety ->> '${k}'`), k));
  });

  it('refuses recovery phrases and private keys in the page and the database', () => {
    assert.ok(sql.includes("([a-z]{3,8} ){11,}[a-z]{3,8}") && sql.includes('[0-9a-f]{64}'));
    assert.ok(testers.includes('/([a-z]{3,8} ){11,}[a-z]{3,8}/') && testers.includes('/[0-9a-f]{64}/'));
  });

  it('writes tests only through functions, and screenshots stay private', () => {
    assert.ok(!/create policy[^;]*on public\.[a-z_]+ for (insert|update|delete|all)/i.test(sql));
    assert.match(sql, /'test-shots', 'test-shots', false/);
    assert.ok(!/token reward/i.test(read('data/business/testers_page.json')));
  });

  it('labels the sample report as made-up data', () => {
    const ctx = { window: {} };
    vm.runInNewContext(read('js/test-report.js'), ctx);
    const P = json('data/business/test_page.json');
    const R = ctx.window.Web3TestReport.build(P.sample.test, P.sample.runs);
    assert.equal(R.testers, 3);
    assert.equal(R.tasks[0].rate, 100);
    assert.equal(R.worst.title, P.sample.test.tasks[3].title);
    assert.match(ctx.window.Web3TestReport.html(P.sample.test, P.sample.runs, { sample: true }), /Sample report · made-up data/);
  });

  it('has tester terms and privacy sections the join form links to', () => {
    ['terms', 'privacy'].forEach((d) => assert.ok(json('data/legal/' + d + '.json').sections.some((s) => s.id === 'testers'), d));
    assert.ok(testers.includes('../terms/#testers') && testers.includes('../privacy/#testers'));
  });
});

describe('Sponsored rounds', () => {
  const file = json('data/business/sponsored_rounds.json');
  const roundToys = json('data/business/ad_slots.json').roundToys;
  const flags = read('data/scam-game.js');

  it('every round is in a round toy, labelled with a sponsor and an https link', () => {
    file.rounds.forEach((r) => {
      assert.ok(roundToys.includes(r.toy), r.id);
      assert.ok(['lesson', 'scam'].includes(r.kind), r.id);
      assert.ok(r.sponsor && /^https:\/\//.test(r.link), r.id);
      assert.equal(typeof r.approved, 'boolean', r.id);
      if (r.until) assert.match(r.until, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('lesson rounds have points, scam rounds a full scenario with known red flags', () => {
    file.rounds.filter((r) => r.kind === 'lesson').forEach((r) => assert.ok(r.title && (r.points || r.text), r.id));
    file.rounds.filter((r) => r.kind === 'scam').forEach((r) => {
      const s = r.scenario;
      assert.equal(r.toy, 'scam');
      assert.ok(s && s.body && s.explain && ['scam', 'legit'].includes(s.answer), r.id);
      (s.flags || []).forEach((f) => assert.ok(flags.includes(`id: '${f}'`), f));
    });
  });

  it('shows "Sponsored round by" wherever a round appears, and never promotes tokens', () => {
    assert.ok(read('js/player.js').includes('Sponsored round by '));
    assert.equal((read('js/scam-app.js').match(/Sponsored round by /g) || []).length, 2);
    assert.ok(!/\b(buy|airdrop|presale|100x|moon)\b/i.test(JSON.stringify(file.rounds.map((r) => [r.title, r.points, r.text]))));
  });
});

describe('Operations home', () => {
  const O = json('data/ops.json');
  const sql = read('supabase/017_ops.sql');
  const admin = read('js/admin.js');

  it('every queue card is filled by the database and opens a real tab', () => {
    O.queues.forEach((q) => {
      assert.ok(sql.includes(`'id', '${q.id}'`), q.id);
      const tab = q.open.split(':')[0];
      assert.ok(admin.includes(`['${tab}', `), q.open);
    });
    const ids = [...sql.matchAll(/jsonb_build_object\('id', '([a-z]+)'/g)].map((m) => m[1]);
    assert.deepEqual(ids.slice().sort(), O.queues.map((q) => q.id).sort());
  });

  it('opens on the Operations tab, and inbox sections exist', () => {
    assert.match(admin, /var tab = hash\[0\] \|\| 'ops'/);
    const ops = read('js/admin-ops.js');
    O.queues.filter((q) => q.open.startsWith('inbox:')).forEach((q) => assert.ok(ops.includes(`['${q.open.split(':')[1]}', `), q.open));
  });

  it('colours by age: green under 24 h, amber under 72 h, red after', () => {
    const ctx = { window: {}, localStorage: { getItem: () => null } };
    vm.runInNewContext(read('js/admin-ops.js'), ctx);
    const H = 36e5, ago = (h) => new Date(Date.now() - h * H).toISOString();
    const L = ctx.window.Web3AdminOps;
    assert.deepEqual([[1, 2], [3, 30], [1, 80], [0, null]].map(([count, h]) => L.level({ count, oldest: h && ago(h) }, O.hours)), ['green', 'amber', 'red', 'clear']);
    const sorted = L.sortQueues([{ id: 'a', count: 1, oldest: ago(2) }, { id: 'b', count: 0 }, { id: 'c', count: 2, oldest: ago(100) }, { id: 'd', count: 1, oldest: ago(30) }], O.hours);
    assert.deepEqual(sorted.map((q) => q.id), ['c', 'd', 'a', 'b']);
  });

  it('every setup check in the to-do list can be answered', () => {
    const auto = ['razorpay-live', 'resend', 'social', 'books', 'portraits', 'audience', 'review', 'business-live', 'manual'];
    O.todo.forEach((t) => {
      if (/^sql-/.test(t.check)) assert.ok(sql.includes(`'${t.check}'`), t.id);
      else if (/^fn:/.test(t.check)) {
        const [, name, v] = t.check.split(':');
        const src = read(`supabase/functions/${name}/index.ts`);
        assert.match(src, new RegExp(`const VERSION = ${v};`), t.id);
        assert.ok(src.includes("searchParams.get('ping')"), t.id);
      } else assert.ok(auto.includes(t.check), t.id);
    });
  });

  it('the audit log is written by the database for every queue table', () => {
    ['biz_requests', 'sponsor_bookings', 'test_runs', 'project_requests', 'orders', 'quest_proofs', 'referrals', 'refund_requests', 'contact_messages', 'product_tests', 'review_approvals', 'release_overrides']
      .forEach((t) => assert.ok(sql.includes(`'${t}'`), t));
    assert.ok(read('supabase/functions/admin-refund/index.ts').includes("db('admin_audit'"));
    assert.ok(!/create policy[^;]*admin_audit for (insert|update|delete|all)/i.test(sql));
  });

  it('keeps the link check list up to date and never visits the scam examples', async () => {
    const { build } = await import('../tools/link-list.mjs');
    assert.deepEqual(json('data/link-check.json'), JSON.parse(JSON.stringify(build())));
    const all = JSON.stringify(json('data/link-check.json'));
    ['uniswap-claim', 'b1nance', 'bit.ly', 'justpaste'].forEach((bad) => assert.ok(!all.includes(bad), bad));
  });
});
