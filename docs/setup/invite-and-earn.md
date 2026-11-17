# Invite and earn: setup

About 2 minutes. Supabase, **SQL Editor**: run `supabase/017_ops.sql` again
(safe), then paste `supabase/025_affiliates.sql` and **Run**. Safe to run
again. Nothing to change in Vercel or the Edge Functions.

## How it works

- Only people with a published web3.toys page earn. Their link is
  web3.toys/?ref=HANDLE (their old invite code works too), and a visit to
  their web3.toys page counts as their link.
- A buyer counts if they signed up with the link (12 months) or came
  through it and bought within 90 days. First link wins; never yourself.
- Share of what the buyer paid: 15%, 20% from 5 paying buyers, 25% from 15,
  30% from 30. Coin unlocks do not count.
- Earnings wait 30 days; toy and test deposits, Quests and ad slots also
  wait until delivered (request live, booking approved). Refunds cancel.
- From $20, the affiliate asks for a payout in /my-page/ (Invite and earn).

## Paying out

Admin, **💸 Affiliates**: each waiting payout shows the amount, the coin,
the network and the wallet. Send it from your own wallet, then **Mark paid**
and paste the transaction hash. Check **Flagged earnings** first (bought
within an hour of joining, $500 or more, the same buyer 3+ times, refunded
after payout). **Reject** puts the earnings back to ready.

Rupee sales are turned into dollars at the rate shown there (85 to start):
press **Change** to set today's rate.

Ask your accountant about tax on commissions you pay to individuals.
