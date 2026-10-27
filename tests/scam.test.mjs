// Tests for Spot the Scam. Run with: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const checker = require('../js/scam-checker.js');
const game = require('../js/scam-game.js');

// The data files set values on `window`, like they do in the browser.
function loadData(file) {
  const window = {};
  vm.runInNewContext(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'), { window });
  return window;
}
const RULES = loadData('scam-rules.js').WEB3TOYS_SCAM_RULES;
const SCENARIOS = loadData('scam-scenarios.js').WEB3TOYS_SCAM_SCENARIOS;
const SETTINGS = loadData('scam-game.js').WEB3TOYS_SCAM_GAME;

const ids = (result) => result.flags.map((f) => f.rule.id);

describe('checker: the starting rules each catch their red flag', () => {
  const cases = {
    secrets: 'Please reply with your seed phrase so we can help.',
    returns: 'Join now for guaranteed 30% weekly returns.',
    'send-to-receive': 'Send 1 coin to this address and get 2x back instantly.',
    urgency: 'Act now, this offer expires today.',
    'fake-support': 'Hello, I am from the support team. We saw your issue.',
    'off-platform': 'Let us continue this on Telegram.',
    'connect-wallet': 'Connect your wallet and sign the transaction to claim.',
    links: 'Details here: bit.ly/abc123',
    fees: 'Pay a small fee to unlock your airdrop.',
    'unexpected-offer': 'Congratulations, you have won a prize!',
    endorsement: 'This project is backed by a famous investor.',
    'rushed-and-sloppy': 'URGENT!! Dear customer kindly verify NOW or LOSE ACCESS.',
  };

  for (const [id, text] of Object.entries(cases)) {
    it(id, () => {
      assert.ok(ids(checker.check(text, RULES)).includes(id), `${id} did not match: "${text}"`);
    });
  }

  it('covers every rule in the data file', () => {
    assert.deepEqual(Object.keys(cases).sort(), Array.from(RULES.rules, (r) => r.id).sort());
  });
});

describe('checker: links', () => {
  const find = (text) => checker.check(text, RULES).flags.find((f) => f.rule.id === 'links');

  it('flags lookalike names, odd endings and number swaps', () => {
    assert.ok(find('Go to puddle-wallet-verify.xyz now'));
    assert.ok(find('Log in at kett1e.com'));
    assert.ok(find('Visit https://mintmoss-claim.app/season'));
  });

  it('does not flag ordinary addresses', () => {
    assert.equal(find('Our docs are at gravychain.org/token and help.puddlewallet.com'), undefined);
  });

  it('does not mistake a missing space after a full stop for a link', () => {
    assert.deepEqual(checker.findDomains('Thanks.See you soon. ok'), []);
  });
});

describe('checker: result labels', () => {
  it('many red flags for the built-in example', () => {
    const r = checker.check(RULES.example, RULES);
    assert.equal(r.level, 'many');
    assert.equal(r.label, 'Many red flags');
  });

  it('some red flags for one mild flag', () => {
    const r = checker.check('Hurry, the sale is ending soon.', RULES);
    assert.equal(r.level, 'some');
  });

  it('no obvious red flags, with the not-safe note, never "safe"', () => {
    const r = checker.check('Hi, the team call moved to 3pm tomorrow. See you there.', RULES);
    assert.equal(r.level, 'none');
    assert.equal(r.label, 'No obvious red flags');
    assert.match(r.note, /does not mean it is safe/);
    for (const text of [RULES.labels.many, RULES.labels.some, RULES.labels.none]) {
      assert.doesNotMatch(text, /\bsafe\b/i);
    }
  });

  it('ignores safety warnings like "we will never ask for your seed phrase"', () => {
    assert.equal(checker.check('Reminder: we will never ask for your seed phrase.', RULES).level, 'none');
    assert.equal(checker.check('No fee and no seed phrase needed.', RULES).level, 'none');
  });

  it('still catches a request after a warning or a "don\'t worry"', () => {
    const r1 = checker.check("Don't worry, just enter your seed phrase here.", RULES);
    const r2 = checker.check('We never ask for your seed phrase. Now type your seed phrase below.', RULES);
    assert.ok(ids(r1).includes('secrets'));
    assert.ok(ids(r2).includes('secrets'));
  });

  it('sloppy writing only counts together with urgency', () => {
    const r = checker.check('Dear customer, kindly read this!! It is about your order.', RULES);
    assert.ok(!ids(r).includes('rushed-and-sloppy'));
  });
});

describe('checker: seed phrases and private keys stop the check', () => {
  const seed12 = 'apple river candle frost magnet ocean pencil rocket silver tiger velvet window';
  const seed24 = `${seed12} anchor bridge cactus dragon engine falcon garden harbor island jungle kettle lemon`;

  it('blocks 12 and 24 word phrases', () => {
    assert.deepEqual(checker.check(seed12, RULES), { blocked: 'seed' });
    assert.deepEqual(checker.check(seed24, RULES), { blocked: 'seed' });
  });

  it('blocks a numbered list of words', () => {
    const numbered = seed12.split(' ').map((w, i) => `${i + 1}. ${w}`).join('\n');
    assert.deepEqual(checker.check(numbered, RULES), { blocked: 'seed' });
  });

  it('blocks a phrase hidden inside a message', () => {
    assert.deepEqual(checker.check(`Is this ok to share? ${seed12} thanks`, RULES), { blocked: 'seed' });
  });

  it('blocks private keys', () => {
    assert.deepEqual(checker.check(`key: 0x${'a1b2c3d4'.repeat(8)}`, RULES), { blocked: 'key' });
    assert.deepEqual(checker.check('5Kb8kLf9zgWQnogidDA76MzPL6TsZZY36hWXMssSzNydYXYB9KF5Kb8kLf9zg', RULES), { blocked: 'key' });
  });

  it('does not block wallet addresses or normal writing', () => {
    const texts = [
      'Send it to 0x52908400098527886E0F7030069857D2E4169EE7 please',
      'Hey, can you check the new docs when you get a chance? I think the token page is missing the audit link and the lock details.',
      RULES.example,
      ...SCENARIOS.map((s) => s.body),
    ];
    for (const t of texts) assert.equal(checker.detectSecret(t), null, t);
  });
});

describe('scenarios data', () => {
  const ruleIds = RULES.rules.map((r) => r.id);

  it('has about 30 scenarios with unique ids', () => {
    assert.ok(SCENARIOS.length >= 30);
    assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
  });

  it('every scenario is complete and uses known red flags', () => {
    for (const s of SCENARIOS) {
      assert.ok(Object.keys(SETTINGS.typeLabels).includes(s.type), `${s.id}: type`);
      assert.ok(s.answer === 'scam' || s.answer === 'legit', `${s.id}: answer`);
      assert.ok(s.body && s.explain, `${s.id}: text`);
      for (const f of s.flags) assert.ok(ruleIds.includes(f), `${s.id}: unknown flag ${f}`);
      if (s.answer === 'scam') assert.ok(s.flags.length > 0, `${s.id}: scam without flags`);
      else assert.equal(s.flags.length, 0, `${s.id}: legit with flags`);
      if (s.type === 'airdrop' || s.type === 'token') assert.ok(s.url && s.title, `${s.id}: page needs url and title`);
    }
  });

  it('includes every kind of artifact', () => {
    for (const type of Object.keys(SETTINGS.typeLabels)) assert.ok(SCENARIOS.some((s) => s.type === type), type);
  });
});

describe('game', () => {
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  it('picks 10 different rounds with both scams and legit ones', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rounds = game.pickRounds(SCENARIOS, SETTINGS, seeded(seed));
      assert.equal(rounds.length, 10);
      assert.equal(new Set(rounds.map((r) => r.id)).size, 10);
      assert.ok(rounds.filter((r) => r.answer === 'scam').length >= 3);
      assert.ok(rounds.filter((r) => r.answer === 'legit').length >= 3);
    }
  });

  it('a perfect game scores 100 and ranks Scam Slayer', () => {
    const rounds = game.pickRounds(SCENARIOS, SETTINGS, seeded(7));
    const total = rounds.reduce((sum, s) => sum + game.scoreRound(s, s.answer, s.flags, SETTINGS).points, 0);
    assert.equal(total, 100);
    assert.equal(game.rankFor(total, SETTINGS.ranks).label, 'Scam Slayer');
  });

  it('all wrong answers score 0 and rank Rekt Rookie', () => {
    const rounds = game.pickRounds(SCENARIOS, SETTINGS, seeded(7));
    const flip = (a) => (a === 'scam' ? 'legit' : 'scam');
    const total = rounds.reduce((sum, s) => sum + game.scoreRound(s, flip(s.answer), [], SETTINGS).points, 0);
    assert.equal(total, 0);
    assert.equal(game.rankFor(total, SETTINGS.ranks).label, 'Rekt Rookie');
  });

  it('gives part of the red flag points for a partial tag', () => {
    const s = SCENARIOS.find((x) => x.flags.length === 4);
    const r = game.scoreRound(s, 'scam', s.flags.slice(0, 2), SETTINGS);
    assert.ok(r.correct);
    assert.ok(r.points > 7 && r.points < 10);
    assert.equal(r.missed.length, 2);
  });

  it('wrong tags on a legit message lose the red flag points', () => {
    const s = SCENARIOS.find((x) => x.answer === 'legit');
    assert.equal(game.scoreRound(s, 'legit', [], SETTINGS).points, 10);
    assert.equal(game.scoreRound(s, 'legit', ['urgency'], SETTINGS).points, 7);
  });
});

