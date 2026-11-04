# Part 7 setup: Work with us

About 5 minutes.

## Step 1. Database

Supabase, **SQL Editor**, **New query**: paste all of
`supabase/009_work_with_us.sql` and click **Run**. Safe to run again.

This adds:

- `submit_request`: saves the request form (only for logged-in visitors, at
  most 5 a day each).
- A database rule that marks a request **Paid** by itself when its payment
  comes through (Razorpay or crypto).

No new Edge Functions or secrets are needed.

## Step 2. Test it (Razorpay test mode)

1. Open **web3.toys/work-with-us/** on your phone and pick a package.
2. Fill in the form, tick the box and tap **Send request and pay**.
3. Pay with a Razorpay test card. The request under **Your requests** should
   change to **Paid**.
4. Open **web3.toys/admin/**, **Project requests**. Tick the vetting
   checklist, then set **In review**, **Approved**, **Live** or **Declined**.
   The visitor sees each step on the Work with us page.

## Declining a project

Click **Decline** in the admin dashboard, then refund the payment in full:
Razorpay dashboard, **Payments**, open the payment, **Refund**; or in
Paymento for crypto. The visitor sees "Declined: your full refund is on its
way".

## Prices

In `data/products.json`: `project-toy` ($999), `course-4` ($199),
`course-6` ($349), `course-8` ($499), with rupee prices next to them. The
words on the page are in `data/work.json`.
