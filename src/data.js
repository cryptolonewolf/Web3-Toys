// All game content lives here: text, stat changes, trigger conditions and lessons.
// New events can be added to EVENTS without touching the game code.
//
// Effect keys: price, hype, trust, liquidity, runway, ownership.
// Trigger keys (all must match):
//   route / mm / contract: array of allowed choice ids
//   priming: id that must be among the chosen plans
//   split: { bucket: { lt | gt: n } }   token split buckets
//   stats: { stat: { lt | gt: n } }     live stats when the day starts
//   flag: name of a flag set by an earlier step
// days: the days an event may appear on (omit for any day).

export const STATS = [
  { id: 'price', label: 'Price', hint: 'Token price index. Starts at 100.' },
  { id: 'hype', label: 'Hype', hint: 'Attention and buying interest.' },
  { id: 'trust', label: 'Trust', hint: 'How much the community believes the team.' },
  { id: 'liquidity', label: 'Liquidity', hint: 'How easily people can trade without moving the price.' },
  { id: 'runway', label: 'Runway', hint: 'How long the treasury lasts.' },
];

export const START_PRICE = 100;
export const DAYS = 7;
export const EVENTS_PER_DAY = 2;

export const PROJECT_TYPES = [
  {
    id: 'infra',
    label: 'Infrastructure',
    pitch: 'A tool other builders rely on.',
    stats: { hype: 30, trust: 60, liquidity: 50, runway: 65 },
  },
  {
    id: 'defi',
    label: 'DeFi app',
    pitch: 'A product people use with their money.',
    stats: { hype: 40, trust: 50, liquidity: 50, runway: 60 },
  },
  {
    id: 'meme',
    label: 'Meme',
    pitch: 'A joke with a community around it.',
    stats: { hype: 65, trust: 30, liquidity: 40, runway: 55 },
  },
];

export const PROJECT_LESSON =
  'The type of project sets how people judge you. Infrastructure earns trust slowly. Memes get attention fast and lose it just as fast.';

export const RAISES = [
  {
    id: '500k',
    label: '500K dollars',
    desc: 'Less pressure from investors, less money in the bank.',
    effects: { runway: -15 },
    short: 'raising only 500K',
  },
  {
    id: '2m',
    label: '2M dollars',
    desc: 'The middle path. No change.',
    effects: {},
    short: 'a 2M raise',
  },
  {
    id: '5m',
    label: '5M dollars',
    desc: 'More runway, but investors want at least 25 percent of the supply.',
    effects: { runway: 15 },
    minInvestors: 25,
    short: 'a 5M raise',
  },
];

export const BUCKETS = [
  {
    id: 'team',
    label: 'Team',
    default: 15,
    rule: 'Above 25: Trust minus 10, and sell pressure each day.',
  },
  {
    id: 'investors',
    label: 'Investors',
    default: 20,
    rule: 'Above 30: sell pressure each day when unlocks near.',
  },
  {
    id: 'community',
    label: 'Community and rewards',
    default: 30,
    rule: 'Below 10: Hype minus 10.',
  },
  {
    id: 'liquidity',
    label: 'Liquidity and treasury',
    default: 35,
    rule: 'Below 15: Liquidity minus 15 and the launch can be sniped.',
  },
];

// Split rules applied once when the split is locked in.
export const SPLIT_RULES = [
  { bucket: 'team', gt: 25, effects: { trust: -10 }, short: 'a top heavy team allocation' },
  { bucket: 'investors', gt: 30, effects: {}, short: 'a top heavy investor allocation' },
  { bucket: 'community', lt: 10, effects: { hype: -10 }, short: 'a thin community allocation' },
  { bucket: 'liquidity', lt: 15, effects: { liquidity: -15 }, short: 'starving the liquidity bucket' },
];

export const SPLIT_LESSON =
  'Who holds the tokens decides who sells them. A top heavy split looks fine on launch day and hurts later.';

export const ROUTES = [
  {
    id: 'exchange',
    label: 'Exchange listing first',
    desc: 'Pay a listing fee and often give the exchange a token allocation.',
    effects: { trust: 10, liquidity: 10, hype: 5, runway: -15, ownership: -3 },
    risk: 'Listing delays.',
    lesson:
      'Listings give credibility and reach, but they cost money and tokens, and the date is never fully in your control.',
    short: 'paying for an exchange listing first',
  },
  {
    id: 'dex',
    label: 'DEX and launchpad',
    desc: 'Launch straight into an onchain pool, often through a launchpad.',
    effects: { hype: 15, runway: -5, liquidity: -10 },
    risk: 'Bots snipe the pool.',
    lesson:
      'Fast and cheap, and you keep more of the supply. It also puts the pool in front of bots on day one.',
    short: 'launching straight into a DEX pool',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    desc: 'Start on a DEX, list on an exchange later.',
    effects: { hype: 8, liquidity: 0, runway: -8 },
    risk: 'The later listing needs a primed community (Trust above 50 at launch).',
    lesson:
      'Slower, but it lets the community prove demand before you pay for a listing.',
    short: 'the slow hybrid route',
  },
];

