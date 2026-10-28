// Tests for the Getting Started toys: quiz marking, certificate codes,
// progress and ranks, and the content files. Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const lib = require('../api/_lib.js');
const progress = require('../js/progress.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

const SECRET = 'test-secret';
const quiz = lib.loadQuiz('crypto-in-5');
const allRight = Object.fromEntries(quiz.questions.map((q) => [q.id, q.options.indexOf(q.answer)]));

describe('quiz server', () => {
  it('sends questions without answers', () => {
    const pub = lib.publicQuiz(quiz);
    const text = JSON.stringify(pub);
    assert.ok(!text.includes('"answer"') && !text.includes('"explain"'));
    assert.equal(pub.timeLimit, 20);
    assert.equal(pub.passMark, 70);
    assert.equal(pub.questions.length, quiz.questions.length);
  });

  it('marks all right as 100 and passes', () => {
    const r = lib.grade(quiz, allRight);
    assert.equal(r.score, 100);
    assert.ok(r.passed);
  });

  it('counts timed out questions as wrong', () => {
    const answers = { ...allRight };
    for (const q of quiz.questions.slice(0, 3)) answers[q.id] = null;
    const r = lib.grade(quiz, answers);
    assert.equal(r.correct, quiz.questions.length - 3);
    assert.ok(r.review.filter((x) => !x.correct).every((x) => x.chosen === null));
  });

  it('passes at 70 percent and fails below', () => {
    const qs = quiz.questions;
    const wrongOf = (q) => (q.options.indexOf(q.answer) + 1) % q.options.length;
    const withWrong = (n) => Object.fromEntries(qs.map((q, i) => [q.id, i < n ? wrongOf(q) : q.options.indexOf(q.answer)]));
    for (let n = 0; n <= qs.length; n++) {
      const r = lib.grade(quiz, withWrong(n));
      assert.equal(r.passed, r.score >= 70, `${n} wrong`);
    }
  });

  it('ignores answers that are not real options', () => {
    const r = lib.grade(quiz, { q1: 99, q2: 'zero' });
    assert.equal(r.correct, 0);
  });

  it('returns nothing for unknown toys', () => {
    assert.equal(lib.loadQuiz('nope'), null);
  });
});

describe('certificate codes', () => {
  const now = Date.UTC(2026, 9, 28, 12);
  const { code, date } = lib.issue(SECRET, quiz, 86, 'Aki Tanaka', now);

  it('look like W3T-XXXX-XXXX-XXXX-XXXX and carry the date', () => {
    assert.match(code, /^W3T-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.equal(date, '2026-10-28');
  });

  it('verify with the same name, ignoring capitals and extra spaces', () => {
    const v = lib.verify(SECRET, code, '  aki   TANAKA ');
    assert.ok(v);
    assert.equal(v.toy, 'crypto-in-5');
    assert.equal(v.score, 86);
    assert.equal(v.date, '2026-10-28');
    assert.equal(lib.verify(SECRET, code.toLowerCase().replace(/-/g, ''), 'Aki Tanaka').code, code);
  });

  it('fail with a different name, a changed character or another key', () => {
    assert.equal(lib.verify(SECRET, code, 'Someone Else'), null);
    const changed = code.slice(0, -1) + (code.endsWith('Z') ? 'Y' : 'Z');
    assert.equal(lib.verify(SECRET, changed, 'Aki Tanaka'), null);
    const higherScore = code.replace(/^(W3T-.{4}-..)(..)/, (m, a) => a + '34');
    assert.equal(lib.verify(SECRET, higherScore, 'Aki Tanaka'), null);
    assert.equal(lib.verify('other-key', code, 'Aki Tanaka'), null);
    assert.equal(lib.verify(SECRET, 'W3T-0000', 'Aki Tanaka'), null);
    assert.equal(lib.verify(SECRET, code, ''), null);
  });

  it('give different codes for different people and scores', () => {
    const a = lib.issue(SECRET, quiz, 86, 'Aki', now).code;
    assert.notEqual(a, lib.issue(SECRET, quiz, 86, 'Bea', now).code);
    assert.notEqual(a, lib.issue(SECRET, quiz, 100, 'Aki', now).code);
  });
});

describe('server functions', () => {
  const call = (handler, req) =>
    new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); },
      };
      handler(req, res);
    });

  it('grade issues a certificate only with a name, a pass and the key', async () => {
    const grade = require('../api/grade.js');
    process.env.CERT_SECRET = SECRET;
    const pass = await call(grade, { method: 'POST', body: { toy: 'crypto-in-5', answers: allRight, name: 'Aki' } });
    assert.ok(pass.body.certificate.code);
    const noName = await call(grade, { method: 'POST', body: { toy: 'crypto-in-5', answers: allRight } });
    assert.equal(noName.body.certificate, undefined);
    const fail = await call(grade, { method: 'POST', body: { toy: 'crypto-in-5', answers: {}, name: 'Aki' } });
    assert.equal(fail.body.passed, false);
    assert.equal(fail.body.certificate, undefined);
    delete process.env.CERT_SECRET;
    const noKey = await call(grade, { method: 'POST', body: { toy: 'crypto-in-5', answers: allRight, name: 'Aki' } });
    assert.match(noKey.body.certificateError, /CERT_SECRET/);
  });

  it('verify confirms a real code', async () => {
    const verify = require('../api/verify.js');
    process.env.CERT_SECRET = SECRET;
    const { code } = lib.issue(SECRET, quiz, 90, 'Aki');
    const ok = await call(verify, { query: { code, name: 'Aki' } });
    assert.equal(ok.body.valid, true);
    const bad = await call(verify, { query: { code, name: 'Bea' } });
    assert.equal(bad.body.valid, false);
    delete process.env.CERT_SECRET;
  });
});