describe('known scam list', () => {
  const EVM = '0x52908400098527886E0F7030069857D2E4169EE7';
  const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const KNOWN = {
    domains: `
# a comment line
fake-claim-site.xyz    # fake airdrop page
https://www.old-scam.top/claim
`,
    addresses: `
${EVM}   # fake giveaway
${SOL}
`,
    emails: `
Support@Scam-Mailer.top   # fake exchange support
`,
    handles: `
@Fake_Support_Desk
t.me/claimbot_rewards   # fake claim bot
`,
    phones: `
+44 7700 900123   # fake recruiter
`,
    phrases: `
your wallet has been selected for the season 3 retroactive reward
`,
    flag: { name: 'Matches a reported scam', why: 'Reported.', todo: 'Do not open it.' },
  };
  const known = (text) => checker.check(text, RULES, KNOWN).flags.find((f) => f.rule.id === 'known-scam');

  it('reads one entry per line, skipping comments and keeping notes', () => {
    const entries = checker.parseList(KNOWN.domains);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].value, 'fake-claim-site.xyz');
    assert.equal(entries[0].note, 'fake airdrop page');
  });

  it('finds a listed web address, with its note, anywhere in a message', () => {
    for (const text of [
      'Claim now at fake-claim-site.xyz before it closes',
      'Go to https://app.fake-claim-site.xyz/claim?id=1',
      'Email help@FAKE-CLAIM-SITE.XYZ for support.',
      'Visit old-scam.top.',
    ]) {
      assert.ok(known(text), text);
    }
    assert.deepEqual(known('see fake-claim-site.xyz')?.found, ['fake-claim-site.xyz (fake airdrop page)']);
  });

  it('does not match lookalikes or longer names', () => {
    for (const text of ['notfake-claim-site.xyz', 'fake-claim-site.xyz.example.com', 'fake-claim-site.xyzz', 'old-scam.topic']) {
      assert.equal(known(text), undefined, text);
    }
  });

  it('finds wallet addresses: 0x ignoring capitals, others exactly', () => {
    assert.ok(known(`send to ${EVM.toLowerCase()} now`));
    assert.ok(known(`address: ${SOL}`));
    assert.equal(known(`address: ${SOL.toLowerCase()}`), undefined);
    assert.equal(known(`${EVM}00`), undefined);
  });

  it('always comes first and always counts as many red flags', () => {
    const r = checker.check('Hi, the call moved. Notes: fake-claim-site.xyz', RULES, KNOWN);
    assert.equal(r.flags[0].rule.id, 'known-scam');
    assert.equal(r.level, 'many');
  });

  it('finds email addresses whatever the capitals', () => {
    assert.deepEqual(known('Reply to support@scam-mailer.top today')?.found, ['Support@Scam-Mailer.top (fake exchange support)']);
    assert.equal(known('Reply to notsupport@scam-mailer.topper'), undefined);
  });

  it('finds chat usernames written as @name or t.me/name', () => {
    assert.ok(known('Message @fake_support_desk for help'));
    assert.ok(known('Join https://t.me/ClaimBot_Rewards now'));
    assert.ok(known('Message @claimbot_rewards'));
    assert.equal(known('our fake_support_desk team'), undefined, 'plain word without @');
    assert.equal(known('write to help@fake_support_desk.com'), undefined, 'part of an email');
    assert.equal(known('Message @fake_support_desk2'), undefined, 'longer name');
  });

  it('finds phone numbers however they are written', () => {
    for (const text of ['Call +44 7700 900123', 'WhatsApp me on 07700900123', 'text 7700-900-123 now', '(44) 7700 900 123']) {
      assert.ok(known(text), text);
    }
    assert.equal(known('Call +44 7700 900124'), undefined);
  });

  it('finds scam phrases whatever the capitals and punctuation', () => {
    assert.ok(known('GOOD NEWS! Your wallet has been selected for the Season-3 retroactive reward!!'));
    assert.equal(known('Your wallet has been selected for the season 2 reward'), undefined);
  });

  it('works without a list', () => {
    assert.equal(checker.check('fake-claim-site.xyz', RULES).flags.some((f) => f.rule.id === 'known-scam'), false);
  });

  it('the shipped list file is valid', () => {
    const file = loadData('scam-known.js').WEB3TOYS_SCAM_KNOWN;
    assert.ok(file.flag.name && file.flag.why && file.flag.todo);
    for (const e of checker.parseList(file.domains)) {
      assert.match(e.value.replace(/^https?:\/\//, ''), /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i, `bad web address: ${e.value}`);
    }
    for (const e of checker.parseList(file.addresses)) {
      assert.doesNotMatch(e.value, /\s/, `bad wallet address: ${e.value}`);
      assert.ok(e.value.length >= 26 && e.value.length <= 64, `odd length wallet address: ${e.value}`);
    }
    for (const e of checker.parseList(file.emails)) {
      assert.match(e.value, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, `bad email: ${e.value}`);
    }
    for (const e of checker.parseList(file.handles)) {
      assert.match(e.value, /^(@|t\.me\/)?[A-Za-z0-9_]{3,32}$/, `bad username: ${e.value}`);
    }
    for (const e of checker.parseList(file.phones)) {
      assert.ok(e.value.replace(/\D/g, '').length >= 9, `phone number too short: ${e.value}`);
    }
    for (const e of checker.parseList(file.phrases)) {
      assert.ok(e.value.trim().split(/\s+/).length >= 5, `phrase needs at least 5 words: ${e.value}`);
    }
  });
});
