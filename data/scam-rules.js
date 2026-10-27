// Rules for "Check a message" in Spot the Scam. Edit this file to add or change
// rules. No other file needs to change.
//
// Each rule has:
//   id        a short name with no spaces. The game's scenarios use it too.
//   name      the red flag, as people see it in the results.
//   tag       a very short label for the tag buttons in the game.
//   weight    how serious it is: 1 (mild), 2 (strong), 3 (very strong).
//   keywords  words or phrases to look for. Capitals do not matter.
//   patterns  (optional, advanced) regular expressions, for wording that varies.
//   skipIfNegated  (optional) true to ignore a keyword when "never", "no" and
//            similar words come just before it, as in "we will never ask for it".
//   why       why this is a red flag, in plain words.
//   todo      what to do instead.
//
// Two rules work a little differently and say so below: "links" looks at web
// addresses, and "rushed-and-sloppy" needs the "urgency" rule to match too.
// The checker never visits or opens any link. It only reads the text.

window.WEB3TOYS_SCAM_RULES = {
  rules: [
    {
      id: 'secrets',
      name: 'Asks for your seed phrase, private key or password',
      tag: 'Asks for secrets',
      weight: 3,
      keywords: [
        'seed phrase', 'seed words', 'recovery phrase', 'secret phrase', 'secret recovery',
        'backup phrase', 'mnemonic', 'private key', 'your 12 words', 'your 24 words',
        '12-word', '24-word', 'enter your password', 'share your password', 'send your password',
        'confirm your password', 'verify your password', 'login details', 'passcode', '2fa code',
        'verification code', 'one-time code', 'authenticator code', 'enter your phrase',
        'import your wallet', 'keystore file',
      ],
      skipIfNegated: true,
      why: 'Your seed phrase, private key and passwords are the keys to your money. Anyone who has them can empty your wallet, and no real company or support team will ever ask for them.',
      todo: 'Never share them, not even with support. If you already did, move your funds to a brand new wallet right away.',
    },
    {
      id: 'returns',
      name: 'Promises guaranteed or very high returns',
      tag: 'Too good to be true',
      weight: 2,
      keywords: [
        'guaranteed', 'risk-free', 'risk free', 'no risk', 'zero risk', 'double your',
        'triple your', '10x', '100x', '1000x', 'daily profit', 'daily returns',
        'passive income', 'cannot lose', "can't lose", 'sure profit', 'profit every day',
      ],
      patterns: [
        '\\b\\d{2,4}\\s?%\\s?(daily|a day|per day|today|weekly|a week|per week|monthly|apy|apr|returns?|profit|gains?)',
      ],
      why: 'Nobody can guarantee returns in crypto, and very high promised returns are the classic bait. Real projects talk about risk.',
      todo: 'Treat any "guaranteed" profit as a scam. Do not send money to find out.',
    },
    {
      id: 'send-to-receive',
      name: 'Asks you to send crypto to get more back',
      tag: 'Send to get more',
      weight: 3,
      keywords: [
        'send back double', 'send you back double', 'we will send back', 'return double',
        'double it back', 'doubling event', 'send and receive', 'send 1 get 2',
      ],
      patterns: [
        '\\bsend\\b.{0,60}\\b(get|receive|back)\\b.{0,30}\\b(double|2x|twice|more|bonus)\\b',
        '\\bsend\\b.{0,40}\\bto (this|the following|our) (address|wallet)\\b',
        '\\bsend \\d[\\d,.]*\\s?\\w*\\s?(to )?(get|receive) \\d',
      ],
      why: 'No one gives away crypto by asking you to send some first. Whatever you send is gone.',
      todo: 'Never send crypto to "verify" or "receive" more. Real giveaways never ask for money.',
    },
    {
      id: 'urgency',
      name: 'Rushes you with fake urgency or a countdown',
      tag: 'Rushing you',
      weight: 1,
      keywords: [
        'act now', 'urgent', 'urgently', 'immediately', 'right away', 'within 24 hours',
        'within 48 hours', 'expires today', 'expires soon', 'last chance', 'only today',
        'final notice', 'final warning', 'limited time', 'hurry', 'countdown',
        "before it's too late", 'before it is too late', 'will be suspended',
        'will be locked', 'will be deleted', 'spots left', 'ending soon',
      ],
      patterns: ['\\b\\d{1,3}\\s?(hours?|hrs?|minutes?|mins?)\\s?(left|remaining|only)\\b'],
      why: 'Scammers rush you so you act before you think. Real deadlines leave you time to check.',
      todo: 'Slow down. Close the message and check with the company through its official app or website.',
    },
    {
      id: 'fake-support',
      name: 'A support person or admin messaged you first',
      tag: 'Support DMs you',
      weight: 2,
      keywords: [
        'support team', 'support agent', 'customer support', 'customer care', 'help desk',
        'technical team', 'tech support', 'admin here', 'i am an admin', 'moderator here',
        'from support', 'saw your complaint', 'saw your issue', 'your ticket', 'resolve your issue',
        'your wallet has been flagged', 'your account has been flagged', 'unusual activity',
        'suspicious activity', 'compromised',
      ],
      patterns: ["\\b(i am|i'm|this is|we are)( from| with)? .{0,30}\\b(support|admin|moderator|help desk)\\b"],
      skipIfNegated: true,
      why: 'Real support teams and admins do not message you first. Fake support accounts watch public chats and jump in when someone asks for help.',
      todo: 'Only get help through the official app or website you opened yourself. Ignore anyone who reaches out to you.',
    },
    {
      id: 'off-platform',
      name: 'Pushes you to a private chat app',
      tag: 'Move to a private chat',
      weight: 2,
      keywords: [
        'telegram', 'whatsapp', 'signal app', 'message me privately', 'dm me', 'text me',
        'add me on', 'continue on', 'move this chat', 'private chat', 'private group',
        'vip group', 't.me/', 'wa.me/',
      ],
      why: 'Moving you to a private chat takes you away from public places where others could warn you, and away from the platform\'s safety tools.',
      todo: 'Keep conversations on official channels. Do not follow strangers into private chats.',
    },
    {
      id: 'connect-wallet',
      name: 'Asks you to connect a wallet or sign something',
      tag: 'Connect or sign',
      weight: 2,
      keywords: [
        'connect your wallet', 'connect wallet', 'sign the transaction', 'sign this',
        'sign the message', 'approve the transaction', 'approve this', 'validate your wallet',
        'verify your wallet', 'sync your wallet', 'synchronize your wallet', 'rectify',
        'wallet validation', 'claim page', 'dapp to fix', 'migrate your tokens', 'unlimited approval',
        'verify ownership', 'by signing',
      ],
      skipIfNegated: true,
      why: 'Connecting to an unknown site and signing a request can give it permission to take your tokens. One signature is enough.',
      todo: 'Only connect your wallet to sites you typed in yourself or reached from the project\'s official page. If unsure, do not sign.',
    },
    {
      id: 'links',
      name: 'Has a shortened, unknown or lookalike link',
      tag: 'Odd link',
      weight: 2,
      // This rule reads web addresses in the text. It never opens them.
      // shorteners:   link shorteners that hide where a link goes.
      // riskyEndings: domain endings that scams use a lot.
      // riskyWords:   words scammers add to a fake domain to make it look official.
      domains: {
        shorteners: [
          'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at',
          'ow.ly', 'tiny.cc', 'rebrand.ly', 'linktr.ee',
        ],
        riskyEndings: [
          '.xyz', '.top', '.click', '.site', '.online', '.live', '.icu', '.buzz', '.cyou',
          '.rest', '.monster', '.shop', '.zip', '.lol', '.vip',
        ],
        riskyWords: [
          'claim', 'airdrop', 'verify', 'validate', 'support', 'help', 'secure', 'wallet-fix',
          'official', 'reward', 'bonus', 'giveaway', 'unlock', 'restore', 'login', 'recover',
        ],
      },
      why: 'Shortened links hide where they go, and fake sites use addresses that look almost like the real one, with an extra word, a swapped letter or an odd ending.',
      todo: 'Do not tap it. Type the official address yourself, or use a bookmark you saved earlier.',
    },
    {
      id: 'fees',
      name: 'Asks for a fee to unlock or verify a prize',
      tag: 'Pay to unlock',
      weight: 3,
      keywords: [
        'unlock fee', 'release fee', 'activation fee', 'verification fee', 'processing fee',
        'withdrawal fee', 'gas fee to claim', 'pay a small fee', 'small fee', 'pay to claim',
        'clearance fee', 'tax before withdrawal', 'deposit to unlock',
      ],
      patterns: [
        '\\b(pay|send|deposit)\\b.{0,40}\\b(fee|gas|tax)\\b.{0,50}\\b(claim|unlock|release|verify|receive|withdraw)',
        '\\b(claim|unlock|release|receive|withdraw)\\b.{0,40}\\b(pay|send|deposit)\\b.{0,30}\\b(fee|gas|tax)\\b',
        '\\bpay (a |the )?(small |tiny |one-time |minimal )?(\\w+ )?fee\\b',
      ],
      why: 'Real prizes, refunds and airdrops never ask you to pay first. The fee is the scam, and the prize never comes.',
      todo: 'Do not pay anything to receive something. Walk away.',
    },
    {
      id: 'unexpected-offer',
      name: 'Unexpected prize, refund or job from someone you do not know',
      tag: 'Surprise prize or job',
      weight: 2,
      keywords: [
        'you have won', "you've won", 'you won', 'congratulations', 'lucky winner', 'winner',
        'you are eligible', "you're eligible", 'you have been selected', "you've been selected",
        'claim your reward', 'claim your prize', 'unclaimed', 'refund', 'compensation',
        'job offer', 'we are hiring', 'remote job', 'earn per task', 'task-based', 'easy money',
        'work from home', 'feature you', 'feature your',
      ],
      why: 'Out-of-the-blue prizes, refunds and jobs are a common way in. They make you excited enough to skip the checks.',
      todo: 'If you did not enter or apply, it is not real. Check with the company through its official website.',
    },
    {
      id: 'endorsement',
      name: 'Claims backing from a celebrity or an exchange',
      tag: 'Famous backer',
      weight: 2,
      keywords: [
        'endorsed by', 'backed by', 'partnered with', 'in partnership with', 'official partner',
        'approved by', 'as seen on', 'celebrity', 'famous investor', 'top exchange',
        'major exchange', 'listing confirmed', 'guaranteed listing',
      ],
      why: 'Scams borrow famous names to look trustworthy. These claims are easy to fake and almost never true.',
      todo: 'Look for the announcement on the official website or account of the person or exchange named. If it is not there, it is not real.',
    },
    {
      id: 'rushed-and-sloppy',
      name: 'Rushed and sloppy writing',
      tag: 'Rushed and sloppy',
      weight: 2,
      // Only counts when the "urgency" rule also matched, and at least
      // `minMatches` of these writing signs are found. Web addresses are left
      // out before checking, and the patterns below care about capital letters.
      requires: ['urgency'],
      minMatches: 2,
      ignoreLinks: true,
      patternsCaseSensitive: true,
      keywords: [
        'kindly', 'dear customer', 'dear user', 'dear valued', 'do the needful', 'revert back',
        'pls', 'plz', 'u r', 'ur wallet', 'ur account',
      ],
      patterns: [
        '!{2,}',                       // "!!" or more
        '\\b[A-Z]{4,}\\b.*\\b[A-Z]{4,}\\b.*\\b[A-Z]{4,}\\b', // three or more SHOUTED words
        '[a-z][.!?,][A-Za-z]',         // no space after punctuation
        '\\s{3,}',                     // odd gaps
      ],
      why: 'Pressure plus careless writing is a common sign of a mass-sent scam. Real companies proofread their messages.',
      todo: 'Do not reply or tap anything. Report the message and check your account through the official app.',
    },
  ],

  // How the result is labelled. A result is "many" when the total weight of
  // red flags found reaches manyAt, or at least manyCount different flags.
  // Words that cancel a match when they come just before it in the same part of
  // a sentence, for rules marked skipIfNegated. So "we will never ask for your
  // recovery phrase" is not counted, but "enter your recovery phrase" is.
  negations: ['never', 'not', 'no', "don't", 'dont', "won't", 'without', 'nobody'],

  labels: {
    manyAt: 6,
    manyCount: 3,
    many: 'Many red flags',
    some: 'Some red flags',
    none: 'No obvious red flags',
    noneNote: 'This does not mean it is safe. Check with the real company through its official website or app, not through the message.',
  },

  // A short fictional scam that fills the box when someone taps "Try an example".
  example:
    'Dear user, your Puddle Wallet has been flagged for unusual activity!! Our support team will lock it within 24 hours. Kindly verify your wallet at puddle-wallet-verify.xyz and enter your 12 word recovery phrase to keep your funds safe. Message our admin on Telegram for help.',
};
