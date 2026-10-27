import { data, engine } from './sim-load.mjs';

const { EVENTS } = data;

// Plays a full game. `plan` holds the setup choices; `answer(event, state)`
// returns 'a' or 'b'. `check(state)` runs after every change.
export function playGame(seed, plan, answer, check = () => {}) {
  const state = engine.createGame(seed);
  engine.chooseProject(state, plan.project);
  check(state);
  engine.chooseRaise(state, plan.raise);
  check(state);
  engine.setSplit(state, plan.split);
  check(state);
  engine.chooseRoute(state, plan.route);
  check(state);
  const mm = engine.chooseMarketMaker(state, plan.mm);
  check(state);
  if (mm.needsContract) {
    engine.chooseContract(state, plan.contract);
    check(state);
  }
  engine.choosePriming(state, plan.priming);
  check(state);
  const seen = [];
  while (!state.done) {
    const { events } = engine.startDay(state);
    check(state);
    for (const e of events) {
      seen.push({ day: state.day, id: e.id });
      engine.resolveEvent(state, e.id, answer(e, state));
      check(state);
    }
    engine.endDay(state);
    check(state);
  }
  return { state, seen, score: engine.computeScore(state) };
}

// Picks the response that is better (or worse) by the engine's own decision value.
export const bestAnswer = (e) =>
  engine.decisionValue(e.a.effects) >= engine.decisionValue(e.b.effects) ? 'a' : 'b';
export const worstAnswer = (e) => (bestAnswer(e) === 'a' ? 'b' : 'a');

export const STRONGEST = {
  project: 'infra',
  raise: '2m',
  split: { team: 20, investors: 20, community: 25, liquidity: 35 },
  route: 'exchange',
  mm: 'retainer',
  contract: 'lawyer',
  priming: ['community', 'builders'],
};

export const WEAKEST = {
  project: 'meme',
  raise: '500k',
  split: { team: 40, investors: 45, community: 5, liquidity: 10 },
  route: 'dex',
  mm: 'none',
  contract: null,
  priming: [],
};

export const eventById = (id) => EVENTS.find((e) => e.id === id);
