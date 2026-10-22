// Site settings that are not game content. Fill these in once the open
// questions in the spec are answered (which email tool, where the book lives).

export const CONFIG = {
  site: 'web3.toys',
  byline: 'BuildWithAki',

  // Email signup. Paste the form action URL from your email tool (most tools
  // give you an embeddable HTML form; copy its action and field name here).
  // While action is empty, the form shows but tells people signups open soon.
  signup: {
    action: '',
    method: 'POST',
    emailField: 'email',
    // Extra hidden fields some tools need, for example { list_id: 'abc' }.
    hidden: {},
  },

  // Book link. While url is empty, it says "Book coming soon".
  book: {
    url: '',
    label: 'Get the full book, 5 dollars',
  },
};
