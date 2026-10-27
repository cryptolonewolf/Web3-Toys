// Known scams for "Check a message" in Spot the Scam.
//
// If a pasted message contains any web address or wallet address listed below,
// the checker shows its strongest red flag. The list ships with the page, so
// checking still happens only on the visitor's device: nothing they paste is
// sent anywhere, and nothing is looked up online.
//
// HOW TO ADD ONE
//   Put each one on its own line between the backticks (`). No quotes, no commas.
//   Anything after a # on a line is a note, shown next to the match, for
//   example "fake airdrop page". Lines that start with # are ignored, so you
//   can keep dates and sources there.
//
// WEB ADDRESSES: just the name, like  fake-claim-site.xyz
//   No https:// needed (it is removed if you paste it). Listing a name also
//   catches everything under it, like app.fake-claim-site.xyz, and email
//   addresses that use it, like help@fake-claim-site.xyz.
//
// WALLET ADDRESSES: paste them exactly as reported.
//   Addresses starting with 0x match whatever the capital letters.
//   Other kinds must match exactly, capitals included.
//
// Only add entries you are sure about, and note where each one came from.
// A wrong entry could flag someone's honest message.

window.WEB3TOYS_SCAM_KNOWN = {
  domains: `
# Example. Remove the # at the start of the next line to turn it on:
# fake-claim-site.xyz    # fake airdrop page, reported by our community, Oct 2026
`,

  addresses: `
# Example. Remove the # at the start of the next line to turn it on:
# 0x000000000000000000000000000000000000dEaD    # address from a fake giveaway
`,

  // What the person sees when a message matches the list.
  flag: {
    name: 'Contains a known scam address',
    why: 'This message includes a web address or wallet address that has been reported as part of a scam.',
    todo: 'Do not open it and do not send anything to it. Block the sender and report the message where you got it.',
  },
};
