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
