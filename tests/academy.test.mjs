// Tests for the Project Academy: marking 10 drawn questions, W3P certificate
// codes, which courses show, the retry lock and the course files.
// Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const lib = require('../api/_lib.js');
const A = require('../js/academy-common.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const SECRET = 'test-secret';

describe('Academy quizzes on the server', () => {
  const quiz = lib.loadQuiz('academy:lumen');

  it('sends the whole pool without answers, with a draw of 10 and a pass mark of 80', () => {
    const pub = lib.publicQuiz(quiz);
    assert.equal(pub.draw, 10);
    assert.equal(pub.passMark, 80);
    assert.ok(!JSON.stringify(pub).includes('"answer"'));
    assert.equal(pub.questions.length, quiz.questions.length);
  });

  it('marks only the 10 questions answered and passes at 80 percent', () => {
    const ten = quiz.questions.slice(5, 15);
    const right = (q) => q.options.indexOf(q.answer);
    const answers = Object.fromEntries(ten.map((q, i) => [q.id, i < 8 ? right(q) : (right(q) + 1) % q.options.length]));
    const r = lib.grade(quiz, answers);
    assert.equal(r.total, 10);
    assert.equal(r.score, 80);
    assert.ok(r.passed);
    answers[ten[7].id] = null;
    assert.ok(!lib.grade(quiz, answers).passed, '7 of 10 fails');
  });

  it('refuses an attempt with fewer than 10 answers', () => {
    const r = lib.grade(quiz, { q1: 0 });
    assert.ok(r.error && !r.passed);
  });

  it('stamps W3P codes that verify for the right name only', () => {
    const { code } = lib.issue(SECRET, quiz, 90, 'Aki Tanaka', Date.UTC(2026, 10, 2));
    assert.match(code, /^W3P-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const v = lib.verify(SECRET, code, 'aki tanaka');
    assert.equal(v.toy, 'academy:lumen');
    assert.equal(v.title, 'Lumen Protocol Pro');
    assert.equal(v.score, 90);
    assert.equal(lib.verify(SECRET, code, 'Someone Else'), null);
    assert.equal(lib.verify('other', code, 'Aki Tanaka'), null);
    // Ordinary certificates still work alongside.
    const toy = lib.loadQuiz('crypto-in-5');
    assert.equal(lib.verify(SECRET, lib.issue(SECRET, toy, 80, 'Aki').code, 'Aki').toy, 'crypto-in-5');
  });
});

describe('Academy rules in the browser', () => {
  it('shows a course only when vetted and not past its sponsored date', () => {
    assert.ok(A.visible({ vetted: true, sponsored_until: '2027-01-01' }, '2026-11-02'));
    assert.ok(A.visible({ vetted: true, sponsored_until: '2026-11-02' }, '2026-11-02'));
    assert.ok(!A.visible({ vetted: true, sponsored_until: '2026-11-01' }, '2026-11-02'));
    assert.ok(!A.visible({ vetted: false, sponsored_until: '2027-01-01' }, '2026-11-02'));
    assert.ok(!A.visible({ sponsored_until: '2027-01-01' }, '2026-11-02'));
  });

  it('filters by chain and category', () => {
    const list = [{ chain: 'Ethereum', category: 'DeFi' }, { chain: 'Solana', category: 'DeFi' }, { chain: 'Ethereum', category: 'Gaming' }];
    assert.equal(A.filterCourses(list, 'Ethereum', '').length, 2);
    assert.equal(A.filterCourses(list, 'Ethereum', 'DeFi').length, 1);
    assert.equal(A.filterCourses(list, '', '').length, 3);
  });

  it('draws 10 different questions with all their options', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, question: 'Q', options: [{ id: 0 }, { id: 1 }, { id: 2 }] }));
    const d = A.draw(pool, 10);
    assert.equal(d.length, 10);
    assert.equal(new Set(d.map((q) => q.id)).size, 10);
    assert.ok(d.every((q) => q.options.length === 3));
  });

  it('locks retries for 10 minutes after a fail and needs every lesson seen', () => {
    const e = { seen: [0, 1], lockUntil: 0 };
    assert.ok(!A.allSeen(e, 3));
    e.seen.push(2);
    assert.ok(A.allSeen(e, 3));
    A.lock(e, 1000);
    assert.equal(A.msLeft(e, 1000), 10 * 60000);
    assert.equal(A.msLeft(e, 1000 + 10 * 60000), 0);
  });
});

describe('Academy course files', () => {
  const index = json('data/academy/index.json').courses;
  const quizIndex = json('quizzes/academy/index.json').courses;

  for (const id of index) {
    it(`${id}: public file, private quiz and pictures are complete`, () => {
      const c = json(`data/academy/${id}.json`);
      assert.equal(c.id, id);
      for (const k of ['name', 'logo', 'colors', 'website', 'chain', 'category', 'lessons', 'sponsored_until']) assert.ok(c[k], k);
      assert.ok('x' in c && 'vetted' in c);
      assert.match(c.sponsored_until, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(c.lessons.length >= 4 && c.lessons.length <= 8);
      assert.ok(existsSync(new URL(`../${c.logo}`, import.meta.url)), c.logo);
      for (const l of c.lessons) {
        assert.ok(l.title && l.text, l.title);
        if (l.image) assert.ok(existsSync(new URL(`../${l.image}`, import.meta.url)), l.image);
      }
      assert.doesNotMatch(JSON.stringify(c), /"answer"|"questions"/, 'answers never go in the public file');
      const q = json(`quizzes/academy/${id}.json`).questions;
      assert.ok(q.length >= 15 && q.length <= 30, `${q.length} questions`);
      assert.equal(new Set(q.map((x) => x.id)).size, q.length);
      for (const x of q) assert.equal(x.options.filter((o) => o === x.answer).length, 1, x.id);
      const entry = quizIndex.find((x) => x.id === id);
      assert.ok(entry && /^[0-9A-HJKMNP-TV-Z]{2}$/.test(entry.code), 'two character code');
    });
  }

  it('course codes are unique', () => {
    assert.equal(new Set(quizIndex.map((c) => c.code)).size, quizIndex.length);
  });

  it('never offers token or money rewards', () => {
    for (const id of index) assert.doesNotMatch(JSON.stringify(json(`data/academy/${id}.json`)), /airdrop reward|earn tokens|free tokens|win \$/i);
  });
});
