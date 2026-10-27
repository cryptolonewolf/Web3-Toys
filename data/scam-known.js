// Known scams for "Check a message" in Spot the Scam.
//
// If a pasted message contains anything listed below, the checker shows its
// strongest red flag. The list ships with the page, so checking still happens
// only on the visitor's device: nothing they paste is sent anywhere, and
// nothing is looked up online.
//
// HOW TO ADD ONE
//   Put each one on its own line between the backticks (`). No quotes, no commas.
//   Anything after a # on a line is a note, shown next to the match. Use it for
//   what the scam is and where it was reported, for example
//     fake-claim-site.xyz    # fake airdrop page, reported on a security list, Oct 2026
//   Lines that start with # are ignored, so you can keep dates and sources there.
//
// WHAT NOT TO ADD
//   Names of real companies or real people. Scammers pretend to be them, so
//   their names also appear in honest messages, and calling a real business or
//   person a scam on this site could be defamation. List the scammer's own web
//   address, wallet, email, username or wording instead.
//
// Only add entries you are sure about, ideally reported by more than one source.
// A wrong entry could flag someone's honest message.

window.WEB3TOYS_SCAM_KNOWN = {
  // WEB ADDRESSES: just the name, like  fake-claim-site.xyz  (https:// is ignored).
  // This also catches everything under it, like app.fake-claim-site.xyz, and
  // email addresses that use it, like help@fake-claim-site.xyz.
  domains: `
# fake-claim-site.xyz    # example: remove the # at the start of this line to turn it on
`,

  // WALLET ADDRESSES: exactly as reported. 0x addresses match whatever the
  // capitals; other kinds must match exactly.
  addresses: `
# 0x000000000000000000000000000000000000dEaD    # example
`,

  // EMAIL ADDRESSES scammers send from, like  support@fake-claim-site.xyz
  // Capitals do not matter.
  emails: `
# support@fake-claim-site.xyz    # example
`,

  // CHAT USERNAMES scammers use, with or without the @, like  @fake_support_desk
  // Matches when a message mentions @name or t.me/name. Capitals do not matter.
  handles: `
# @fake_support_desk    # example
`,

  // PHONE NUMBERS scammers use, written any way, like  +44 7700 900123
  // Matches however the number is written in the message, with or without
  // spaces, dashes or the country code.
  phones: `
# +44 7700 900123    # example
`,

  // PHRASES copied word for word from scam messages. Use distinctive sentences
  // of at least 5 words that an honest message would not contain. Capitals and
  // punctuation do not matter.
  phrases: `
# your wallet has been selected for the season 3 retroactive reward    # example
`,

  // What the person sees when a message matches the list.
  flag: {
    name: 'Matches a reported scam',
    why: 'This message contains a web address, wallet, email, username, phone number or wording that has been reported as part of a scam.',
    todo: 'Do not open, reply or send anything. Block the sender and report the message where you got it.',
  },
};
