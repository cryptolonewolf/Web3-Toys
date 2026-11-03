-- web3.toys, part 4: payments (Razorpay) and paid downloads.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
--
-- Orders are only written by the payment server functions (they use the
-- secret key). People can read their own orders; nobody can write them from
-- the browser. Paid files sit in a private storage bucket: only the
-- download function can make a short-lived link, after checking the order.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  product_id text not null,
  item text,
  title text not null,
  currency text not null check (currency in ('INR', 'USD')),
  amount int not null check (amount > 0),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  razorpay_order_id text unique not null,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  receipt_sent_at timestamptz
);
create index if not exists orders_user on public.orders (user_id, created_at desc);
alter table public.orders enable row level security;
drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select using (auth.uid() = user_id or public.is_admin());

-- Private bucket for paid files (books and other downloads).
insert into storage.buckets (id, name, public)
values ('paid-files', 'paid-files', false)
on conflict (id) do update set public = false;
