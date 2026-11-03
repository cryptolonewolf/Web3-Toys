-- web3.toys: crypto payments with Paymento, next to Razorpay.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Run 004_payments.sql first.

alter table public.orders add column if not exists provider text not null default 'razorpay';
alter table public.orders add column if not exists provider_token text unique;
alter table public.orders alter column razorpay_order_id drop not null;
alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders add constraint orders_provider_check check (provider in ('razorpay', 'paymento'));
-- Paymento: the latest status it reported (for example 3 = waiting for confirmations).
alter table public.orders add column if not exists provider_status int;
