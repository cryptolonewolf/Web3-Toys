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
