// Words and numbers for Spot the Scam that are not scenarios or rules:
// scoring, ranks and the lines on the screens. Edit freely.

window.WEB3TOYS_SCAM_GAME = {
  rounds: 10,

  // Every play includes at least this many of each, so it is never all one kind.
  minScams: 3,
  minLegit: 3,

  // Points per round, out of 10 in total.
  points: {
    rightAnswer: 7, // tapping Scam or Legit correctly
    redFlags: 3,    // tagging the right red flags (or none, for a legit one)
  },

  // Ranks by total score out of 100, highest first.
  ranks: [
    { min: 90, label: 'Scam Slayer', line: 'Scammers would hate you. Nothing gets past you.' },
    { min: 75, label: 'Sharp Spotter', line: 'You caught most of them and read the details.' },
    { min: 60, label: 'Careful Holder', line: 'Good instincts. A few clever ones slipped through.' },
    { min: 40, label: 'Link Clicker', line: 'Some fakes fooled you. Slow down and read the red flags.' },
    { min: 0, label: 'Rekt Rookie', line: 'The scammers won this round. Read the lessons and try again.' },
  ],

  // Red flags players can tag in each round. Scenarios in data/scam-scenarios.js
  // list their flags by these ids. (The message checker has its own rules in
  // data/scam_rules.json.)
  flags: [
    { id: 'secrets', tag: 'Asks for secrets', name: 'Asks for your seed phrase, private key or password' },
    { id: 'returns', tag: 'Too good to be true', name: 'Promises guaranteed or very high returns' },
    { id: 'send-to-receive', tag: 'Send to get more', name: 'Asks you to send crypto to get more back' },
    { id: 'urgency', tag: 'Rushing you', name: 'Rushes you with fake urgency or a countdown' },
    { id: 'fake-support', tag: 'Support DMs you', name: 'A support person or admin messaged you first' },
    { id: 'off-platform', tag: 'Move to a private chat', name: 'Pushes you to a private chat app' },
    { id: 'connect-wallet', tag: 'Connect or sign', name: 'Asks you to connect a wallet or sign something' },
    { id: 'links', tag: 'Odd link', name: 'Has a shortened, unknown or lookalike link' },
    { id: 'fees', tag: 'Pay to unlock', name: 'Asks for a fee to unlock or verify a prize' },
    { id: 'unexpected-offer', tag: 'Surprise prize or job', name: 'Unexpected prize, refund or job from someone you do not know' },
    { id: 'endorsement', tag: 'Famous backer', name: 'Claims backing from a celebrity or an exchange' },
    { id: 'call-to-cancel', tag: 'Call to cancel', name: 'Asks you to call a number to cancel or secure your account' },
    { id: 'rushed-and-sloppy', tag: 'Rushed and sloppy', name: 'Rushed and sloppy writing' },
  ],

  typeLabels: {
    dm: 'Direct message',
    post: 'Social post',
    airdrop: 'Airdrop page',
    token: 'Token page',
    support: 'Support message',
  },

  // Email signup on the end screens of both modes.
  signup: {
    heading: 'Get the free wallet safety chapter',
    line: 'The free chapter on keeping your wallet safe, plus new web3 toys when they launch.',
    button: 'Send me the chapter',
  },

  notes: {
    // The not-financial-advice note is in the page footer (scam/index.html).
    checker: 'The checker is a quick guide, not a final verdict. It can miss scams and can flag honest messages.',
    secondOpinion: 'Want a second opinion from a founder who has been through launches?',
  },
};
