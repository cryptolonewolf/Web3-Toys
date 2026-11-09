-- web3.toys: For Projects requests (Launch Your Own Toy, Test Your Product).
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 004_payments.sql and 006_admin.sql first.
--
-- A logged-in visitor sends the request form (submit_biz_request), then can
-- pay a 50% deposit (product deposit-toy-TIER or deposit-test-TIER, with
-- the request id as the item). When the deposit is paid the request moves
-- to Paid by itself. You review it in admin: In review, Approved, Building,
-- Live, Declined (refund the deposit with the Refund button).

create table if not exists public.biz_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('toy', 'test')),
  tier text not null check (tier ~ '^[a-z0-9-]{2,30}$'),
  project text not null,
  website text,
  x_handle text,
  email text not null,
  product text,
  launch_date date,
  idea text,
  details jsonb not null default '{}',
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'paid', 'in_review', 'approved', 'building', 'live', 'declined', 'refunded')),
  checklist jsonb not null default '{}',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.biz_requests enable row level security;
drop policy if exists "own biz requests read" on public.biz_requests;
create policy "own biz requests read" on public.biz_requests for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.submit_biz_request(
  p_kind text, p_tier text, p_project text, p_website text, p_x text, p_email text,
  p_product text, p_launch date, p_idea text, p_details jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if p_kind not in ('toy', 'test') then raise exception 'Unknown product.'; end if;
  if coalesce(p_tier, '') !~ '^[a-z0-9-]{2,30}$' then raise exception 'Pick a package.'; end if;
  if length(btrim(coalesce(p_project, ''))) < 2 or length(p_project) > 120 then raise exception 'Add your project name.'; end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'Add an email we can reply to.'; end if;
  if length(coalesce(p_website, '')) > 300 or length(coalesce(p_x, '')) > 60 then raise exception 'A link is too long.'; end if;
  if length(coalesce(p_product, '')) > 1200 or length(coalesce(p_idea, '')) > 2000 then raise exception 'Your answers are too long.'; end if;
  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object' or length(coalesce(p_details, '{}'::jsonb)::text) > 8000 then raise exception 'Your answers are too long.'; end if;
  if (select count(*) from public.biz_requests where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That is a lot of requests today. Email us instead.';
  end if;
  insert into public.biz_requests (user_id, kind, tier, project, website, x_handle, email, product, launch_date, idea, details)
  values (auth.uid(), p_kind, p_tier, btrim(p_project), nullif(btrim(coalesce(p_website, '')), ''), nullif(btrim(coalesce(p_x, '')), ''),
          btrim(p_email), nullif(btrim(coalesce(p_product, '')), ''), p_launch, nullif(btrim(coalesce(p_idea, '')), ''), coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.submit_biz_request(text, text, text, text, text, text, text, date, text, jsonb) from public, anon;
grant execute on function public.submit_biz_request(text, text, text, text, text, text, text, date, text, jsonb) to authenticated;

-- When a deposit is paid (or refunded), update its request.
create or replace function public.biz_deposit_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id like 'deposit-%' and new.item ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      update public.biz_requests
        set order_id = new.id, status = case when status = 'submitted' then 'paid' else status end, updated_at = now()
        where id = new.item::uuid and user_id = new.user_id and new.product_id = 'deposit-' || kind || '-' || tier
          and (order_id is null or order_id = new.id);
    elsif new.status = 'refunded' and tg_op = 'UPDATE' and old.status is distinct from 'refunded' then
      update public.biz_requests set status = 'refunded', updated_at = now() where order_id = new.id;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists orders_biz_deposit on public.orders;
create trigger orders_biz_deposit after insert or update of status on public.orders
  for each row execute function public.biz_deposit_paid();

create or replace function public.admin_update_biz(p_id uuid, p_status text, p_checklist jsonb, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.biz_requests
    set status = coalesce(p_status, status), checklist = coalesce(p_checklist, checklist), admin_note = coalesce(p_note, admin_note), updated_at = now()
    where id = p_id;
end; $$;
revoke all on function public.admin_update_biz(uuid, text, jsonb, text) from public, anon;
grant execute on function public.admin_update_biz(uuid, text, jsonb, text) to authenticated;