describe('progress and ranks', () => {
  const ranks = json('data/ranks.json').ranks;
  const memory = () => {
    const store = {};
    return { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  };

  it('maps certificate counts to the five ranks', () => {
    const names = [0, 1, 2, 3, 4, 9].map((n) => progress.rankFor(n, ranks).name);
    assert.deepEqual(names, ['Visitor', 'Curious', 'Explorer', 'Navigator', 'Web3 Starter', 'Web3 Starter']);
    assert.equal(progress.nextRank(4, ranks), null);
    assert.equal(progress.nextRank(1, ranks).name, 'Explorer');
  });

  it('saves certificates, keeps the best score and survives broken storage', () => {
    const s = memory();
    let data = progress.load(s);
    progress.addCertificate(data, { toy: 'a', score: 80, name: 'Aki' });
    progress.addCertificate(data, { toy: 'a', score: 72, name: 'Aki' });
    progress.save(s, data);
    data = progress.load(s);
    assert.equal(data.certificates.a.score, 80);
    assert.equal(progress.count(data), 1);
    s.setItem(progress.KEY, '{not json');
    assert.equal(progress.count(progress.load(s)), 0);
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(progress.count(progress.load(throwing)), 0);
    assert.equal(progress.save(throwing, data), false);
  });
});

describe('content files', () => {
  const home = json('data/home.json');
  const index = json('quizzes/index.json').toys;
  const live = home.shelves.filter((s) => s.status === 'live').flatMap((s) => s.cards);
  const TYPES = ['story', 'reveal', 'pick', 'steps', 'trending'];
  const POSES = ['grin', 'thinking', 'worried', 'celebrating'];

  it('has four shelves, only Getting Started live, every card with a time', () => {
    assert.deepEqual(home.shelves.map((s) => s.title), ['Getting Started', 'Career in Web3', 'For Entrepreneurs', 'Play and Learn']);
    assert.deepEqual(home.shelves.map((s) => s.status), ['live', 'soon', 'soon', 'soon']);
    for (const s of home.shelves) for (const c of s.cards) assert.ok(c.title && c.time, c.id);
  });

  it('ranks are in order and start at 0', () => {
    const ranks = json('data/ranks.json').ranks;
    assert.equal(ranks[0].min, 0);
    ranks.forEach((r, i) => i && assert.ok(r.min > ranks[i - 1].min, r.name));
  });

  it('quiz letters are unique and valid', () => {
    const letters = index.map((t) => t.letter);
    assert.equal(new Set(letters).size, letters.length);
    for (const l of letters) assert.match(l, /^[0-9A-HJKMNP-TV-Z]$/);
  });

  for (const card of live) {
    it(`${card.id}: page, toy cards and quiz are complete`, () => {
      readFileSync(new URL(`../${card.path}index.html`, import.meta.url));
      const toy = json(`data/toys/${card.id}.json`);
      assert.equal(toy.id, card.id);
      assert.ok(toy.cards.length >= 5);
      for (const c of toy.cards) {
        assert.ok(TYPES.includes(c.type), `${card.id}: card type ${c.type}`);
        assert.ok(c.title, `${card.id}: card without title`);
        if (c.mascot) assert.ok(POSES.includes(c.mascot), `${card.id}: mascot ${c.mascot}`);
        if (c.type === 'reveal') assert.ok(c.items.length >= 2 && c.items.every((x) => x.front && x.back));
        if (c.type === 'steps') assert.ok(c.steps.length >= 2 && c.steps.every((x) => x.label && x.text));
        if (c.type === 'pick') assert.equal(c.options.filter((o) => o.correct).length, 1, `${card.id}: ${c.title}`);
      }
      assert.ok(index.some((t) => t.id === card.id), `${card.id} missing from quizzes/index.json`);
      const q = json(`quizzes/${card.id}.json`).questions;
      assert.ok(q.length >= 5 && q.length <= 8, `${card.id}: ${q.length} questions`);
      assert.equal(new Set(q.map((x) => x.id)).size, q.length);
      for (const x of q) {
        assert.ok(x.options.length >= 2 && x.options.length <= 5, `${card.id} ${x.id}`);
        assert.equal(x.options.filter((o) => o === x.answer).length, 1, `${card.id} ${x.id}: answer must match one option`);
        assert.ok(x.explain, `${card.id} ${x.id}: explain`);
      }
    });
  }

  it('trending.json has a date and items', () => {
    const t = json('data/trending.json');
    assert.match(t.updated, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(t.items.length && t.items.every((x) => x.name && x.why));
  });

  it('never mentions ChimpX', () => {
    const files = ['data', 'quizzes'].flatMap((d) => readdirSync(new URL(`../${d}/`, import.meta.url), { recursive: true }).map((f) => `${d}/${f}`));
    for (const f of files.filter((x) => x.endsWith('.json'))) assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /chimpx/i, f);
  });
});