export const ROUTE_LESSON =
  'The route decides who gets paid first. Exchanges and early backers often take value before the founder does, so read who gets what before you sign.';

// The hybrid route's later listing. The spec only says it needs community
// priming above 50; we read that as Trust above 50 once priming is done,
// and land the listing on day 5 with a modest boost.
export const HYBRID_LISTING = {
  day: 5,
  minTrust: 50,
  title: 'Your exchange listing goes live.',
  text: 'The community proved demand on the DEX, so the later listing came through.',
  effects: { liquidity: 10, trust: 5 },
  missedText: 'Trust was too low at launch, so the later exchange listing did not happen.',
};

export const MARKET_MAKERS = [
  {
    id: 'loan',
    label: 'Loan with a token option',
    desc: 'The market maker borrows tokens and gets the right to buy them later at a fixed price.',
    effects: { liquidity: 15, runway: 0 },
    risk: 'The market maker sells into price rises.',
    lesson:
      'Cheap upfront, but the option can reward them for a rising price while the team carries the risk.',
    short: 'a loan deal with a token option',
    hasContract: true,
  },
  {
    id: 'retainer',
    label: 'Monthly retainer',
    desc: 'You pay a fee and they trade with your funds or tokens under rules.',
    effects: { liquidity: 12, runway: -12 },
    risk: 'Lower dump risk.',
    lesson: 'More expensive, but the incentives are cleaner.',
    short: 'a market maker on retainer',
    hasContract: true,
  },
  {
    id: 'none',
    label: 'No market maker',
    desc: 'You rely on the pool and the community.',
    effects: { liquidity: -10, runway: 0 },
    risk: 'Liquidity dries up.',
    lesson: 'Fine for a tiny launch, risky when attention arrives.',
    short: 'skipping the market maker',
    hasContract: false,
  },
];

export const CONTRACT_CHOICES = [
  {
    id: 'lawyer',
    label: 'Pay a lawyer to review it',
    desc: 'Costs runway, removes the dumping risk.',
    effects: { runway: -4, trust: 3 },
    short: 'paying a lawyer to read the contract',
  },
  {
    id: 'sign',
    label: 'Sign as is',
    desc: 'Keeps your runway. Raises the risk that the market maker sells on day 3.',
    effects: {},
    short: 'signing the market maker contract as is',
  },
];

export const CONTRACT_LESSON =
  'Check the option clause, how the deal can be ended, which currency repayment is made in, and who has discretion. These details decide who benefits when the price moves.';

export const PRIMING_BUDGET = 3;

export const PRIMING_PLANS = [
  {
    id: 'influencer',
    label: 'Paid influencer push',
    cost: 2,
    effects: { hype: 20, trust: -5, runway: -8 },
    lesson: 'Fast attention that fades fast, and unclear paid promotion can cost trust.',
    short: 'paying influencers for hype',
  },
  {
    id: 'quest',
    label: 'Quest and points campaign',
    cost: 1,
    effects: { hype: 12, runway: -3 },
    lesson: 'Rewards bring people in, and some will only come for the reward. Plan vesting.',
    short: 'a points campaign without vesting',
  },
  {
    id: 'community',
    label: 'Real community building',
    cost: 1,
    effects: { trust: 12, hype: 5, runway: -2 },
    lesson:
      'Calls, support and honest updates are slow and cheap, and they hold up when the price drops.',
    short: 'real community building',
  },
  {
    id: 'builders',
    label: 'Builder and partner outreach',
    cost: 2,
    effects: { trust: 8, hype: 10, runway: -5 },
    lesson: 'Other projects that actually use you are better proof than followers.',
    short: 'builder and partner outreach',
  },
];

export const PRIMING_NOTHING = {
  id: 'nothing',
  label: 'Do nothing',
  cost: 0,
  effects: {},
  lesson: 'Silence before launch means nobody shows up on launch day.',
  short: 'staying silent before launch',
};

export const PRIMING_LESSON =
  'The best community plans start well before the token exists. Attention you rent leaves when you stop paying.';

