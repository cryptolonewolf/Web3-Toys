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

  // BOOK A CALL. mode 'calcom': every Book a Call button opens your Cal.com
  // link (calUrl) and Cal.com takes payment with its PayPal app.
  // mode 'razorpay': the Book a Call page takes payment first (Razorpay, or
  // crypto if switched on) for the product below, then shows a Pick your
  // time button that opens calUrl. Leave calUrl empty to show "opens soon".
  call: {
    mode: 'calcom',
    calUrl: 'https://cal.com/buildwithaki/web3-consultation',
    product: 'call-30',
  },

  // Accounts (Supabase). Both values come from Supabase: Project Settings,
  // API. The anon public key is safe in the browser: the database rules
  // decide what it can read. NEVER put the service_role key here.
  // Leave url empty to keep logins switched off.
  supabase: {
    url: 'https://zdufxggiffinqcstoquq.supabase.co',
    anonKey: 'sb_publishable_xfsY4B0dsqJM9TB3f5X5Og_bJcIirOI',
  },

  // Login options shown in the login box. xProvider is 'x' for the newer
  // "X / Twitter (OAuth 2.0)" login in Supabase; use 'twitter' if your
  // Supabase only offers the older "Twitter" one.
  auth: {
    google: true,
    x: true,
    email: true,
    xProvider: 'x',
  },

  // Payments (Razorpay). Turn enabled on after the Part 4 setup
  // (docs/setup/part-4-payments.md). Prices live in data/products.json; the
  // Razorpay keys live only in Supabase, never here.
  // crypto: also offer "Pay with crypto" through Paymento (prices in US
  // dollars, paid straight to your wallet). Needs the Paymento setup too.
  payments: {
    enabled: true,
    crypto: false,
  },

  // Your social accounts (full links). The Earn coins tasks to join or
  // follow them stay hidden until a link is filled in.
  social: {
    x: '',
    telegram: '',
  },

  // Shown on the Contact page (Razorpay asks for these).
  contact: {
    email: 'hi@web3.toys',
    business: 'Build With Aki',
    address: 'Dehradun, Uttarakhand, India',
  },

  // COINS. How many coins each action earns. Each one counts once per toy.
  // daily: opening the first toy of the day. finish: finishing a game.
  // certificate: earning a certificate. share: sharing a result card.
  // x: tapping Post on X (or Share on X). For logged-in players the
  // database decides (coin_rules in supabase/003_progress.sql): keep the two
  // the same. Coins are site points only, with no cash value.
  points: { daily: 5, finish: 20, certificate: 50, share: 10, x: 10 },

  // PROJECT ACADEMY. price: the price line on the List your project page
  // (leave empty to show "From $199"). Applying and paying happen on the
  // Work with us page; the real prices are in data/products.json.
  academy: { price: '' },

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
  // Where the small Book a Call links in toys go.
  callUrl: (function (c) { return !c.calUrl ? '' : c.mode === 'razorpay' ? '/book-a-call/' : c.calUrl; })(window.WEB3TOYS_CONFIG.call || {}),
  bookUrl: window.WEB3TOYS_CONFIG.bookUrl,
};
