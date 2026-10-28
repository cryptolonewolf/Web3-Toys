// Shared code for the web3.toys server functions (Vercel). Files in api/
// that start with _ are helpers, not web addresses.
//
// Certificates are stamped with CERT_SECRET, a secret key set in the Vercel
// project settings. Only someone with that key can make a code that verifies.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const QUIZ_DIR = path.join(__dirname, '..', 'quizzes');
const PASS_MARK = 70;
const TIME_LIMIT = 20;
const EPOCH = Date.UTC(2026, 0, 1); // day 0 for dates inside codes
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I, L, O, U: easy to read aloud

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(QUIZ_DIR, file), 'utf8'));
}

// The list of toys with quizzes, each with a one-letter code used in certificates.
function quizIndex() {
  return readJson('index.json').toys;
}

function loadQuiz(toy) {
  const entry = quizIndex().find((t) => t.id === toy);
  if (!entry) return null;
  try {
    const quiz = readJson(`${entry.id}.json`);
    return { ...quiz, id: entry.id, title: entry.title, letter: entry.letter };
  } catch (e) {
    return null;
  }
}

// What visitors see: questions and options, never the answers.
function publicQuiz(quiz) {
  return {
    toy: quiz.id,
    title: quiz.title,
    timeLimit: TIME_LIMIT,
    passMark: PASS_MARK,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options.map((text, i) => ({ id: i, text })),
    })),
  };
}

// answers: { questionId: optionIndex or null (ran out of time) }
function grade(quiz, answers) {
  const review = quiz.questions.map((q) => {
    const right = q.options.indexOf(q.answer);
    const chosen = Object.prototype.hasOwnProperty.call(answers || {}, q.id) ? answers[q.id] : null;
    return {
      id: q.id,
      question: q.question,
      chosen: chosen == null ? null : q.options[chosen] ?? null,
      answer: q.answer,
      correct: chosen === right,
      explain: q.explain || '',
    };
  });
  const correct = review.filter((r) => r.correct).length;
  const score = Math.round((correct / quiz.questions.length) * 100);
  return { score, correct, total: quiz.questions.length, passed: score >= PASS_MARK, passMark: PASS_MARK, review };
}

function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function toB32(n, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s = B32[n % 32] + s;
    n = Math.floor(n / 32);
  }
  return s;
}

function fromB32(s) {
  let n = 0;
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v === -1) return NaN;
    n = n * 32 + v;
  }
  return n;
}

function signature(secret, body, name) {
  const mac = crypto.createHmac('sha256', secret).update(`${body}|${cleanName(name).toLowerCase()}`).digest();
  // 10 characters = 50 bits of the stamp.
  let n = 0n;
  for (let i = 0; i < 7; i++) n = (n << 8n) | BigInt(mac[i]);
  n >>= 6n;
  let s = '';
  for (let i = 0; i < 10; i++) {
    s = B32[Number(n % 32n)] + s;
    n /= 32n;
  }
  return s;
}

function formatCode(raw) {
  return `W3T-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

function dateFromDay(day) {
  return new Date(EPOCH + day * 86400000).toISOString().slice(0, 10);
}

// Makes a certificate code: toy letter, date and score, plus the stamp.
function issue(secret, quiz, score, name, now = Date.now()) {
  const day = Math.floor((now - EPOCH) / 86400000);
  const body = quiz.letter + toB32(day, 3) + toB32(score, 2);
  return { code: formatCode(body + signature(secret, body, name)), date: dateFromDay(day) };
}

// Checks a code and name. Returns the certificate details, or null.
function verify(secret, code, name) {
  const raw = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^W3T/, '');
  if (raw.length !== 16 || !cleanName(name)) return null;
  const body = raw.slice(0, 6);
  const given = raw.slice(6);
  const expected = signature(secret, body, name);
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  const toy = quizIndex().find((t) => t.letter === body[0]);
  const score = fromB32(body.slice(4, 6));
  const day = fromB32(body.slice(1, 4));
  if (!toy || Number.isNaN(score) || Number.isNaN(day) || score > 100) return null;
  return { toy: toy.id, title: toy.title, name: cleanName(name), score, date: dateFromDay(day), code: formatCode(raw) };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Vercel parses JSON bodies; this also works when it arrives as text.
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(JSON.parse(req.body || '{}'));
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20000) reject(new Error('too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function query(req) {
  return req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

module.exports = { PASS_MARK, TIME_LIMIT, loadQuiz, publicQuiz, grade, issue, verify, cleanName, quizIndex, send, readBody, query };