export const EVENTS = [
  {
    id: 1,
    title: 'Bots snipe the launch pool.',
    trigger: { route: ['dex', 'hybrid'], split: { liquidity: { lt: 15 } } },
    days: [1],
    a: {
      label: 'Pause and relaunch with more liquidity',
      effects: { price: -10, trust: 5, runway: -5 },
      short: 'relaunching with more liquidity',
    },
    b: {
      label: 'Carry on',
      effects: { price: -20, trust: -15 },
      short: 'carrying on after bots sniped the pool',
    },
    lesson: 'Thin liquidity on day one gets picked apart.',
  },
  {
    id: 2,
    title: 'The exchange listing slips by a week.',
    trigger: { route: ['exchange'] },
    days: [1, 2],
    a: {
      label: 'Update the community honestly',
      effects: { trust: 5, hype: -5 },
      short: 'being honest about the listing delay',
    },
    b: {
      label: 'Post a hype tweet',
      effects: { hype: 10, trust: -10 },
      short: 'spinning the listing delay',
    },
    lesson: 'Dates slip. People forgive delays more than spin.',
  },
  {
    id: 3,
    title: 'An influencer posts about you without saying it is paid.',
    trigger: { priming: 'influencer' },
    a: {
      label: 'Ask them to disclose',
      effects: { trust: 10, hype: -5 },
      short: 'asking the influencer to disclose',
    },
    b: {
      label: 'Let it run',
      effects: { hype: 15, trust: -10 },
      short: 'letting undisclosed promotion run',
    },
    lesson: 'Hidden paid promotion damages trust.',
  },
  {
    id: 4,
    title: 'Reward farmers sell everything.',
    trigger: { priming: 'quest' },
    a: {
      label: 'Add vesting to rewards',
      effects: { trust: 5, hype: -5, runway: -3 },
      short: 'adding vesting to rewards',
    },
    b: {
      label: 'Let them sell',
      effects: { price: -15 },
      short: 'letting reward farmers dump',
    },
    lesson: 'Rewards without rules turn into sell pressure.',
  },
  {
    id: 5,
    title: 'The market maker sells into a price rise.',
    trigger: { mm: ['loan'], contract: ['sign'] },
    days: [3],
    a: {
      label: 'Ask for a lockup and review the terms',
      effects: { trust: 5, price: 5, runway: -5 },
      short: 'asking the market maker for a lockup',
    },
    b: {
      label: 'Say nothing',
      effects: { price: -20 },
      short: 'staying quiet while the market maker sold',
    },
    lesson: 'The option clause decides who profits from a rise.',
  },
  {
    id: 6,
    title: 'Liquidity dries up overnight.',
    trigger: { mm: ['none'] },
    days: [3, 4],
    a: {
      label: 'Add liquidity from the treasury',
      effects: { liquidity: 20, runway: -15 },
      short: 'topping up liquidity from the treasury',
    },
    b: {
      label: 'Wait it out',
      effects: { price: -20, liquidity: -10 },
      short: 'waiting out a liquidity crunch',
    },
    lesson: 'Thin markets punish teams who rely on luck.',
  },
  {
    id: 7,
    title: 'Rumors of a rug pull start on X.',
    trigger: { stats: { trust: { lt: 50 } } },
    a: {
      label: 'Publish token allocation and lock details',
      effects: { trust: 15 },
      short: 'publishing allocation and lock details',
    },
    b: {
      label: 'Delete critical replies',
      effects: { trust: -20 },
      short: 'deleting critical replies',
    },
    lesson: 'Transparency is the only real answer to a rumor.',
  },
  {
    id: 8,
    title: 'A copycat token uses your name.',
    trigger: {},
    a: {
      label: 'Post the official contract address everywhere',
      effects: { trust: 10, runway: -1 },
      short: 'posting the official contract address',
    },
    b: {
      label: 'Ignore it',
      effects: { trust: -10, price: -5 },
      short: 'ignoring a copycat token',
    },
    lesson: 'If you do not own the official address, someone else will pass off a fake.',
  },
  {
    id: 9,
    title: 'Investors ask about unlock dates.',
    trigger: { split: { investors: { gt: 30 } } },
    a: {
      label: 'Publish the unlock schedule',
      effects: { trust: 5, price: -5 },
      short: 'publishing the unlock schedule',
    },
    b: {
      label: 'Dodge the question',
      effects: { trust: -15 },
      short: 'dodging unlock questions',
    },
    lesson: 'Unlock schedules are the first thing serious holders check.',
  },
  {
    id: 10,
    title: 'Someone offers a paid listing for a big token allocation.',
    trigger: {},
    days: [3],
    a: {
      label: 'Decline politely',
      effects: {},
      short: 'declining a paid listing offer',
    },
    b: {
      label: 'Accept for 5 percent of supply',
      effects: { hype: 15, ownership: -5, trust: -5 },
      short: 'trading 5 percent of supply for a listing',
    },
    lesson: 'Verify who is really asking. Offers like this are often scams or very costly.',
  },
  {
    id: 11,
    title: 'Fake support accounts message your holders.',
    trigger: {},
    days: [4, 5],
    a: {
      label: 'Pin an official warning with the real support links',
      effects: { trust: 10 },
      short: 'warning holders about fake support',
    },
    b: {
      label: 'Do nothing',
      effects: { trust: -10 },
      short: 'ignoring fake support accounts',
    },
    lesson: 'Scammers go where attention goes. Warn your people first.',
  },
  {
    id: 12,
    title: 'A competitor launches the same week.',
    trigger: {},
    a: {
      label: 'Host an open community call',
      effects: { hype: 10, runway: -3 },
      short: 'hosting an open community call',
    },
    b: {
      label: 'Ignore them',
      effects: { hype: -10 },
      short: 'ignoring a rival launch',
    },
    lesson: 'Another launch is a test of whether people care about your project.',
  },
  {
    id: 13,
    title: 'Holders question the team allocation.',
    trigger: { split: { team: { gt: 25 } } },
    a: {
      label: 'Add a longer vesting for the team',
      effects: { trust: 15 },
      short: 'adding longer team vesting',
    },
    b: {
      label: 'Defend the split',
      effects: { trust: -10 },
      short: 'defending a heavy team split',
    },
    lesson: 'Long vesting is the cheapest trust you can buy.',
  },
  {
    id: 14,
    title: 'A respected outlet covers you.',
    trigger: { stats: { trust: { gt: 60 } } },
    a: {
      label: 'Follow with a product update',
      effects: { hype: 10, runway: -3 },
      short: 'following press with a product update',
    },
    b: {
      label: 'Bank the goodwill and stay quiet',
      effects: { trust: 5 },
      short: 'banking the goodwill quietly',
    },
    lesson: 'Good news fades if you do not follow it.',
  },
  {
    id: 15,
    title: 'Weekend volume drops.',
    trigger: {},
    days: [6],
    a: {
      label: 'Run a community call',
      effects: { trust: 8, hype: 3 },
      short: 'running a community call on a quiet weekend',
    },
    b: {
      label: 'Spend on ads',
      effects: { hype: 8, runway: -10 },
      short: 'buying ads on a quiet weekend',
    },
    lesson: 'Quiet days are normal. Showing up beats spending.',
  },
  {
    id: 16,
    title: 'Holders ask where the treasury is.',
    trigger: {},
    days: [6, 7],
    a: {
      label: 'Publish a treasury page with addresses and spend',
      effects: { trust: 10 },
      short: 'publishing a treasury page',
    },
    b: {
      label: 'Say it is coming later',
      effects: { trust: -10 },
      short: 'keeping the treasury vague',
    },
    lesson: 'Share treasury details yourself before others do it for you.',
  },
];

