-- web3.toys, part 6: calls booked through Cal.com.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Rows are written only by the cal-webhook function; admins can read them.

create table if not exists public.bookings (
  uid text primary key,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  name text,
  email text,
  status text not null default 'booked' check (status in ('booked', 'paid', 'rescheduled', 'cancelled')),
  paid boolean not null default false,
  price int,
  currency text,
  last_event text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
drop policy if exists "admins read bookings" on public.bookings;
create policy "admins read bookings" on public.bookings for select using (public.is_admin());
