// The toys shown on the home page, in order.
// To add, rename or reorder a toy, edit this list. No other file needs to change.
//
// status: 'live' shows a playable card that links to `path`.
//         'soon' shows a "Coming soon" card that is not clickable.
// color:  card background. 'yellow' or 'white'.
// tags:   small labels on the card.

window.WEB3TOYS_TOYS = [
  {
    title: 'Launch a Token Simulator',
    description:
      'Run a fictional token launch and live through launch week. Every choice has a cost, and every result comes with a lesson.',
    path: 'simulator/',
    status: 'live',
    color: 'yellow',
    tags: [
      { text: '5 minutes', color: 'white' },
      { text: 'New', color: 'mint' },
    ],
  },
  {
    title: 'Spot the Scam',
    description: 'Sort the real messages from the fakes before your holders fall for one.',
    status: 'soon',
    color: 'white',
    tags: [{ text: 'Coming soon', color: 'blue' }],
  },
  {
    title: 'Read the Token Split',
    description: 'Look at who holds the tokens and guess who sells first.',
    status: 'soon',
    color: 'white',
    tags: [{ text: 'Coming soon', color: 'blue' }],
  },
];