// Daily rules, applied at the end of every day. See applyDailyRules in engine.js.
export const DAILY = {
  hypeDecay: 5,
  hypeWeight: 0.3,
  trustWeight: 0.2,
  sellPressure: 3,
  sellPressureFromDay: 4,
  teamSellAbove: 25,
  investorSellAbove: 30,
  thinLiquidityBelow: 30,
  randomSwing: 8,
};

export const SCORE_WEIGHTS = {
  price: 0.3,
  trust: 0.25,
  runway: 0.2,
  liquidity: 0.15,
  ownership: 0.1,
};

export const RANKS = [
  { min: 85, label: 'Launch Legend', line: 'Real launches are harder. Enjoy it here.' },
  { min: 65, label: 'Sharp Operator', line: 'You made clear choices and handled the surprises.' },
  { min: 45, label: 'Steady Launcher', line: 'A solid launch with a few expensive lessons.' },
  { min: 25, label: 'Survived Day One', line: 'You are still here, and that counts for something.' },
  { min: 0, label: 'Rekt Founder', line: 'The market did what the market does. Read the lessons and try again.' },
];

export const DISCLAIMER =
  'This is a game with simplified numbers. It is not financial advice and does not describe any real company or token.';

export const RESULTS_NOTE =
  'This is a simulation with simplified numbers. Real launches have more moving parts.';
