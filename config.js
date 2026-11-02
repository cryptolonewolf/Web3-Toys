// web3.toys settings. Swap the placeholders below when you are ready.
// Everything else (text, questions, ranks) lives in the data/ folder.

window.WEB3TOYS_CONFIG = {
  site: 'web3.toys',
  siteUrl: 'https://web3.toys',
  byline: 'BuildWithAki',

  // EMAIL SIGNUP. Paste the form "action" address from your email tool, and
  // the name of its email field. While empty, the form says signups open soon.
  // web3.toys itself never stores emails.
  signup: {
    endpoint: '',
    emailField: 'email',
    // Extra hidden fields some email tools need, for example { list_id: 'abc' }.
    hidden: {},
  },

  // "BOOK A CALL WITH AKI" button. Paste your booking page link.
  // While empty, the button says booking opens soon.
  bookCallUrl: '',

  // COINS. How many coins each action earns. Each one counts once per toy.
  // daily: opening the first toy of the day. finish: finishing a game.
  // certificate: earning a certificate. share: sharing a result card.
  // x: tapping Post on X (or Share on X).
  points: { daily: 5, finish: 20, certificate: 50, share: 10, x: 10 },

  // PROJECT ACADEMY. price: what a sponsored course costs (shown on the List
  // your project page; leave empty to say "Ask us"). formUrl: the form
  // projects fill in to apply (for example a Tally or Google form). While
  // formUrl is empty, the button says applications open soon.
  academy: { price: '', formUrl: '' },

  // REDEEMING COINS. Requests come to you and you send the coupon yourself.
  // endpoint: a form address (for example from Formspree or your email tool)
  // that receives the request. email: used instead when endpoint is empty;
  // the visitor's email app opens with the request filled in. While both
  // are empty, the button says redeeming opens soon.
  // shopTool: the tool you sell through (for example Gumroad), shown to
  // visitors so they know where the coupon works.
  redeem: { endpoint: '', email: '', shopTool: '' },

  // MASCOT pictures, all in the assets/mascot folder. To use a new drawing
  // for a mood, save it in that folder and put its file name here. If a
  // picture is missing, a simple placeholder drawing shows instead.
  mascot: {
    grin: 'assets/mascot/aki.webp',
    thinking: 'assets/mascot/aki.webp',
    worried: 'assets/mascot/aki.webp',
    celebrating: 'assets/mascot/aki.webp',
    signed: 'assets/mascot/aki-signed.webp',
  },

  // Older toys (Spot the Scam, the simulator) also use these.
  reportUrl: '',
  bookUrl: '',

  // ANALYTICS placeholder. Paste the script address and site id from your
  // analytics tool (for example a privacy-friendly one). While scriptUrl is
  // empty, nothing loads and nothing is tracked.
  analytics: {
    scriptUrl: '',
    siteId: '',
  },
};

// Older toys read their links from WEB3TOYS_SITE; keep them in step.
window.WEB3TOYS_SITE = {
  site: window.WEB3TOYS_CONFIG.site,
  byline: window.WEB3TOYS_CONFIG.byline,
  signup: {
    action: window.WEB3TOYS_CONFIG.signup.endpoint,
    emailField: window.WEB3TOYS_CONFIG.signup.emailField,
    hidden: window.WEB3TOYS_CONFIG.signup.hidden,
  },
  reportUrl: window.WEB3TOYS_CONFIG.reportUrl,
  callUrl: window.WEB3TOYS_CONFIG.bookCallUrl,
  bookUrl: window.WEB3TOYS_CONFIG.bookUrl,
};
