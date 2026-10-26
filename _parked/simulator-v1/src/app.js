// Screens and input. Game math lives in engine.js, content in data.js.

import { CONFIG } from './config.js';
import {
  BUCKETS,
  CONTRACT_CHOICES,
  DAYS,
  DISCLAIMER,
  MARKET_MAKERS,
  PRIMING_BUDGET,
  PRIMING_NOTHING,
  PRIMING_PLANS,
  PROJECT_TYPES,
  RAISES,
  RESULTS_NOTE,
  ROUTES,
  STATS,
} from './data.js';
import * as engine from './engine.js';
import { canvasToBlob, drawShareCard } from './sharecard.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');

let game = null;
let lastHud = null;
const ui = { lastRoute: null };

const LABELS = { ...Object.fromEntries(STATS.map((s) => [s.id, s.label])), ownership: 'Founder ownership' };

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function render(html, { showHud = true } = {}) {
  app.innerHTML = `<section class="screen">${html}</section>`;
  hud.hidden = !showHud || !game || !game.choices.project;
  if (!hud.hidden) renderHud();
  window.scrollTo(0, 0);
  const heading = app.querySelector('h1, h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

function on(selector, handler) {
  app.querySelectorAll(selector).forEach((el) => el.addEventListener('click', (e) => handler(el, e)));
}

function renderHud() {
  const s = game.stats;
  const cells = STATS.map(({ id, label }) => {
    const value = s[id];
    const prev = lastHud?.[id];
    const flash = prev == null || prev === value ? '' : value > prev ? 'flash-up' : 'flash-down';
    const pct = id === 'price' ? value / 2 : value;
    return `<div class="hud-stat ${flash}" title="${esc(STATS.find((x) => x.id === id).hint)}">
      <span class="hud-label">${label}</span>
      <span class="hud-value">${fmt(value)}</span>
      <div class="hud-bar"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('');
  const day = game.day ? `Day ${game.day} of ${DAYS}` : 'Before launch';
  const own = game.choices.split ? `Founder owns ${game.ownership}%` : '';
  hud.innerHTML = `${cells}<div class="hud-meta"><span>${day}</span><span>${own}</span></div>`;
  lastHud = { ...s };
}

function chips(deltas) {
  const entries = Object.entries(deltas || {});
  if (!entries.length) return '<ul class="chips"><li class="chip neutral">No change</li></ul>';
  return `<ul class="chips">${entries
    .map(([k, d]) => `<li class="chip ${d > 0 ? 'up' : 'down'}">${LABELS[k]} ${d > 0 ? '+' : ''}${fmt(d)}</li>`)
    .join('')}</ul>`;
}

function effectText(effects) {
  const entries = Object.entries(effects || {}).filter(([, d]) => d);
  if (!entries.length) return 'No change.';
  return entries.map(([k, d]) => `${LABELS[k]} ${d > 0 ? '+' : ''}${d}`).join(', ');
}

function stepLabel(n, name) {
  return `<span class="eyebrow">Step ${n} of 7 · ${name}</span>`;
}

function disclaimer() {
  return `<p class="disclaimer">${esc(DISCLAIMER)}</p>`;
}

// A lesson card shown after each choice.
function outcome({ eyebrow, title, deltas, lessons, next, nextLabel = 'Continue' }) {
  render(`
    ${eyebrow}
    <h2>${esc(title)}</h2>
    ${deltas ? `<div class="card">${chips(deltas)}</div>` : ''}
    ${lessons
      .map(
        (l) => `<div class="card ${l.tone || 'blue'}">
          ${l.heading ? `<h3>${esc(l.heading)}</h3>` : ''}
          <p>${esc(l.text)}</p>
        </div>`,
      )
      .join('')}
    <button class="btn" data-next>${esc(nextLabel)}</button>
  `);
  on('[data-next]', next);
}

// Intro
function intro() {
  game = null;
  lastHud = null;
  render(
    `
    <span class="eyebrow">A 5 minute game</span>
    <h1>Launch a Token Simulator</h1>
    <p class="lead">Run a fictional token launch and live through launch week. Every choice has a cost, and every result comes with a short lesson.</p>
    <div class="card lime">
      <h3>How it works</h3>
      <p>Pick a project, set the raise, choose how you launch, then survive 7 days of surprises. At the end you get a score, a rank and a card to share.</p>
      <p class="small muted">You watch five numbers: Price, Hype, Trust, Liquidity and Runway.</p>
    </div>
    <button class="btn" data-start>Start the launch</button>
    ${disclaimer()}
  `,
    { showHud: false },
  );
  on('[data-start]', newGame);
}

function newGame() {
  game = engine.createGame((Math.random() * 2 ** 32) >>> 0);
  lastHud = null;
  projectStep();
}

// Step 1
function projectStep() {
  render(
    `
    ${stepLabel(1, 'Project')}
    <h2>What are you launching?</h2>
    <p>Each type changes your starting numbers.</p>
    ${PROJECT_TYPES.map(
      (p) => `<button class="choice" data-id="${p.id}">
        <span class="choice-title">${esc(p.label)}</span>
        <span class="choice-desc">${esc(p.pitch)}</span>
        <span class="choice-desc">Hype ${p.stats.hype} · Trust ${p.stats.trust} · Liquidity ${p.stats.liquidity} · Runway ${p.stats.runway}</span>
      </button>`,
    ).join('')}
  `,
    { showHud: false },
  );
  on('[data-id]', (el) => {
    const { lesson } = engine.chooseProject(game, el.dataset.id);
    lastHud = null;
    outcome({
      eyebrow: stepLabel(1, 'Project'),
      title: `You are launching a ${PROJECT_TYPES.find((p) => p.id === el.dataset.id).label} project.`,
      lessons: [{ heading: 'Lesson', text: lesson }],
      next: raiseStep,
    });
  });
}

// Step 2a
function raiseStep() {
  render(`
    ${stepLabel(2, 'Raise')}
    <h2>How much do you raise?</h2>
    <p>More money means more runway, and investors who want more of the supply.</p>
    ${RAISES.map(
      (r) => `<button class="choice" data-id="${r.id}">
        <span class="choice-title">${esc(r.label)}</span>
        <span class="choice-desc">${esc(r.desc)}</span>
        <span class="choice-desc">${esc(effectText(r.effects))}</span>
      </button>`,
    ).join('')}
  `);
  on('[data-id]', (el) => {
    engine.chooseRaise(game, el.dataset.id);
    splitStep();
  });
}

// Step 2b
function splitStep() {
  const raise = RAISES.find((r) => r.id === game.choices.raise);
  const split = engine.defaultSplit(raise.id);
  const minFor = (id) => (id === 'investors' && raise.minInvestors) || 0;

  render(`
    ${stepLabel(2, 'Token split')}
    <h2>Split the supply</h2>
    <p>Share 100 percent of the tokens across four buckets. ${
      raise.minInvestors ? `With a ${esc(raise.label)} raise, investors need at least ${raise.minInvestors} percent.` : ''
    }</p>
    <p class="small muted">Founder ownership equals the Team bucket. It helps your score, but costs Trust once it passes 25.</p>
    ${BUCKETS.map(
      (b) => `<div class="card bucket" data-bucket="${b.id}">
        <div class="bucket-head">
          <label for="r-${b.id}"><strong>${esc(b.label)}</strong></label>
          <span class="bucket-value" data-value>${split[b.id]}%</span>
        </div>
        <div class="bucket-rule" data-rule>${esc(b.rule)}</div>
        <div class="stepper">
          <button type="button" data-dec aria-label="Less for ${esc(b.label)}">−</button>
          <input type="range" id="r-${b.id}" min="${minFor(b.id)}" max="100" step="1" value="${split[b.id]}" />
          <button type="button" data-inc aria-label="More for ${esc(b.label)}">+</button>
        </div>
      </div>`,
    ).join('')}
    <div class="total">
      <div class="total-line" data-total></div>
      <button class="btn" data-lock>Lock the split</button>
    </div>
  `);

  const hot = (id, v) =>
    (id === 'team' && v > 25) || (id === 'investors' && v > 30) || (id === 'community' && v < 10) || (id === 'liquidity' && v < 15);

  const update = () => {
    const total = BUCKETS.reduce((sum, b) => sum + split[b.id], 0);
    for (const b of BUCKETS) {
      const card = app.querySelector(`[data-bucket="${b.id}"]`);
      card.querySelector('[data-value]').textContent = `${split[b.id]}%`;
      card.querySelector('input').value = split[b.id];
      card.querySelector('[data-rule]').classList.toggle('hot', hot(b.id, split[b.id]));
    }
    const line = app.querySelector('[data-total]');
    const left = 100 - total;
    line.textContent =
      left === 0 ? 'Total: 100 percent. Ready.' : left > 0 ? `Total: ${total} percent. ${left} left to place.` : `Total: ${total} percent. ${-left} too many.`;
    line.classList.toggle('bad', left !== 0);
    app.querySelector('[data-lock]').disabled = left !== 0;
  };

  const set = (id, v) => {
    split[id] = Math.max(minFor(id), Math.min(100, v));
    update();
  };

  for (const b of BUCKETS) {
    const card = app.querySelector(`[data-bucket="${b.id}"]`);
    card.querySelector('input').addEventListener('input', (e) => set(b.id, Number(e.target.value)));
    card.querySelector('[data-dec]').addEventListener('click', () => set(b.id, split[b.id] - 1));
    card.querySelector('[data-inc]').addEventListener('click', () => set(b.id, split[b.id] + 1));
  }
  update();

  on('[data-lock]', () => {
    const { deltas, triggered, lesson } = engine.setSplit(game, { ...split });
    const lessons = triggered.map((t) => ({
      tone: 'pink',
      text: BUCKETS.find((b) => b.id === t.bucket).rule,
    }));
    lessons.push({ heading: 'Lesson', text: lesson });
    outcome({
      eyebrow: stepLabel(2, 'Token split'),
      title: triggered.length ? 'The split has side effects.' : 'A balanced split.',
      deltas,
      lessons,
      next: routeStep,
    });
  });
}

// Step 3
function routeStep() {
  render(`
    ${stepLabel(3, 'Launch route')}
    <h2>How does the token reach the market?</h2>
    <p>Each route has a clear trade. None is right for everyone.</p>
    ${ROUTES.map(
      (r) => `<button class="choice" data-id="${r.id}">
        ${ui.lastRoute === r.id ? '<span class="tag">Last time</span>' : ''}
        <span class="choice-title">${esc(r.label)}</span>
        <span class="choice-desc">${esc(r.desc)}</span>
        <span class="choice-desc">${esc(effectText(r.effects))}</span>
        <span class="choice-desc">Risk: ${esc(r.risk)}</span>
      </button>`,
    ).join('')}
  `);
  on('[data-id]', (el) => {
    const route = ROUTES.find((r) => r.id === el.dataset.id);
    const { deltas, lesson, pattern } = engine.chooseRoute(game, route.id);
    outcome({
      eyebrow: stepLabel(3, 'Launch route'),
      title: `${route.label}.`,
      deltas,
      lessons: [
        { heading: 'Lesson', text: lesson },
        { heading: 'Common pattern', text: pattern, tone: 'lime' },
      ],
      next: marketMakerStep,
    });
  });
}

// Step 4a
function marketMakerStep() {
  render(`
    ${stepLabel(4, 'Market maker')}
    <h2>Pick a market maker deal</h2>
    <p>A market maker keeps buy and sell orders in the market so people can trade smoothly.</p>
    ${MARKET_MAKERS.map(
      (m) => `<button class="choice" data-id="${m.id}">
        <span class="choice-title">${esc(m.label)}</span>
        <span class="choice-desc">${esc(m.desc)}</span>
        <span class="choice-desc">${esc(effectText(m.effects))} Risk: ${esc(m.risk)}</span>
      </button>`,
    ).join('')}
  `);
  on('[data-id]', (el) => {
    const mm = MARKET_MAKERS.find((m) => m.id === el.dataset.id);
    const { deltas, lesson, needsContract } = engine.chooseMarketMaker(game, mm.id);
    if (needsContract) contractStep(mm, deltas, lesson);
    else
      outcome({
        eyebrow: stepLabel(4, 'Market maker'),
        title: `${mm.label}.`,
        deltas,
        lessons: [{ heading: 'Lesson', text: lesson }],
        next: primingStep,
      });
  });
}

// Step 4b
function contractStep(mm, dealDeltas, dealLesson) {
  render(`
    ${stepLabel(4, 'Market maker')}
    <h2>Review the contract?</h2>
    <div class="card">
      <p><strong>${esc(mm.label)}.</strong></p>
      ${chips(dealDeltas)}
      <p class="small" style="margin-top:8px">${esc(dealLesson)}</p>
    </div>
    ${CONTRACT_CHOICES.map(
      (c) => `<button class="choice" data-id="${c.id}">
        <span class="choice-title">${esc(c.label)}</span>
        <span class="choice-desc">${esc(c.desc)}</span>
      </button>`,
    ).join('')}
  `);
  on('[data-id]', (el) => {
    const choice = CONTRACT_CHOICES.find((c) => c.id === el.dataset.id);
    const { deltas, lesson } = engine.chooseContract(game, choice.id);
    outcome({
      eyebrow: stepLabel(4, 'Market maker'),
      title: `${choice.label}.`,
      deltas,
      lessons: [{ heading: 'Lesson', text: lesson }],
      next: primingStep,
    });
  });
}

// Step 5
function primingStep() {
  const picked = new Set();
  render(`
    ${stepLabel(5, 'Community')}
    <h2>Prime the community</h2>
    <p>You have ${PRIMING_BUDGET} budget points for the weeks before launch. Each plan can be picked once.</p>
    <p class="budget" data-budget></p>
    ${PRIMING_PLANS.map(
      (p) => `<button class="choice" data-id="${p.id}" aria-pressed="false">
        <span class="tag">${p.cost} pt${p.cost > 1 ? 's' : ''}</span>
        <span class="choice-title">${esc(p.label)}</span>
        <span class="choice-desc">${esc(effectText(p.effects))}</span>
      </button>`,
    ).join('')}
    <div class="total">
      <button class="btn" data-go></button>
    </div>
  `);

  const update = () => {
    const spent = engine.primingCost([...picked]);
    app.querySelector('[data-budget]').textContent = `Points left: ${PRIMING_BUDGET - spent} of ${PRIMING_BUDGET}`;
    app.querySelectorAll('[data-id]').forEach((el) => {
      const plan = PRIMING_PLANS.find((p) => p.id === el.dataset.id);
      const active = picked.has(plan.id);
      el.setAttribute('aria-pressed', String(active));
      el.disabled = !active && spent + plan.cost > PRIMING_BUDGET;
      el.style.opacity = el.disabled ? 0.45 : 1;
    });
    app.querySelector('[data-go]').textContent = picked.size ? 'Launch with these plans' : `${PRIMING_NOTHING.label}, launch now`;
  };

  on('[data-id]', (el) => {
    const id = el.dataset.id;
    if (picked.has(id)) picked.delete(id);
    else picked.add(id);
    update();
  });
  update();

  on('[data-go]', () => {
    const { results, lesson } = engine.choosePriming(game, [...picked]);
    const total = {};
    for (const r of results) for (const [k, d] of Object.entries(r.deltas)) total[k] = (total[k] || 0) + d;
    outcome({
      eyebrow: stepLabel(5, 'Community'),
      title: picked.size ? 'The community is primed.' : 'You stayed quiet.',
      deltas: total,
      lessons: [
        ...results.map((r) => ({ heading: r.plan.label, text: r.plan.lesson, tone: 'lime' })),
        { heading: 'Lesson', text: lesson },
      ],
      next: startDay,
      nextLabel: 'Start launch week',
    });
  });
}

// Step 6
function startDay() {
  const { events, milestone } = engine.startDay(game);
  const queue = [...events];
  if (milestone) {
    outcome({
      eyebrow: `<span class="eyebrow">Step 6 of 7 · Day ${game.day} of ${DAYS}</span>`,
      title: milestone.title,
      deltas: milestone.deltas,
      lessons: [{ text: milestone.text }],
      next: () => nextEvent(queue, events.length),
    });
  } else {
    nextEvent(queue, events.length);
  }
}

function nextEvent(queue, count) {
  if (!queue.length) return endDay(count);
  const event = queue.shift();
  const n = count - queue.length;
  const eyebrow = `<span class="eyebrow">Step 6 of 7 · Day ${game.day} of ${DAYS}${count > 1 ? ` · Event ${n} of ${count}` : ''}</span>`;
  render(`
    ${eyebrow}
    <h2>${esc(event.title)}</h2>
    <p>How do you respond?</p>
    ${['a', 'b']
      .map(
        (k) => `<button class="choice" data-answer="${k}">
        <span class="choice-title">${esc(event[k].label)}</span>
        <span class="choice-desc">${esc(effectText(event[k].effects))}</span>
      </button>`,
      )
      .join('')}
  `);
  on('[data-answer]', (el) => {
    const { deltas, lesson, response } = engine.resolveEvent(game, event.id, el.dataset.answer);
    outcome({
      eyebrow,
      title: `${response.label}.`,
      deltas,
      lessons: [{ heading: 'Lesson', text: lesson }],
      next: () => nextEvent(queue, count),
    });
  });
}

function sparkline(points) {
  const w = 300;
  const h = 60;
  const max = Math.max(150, ...points);
  const step = w / Math.max(1, DAYS);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`).join(' ');
  const base = (h - (100 / max) * h).toFixed(1);
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Price over the week">
    <line x1="0" y1="${base}" x2="${w}" y2="${base}" stroke="#16131f" stroke-dasharray="4 4" stroke-width="1" />
    <polyline points="${coords}" fill="none" stroke="#ff4fa3" stroke-width="4" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  </svg>`;
}

function endDay(eventCount) {
  const quiet = eventCount === 0;
  const r = engine.endDay(game);
  const reasons = [`Hype fell by 5 overnight.`];
  if (r.parts.drift) reasons.push(`Hype and Trust pulled the price ${r.parts.drift > 0 ? 'up' : 'down'} by ${fmt(Math.abs(r.parts.drift))}.`);
  if (r.parts.pressure) reasons.push('Heavy insider buckets added sell pressure of 3.');
  reasons.push(`Market noise moved it ${r.parts.swing >= 0 ? 'up' : 'down'} by ${fmt(Math.abs(r.parts.swing))}.`);
  if (r.parts.multiplier > 1) reasons.push('Liquidity is below 30, so every move was doubled.');

  render(`
    <span class="eyebrow">Step 6 of 7 · End of day ${r.day}</span>
    <h2>Price ${r.move >= 0 ? 'up' : 'down'} ${fmt(Math.abs(r.move))} to ${fmt(r.after.price)}</h2>
    ${quiet ? '<p class="muted">A quiet day. Nothing new landed on your desk.</p>' : ''}
    <div class="card">
      ${sparkline(game.priceHistory)}
      <ul class="small">${reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
    <button class="btn" data-next>${r.done ? 'See your score' : `Start day ${r.day + 1}`}</button>
  `);
  on('[data-next]', () => (r.done ? results() : startDay()));
}

// Step 7
function results() {
  const { total, rank } = engine.computeScore(game);
  const { worst, best } = engine.summarizeDecisions(game);
  const s = game.stats;
  const statRows = STATS.map(({ id, label }) => {
    const pct = id === 'price' ? Math.min(100, s[id] / 2) : s[id];
    return `<div class="stat-row"><span>${label}</span><div class="bar"><span style="width:${pct}%"></span></div><span class="num">${fmt(s[id])}</span></div>`;
  }).join('');

  const signupReady = Boolean(CONFIG.signup.action);
  const hidden = Object.entries(CONFIG.signup.hidden || {})
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`)
    .join('');

  render(
    `
    <span class="eyebrow">Step 7 of 7 · Results</span>
    <div class="card score-hero">
      <h1 class="sr-only">Your launch score</h1>
      <span class="score-number">${total}</span>
      <span class="small">out of 100</span>
      <span class="rank">${esc(rank.label)}</span>
      <p style="margin:8px 0 0">${esc(rank.line)}</p>
    </div>

    <div class="card">
      <h3>Where you ended up</h3>
      ${statRows}
      <p class="small muted" style="margin:6px 0 0">Founder ownership: ${game.ownership} percent.</p>
    </div>

    <div class="card pink">
      <h3>Your most expensive decisions</h3>
      ${
        worst.length
          ? worst
              .map(
                (d) => `<div class="decision"><strong>${esc(cap(d.short))}.</strong><br /><span class="small">${esc(d.lesson)}</span></div>`,
              )
              .join('')
          : '<p>None of your choices cost you much. Rare.</p>'
      }
    </div>

    ${
      best
        ? `<div class="card lime">
      <h3>Your best decision</h3>
      <p><strong>${esc(cap(best.short))}.</strong></p>
      ${chips(best.deltas)}
      <p class="small" style="margin-top:8px">Why it worked: ${esc(best.lesson)}</p>
    </div>`
        : ''
    }

    <p class="disclaimer">${esc(RESULTS_NOTE)} ${esc(DISCLAIMER)}</p>

    <h2 style="margin-top:24px">Share it</h2>
    <img class="share-preview" data-preview alt="Your share card" />
    <button class="btn" data-share>Share</button>

    <form class="card signup" data-signup ${signupReady ? `action="${esc(CONFIG.signup.action)}" method="${esc(CONFIG.signup.method)}" target="_blank"` : ''}>
      <h3>Want the real story behind a token launch?</h3>
      <p>Get the free first chapter of the book, plus new web3 toys when they launch.</p>
      <label class="sr-only" for="signup-email">Email</label>
      <input id="signup-email" type="email" name="${esc(CONFIG.signup.emailField)}" placeholder="you@example.com" required autocomplete="email" />
      ${hidden}
      <button class="btn lime" type="submit">Send me the chapter</button>
      <p class="small muted" data-signup-msg style="margin:0"></p>
    </form>

    ${
      CONFIG.book.url
        ? `<a class="text-link" href="${esc(CONFIG.book.url)}" target="_blank" rel="noopener">${esc(CONFIG.book.label)}</a>`
        : '<p class="text-link">Book coming soon. Join the list above to hear when it is out.</p>'
    }

    <button class="btn secondary" data-again>Play again with a different route</button>
  `,
    { showHud: false },
  );

  const mistake = worst[0]?.short || '';
  const cardData = {
    score: total,
    rank: rank.label,
    price: fmt(s.price),
    trust: s.trust,
    runway: s.runway,
    mistake,
    site: CONFIG.site,
    byline: CONFIG.byline,
  };
  const post = `I just ran a fake token launch and got ${rank.label}. Try to beat my score at ${CONFIG.site}.`;
  const canvas = document.createElement('canvas');
  const ready = drawShareCard(canvas, cardData).then(() => {
    app.querySelector('[data-preview]').src = canvas.toDataURL('image/png');
  });

  on('[data-share]', async () => {
    await ready;
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], 'web3-toys-launch.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: post });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    shareModal(blob, post);
  });

  app.querySelector('[data-signup]').addEventListener('submit', (e) => {
    if (!signupReady) {
      e.preventDefault();
      app.querySelector('[data-signup-msg]').textContent = 'Signups open soon. Check back after the book launch.';
    }
  });

  on('[data-again]', () => {
    ui.lastRoute = game.choices.route;
    newGame();
  });
}

function shareModal(blob, post) {
  const url = URL.createObjectURL(blob);
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="share-title">
    <h3 id="share-title">Share your launch</h3>
    <p class="small">Save the card, then paste the post wherever you share.</p>
    <a class="btn lime" href="${url}" download="web3-toys-launch.png">Save the image</a>
    <label for="share-post"><strong>Your post</strong></label>
    <textarea id="share-post" class="post" readonly>${esc(post)}</textarea>
    <button class="btn secondary" data-copy>Copy the post</button>
    <button class="btn secondary" data-close>Close</button>
  </div>`;
  document.body.appendChild(modal);
  const close = () => {
    URL.revokeObjectURL(url);
    modal.remove();
  };
  modal.addEventListener('click', (e) => e.target === modal && close());
  modal.querySelector('[data-close]').addEventListener('click', close);
  modal.querySelector('[data-copy]').addEventListener('click', async (e) => {
    const area = modal.querySelector('textarea');
    try {
      await navigator.clipboard.writeText(post);
    } catch {
      area.select();
      document.execCommand('copy');
    }
    e.target.textContent = 'Copied';
  });
  modal.querySelector('[data-close]').focus();
}

intro();
