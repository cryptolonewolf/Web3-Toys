-- web3.toys, part 8: admin dashboard data.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Run 001 to 005 first.
--
-- Everything here is readable by admins only (the admins table from part 1).
-- Visitors can only ADD a lead (their own email) or an anonymous event
-- count, through the two small functions below.

-- ---------- Leads: email signups ----------
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  email text not null unique,
  source text,
  page text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  times int not null default 1
);
alter table public.leads enable row level security;
drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads for select using (public.is_admin());

create or replace function public.add_lead(p_email text, p_source text, p_page text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if length(e) > 200 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
  insert into public.leads (email, source, page, user_id)
  values (e, left(p_source, 80), left(p_page, 200), auth.uid())
  on conflict (email) do update set last_seen_at = now(), times = public.leads.times + 1;
  return true;
end; $$;
grant execute on function public.add_lead(text, text, text) to anon, authenticated;

-- ---------- Events: anonymous counts (no names) ----------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  name text not null,
  page text,
  item text,
  created_at timestamptz not null default now()
);
create index if not exists events_name_time on public.events (name, created_at desc);
alter table public.events enable row level security;
drop policy if exists "admins read events" on public.events;
create policy "admins read events" on public.events for select using (public.is_admin());

create or replace function public.log_event(p_name text, p_page text, p_item text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_name not in ('page_view', 'finish', 'share', 'call_click', 'buy_click', 'purchase', 'signup', 'offer_view') then return; end if;
  insert into public.events (name, page, item) values (p_name, left(p_page, 120), left(p_item, 80));
end; $$;
grant execute on function public.log_event(text, text, text) to anon, authenticated;

-- ---------- Project requests (the Work with us form, part 7) ----------
create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  project text not null,
  website text,
  x_handle text,
  kind text not null check (kind in ('toy', 'course')),
  tier text,
  details jsonb not null default '{}',
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'paid', 'in_review', 'approved', 'live', 'declined')),
  checklist jsonb not null default '{}',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_requests enable row level security;
drop policy if exists "own requests read" on public.project_requests;
create policy "own requests read" on public.project_requests for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.admin_update_request(p_id uuid, p_status text, p_checklist jsonb, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.project_requests
    set status = coalesce(p_status, status), checklist = coalesce(p_checklist, checklist), admin_note = coalesce(p_note, admin_note), updated_at = now()
    where id = p_id;
end; $$;
grant execute on function public.admin_update_request(uuid, text, jsonb, text) to authenticated;

-- ---------- Review queue approvals ----------
create table if not exists public.review_approvals (
  file text not null,
  item text not null,
  hash text not null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz not null default now(),
  primary key (file, item)
);
alter table public.review_approvals enable row level security;
drop policy if exists "admins read approvals" on public.review_approvals;
create policy "admins read approvals" on public.review_approvals for select using (public.is_admin());

create or replace function public.admin_approve(p_file text, p_item text, p_hash text, p_undo boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_undo then
    delete from public.review_approvals where file = p_file and item = p_item;
  else
    insert into public.review_approvals (file, item, hash, approved_by) values (p_file, p_item, p_hash, auth.uid())
    on conflict (file, item) do update set hash = excluded.hash, approved_by = excluded.approved_by, approved_at = now();
  end if;
end; $$;
grant execute on function public.admin_approve(text, text, text, boolean) to authenticated;

-- ---------- Admin views ----------
create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin();
$$;
grant execute on function public.am_i_admin() to authenticated;

-- Players, with the email only when they logged in with one.
create or replace function public.admin_users()
returns table (id uuid, display_name text, provider text, email text, created_at timestamptz, last_seen_at timestamptz,
  certificates int, coins int, finished int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.display_name, p.provider, u.email::text, p.created_at, p.last_seen_at,
    (select count(*)::int from public.certificates c where c.user_id = p.id),
    public.coin_balance(p.id),
    (select count(*)::int from public.coin_ledger l where l.user_id = p.id and l.kind = 'finish')
  from public.profiles p join auth.users u on u.id = p.id
  order by p.created_at desc;
end; $$;
grant execute on function public.admin_users() to authenticated;

-- Event counts per name, page and item for the last p_days days.
create or replace function public.admin_event_counts(p_days int default 30)
returns table (name text, page text, item text, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select e.name, e.page, e.item, count(*)
  from public.events e
  where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)))
  group by e.name, e.page, e.item;
end; $$;
grant execute on function public.admin_event_counts(int) to authenticated;
