// Settings shared by every toy: where the signup form sends emails, and the
// links behind the "Get the full report" and "Book a call" buttons.
//
// While a link is empty (''), its button still shows, and tapping it says
// the thing is coming soon. Paste the real link between the quotes when ready.

window.WEB3TOYS_SITE = {
  site: 'web3.toys',
  byline: 'BuildWithAki',

  // Email signup. Paste the form "action" URL from your email tool, and the
  // name of its email field. Nothing is stored by web3.toys itself.
  signup: {
    action: '',
    emailField: 'email',
    // Extra hidden fields some email tools need, for example { list_id: 'abc' }.
    hidden: {},
  },

  // Link for the "Get the full report" button.
  reportUrl: '',

  // Link for the "Book a call" button, for example your calendar booking page.
  callUrl: '',
};
