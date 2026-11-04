-- web3.toys, part 7: Work with us (custom toys and Academy courses).
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 004_payments.sql and 006_admin.sql first.
--
-- A logged-in visitor sends the request form (submit_request), then pays for
-- it like any other product, with the request's id as the item. When that
-- order is marked paid (by verify-payment, the Razorpay webhook or the
-- Paymento notice), the request moves from Submitted to Paid by itself.
-- You then review it in the admin dashboard: In review, Approved, Live or
-- Declined (refund declined projects in full in Razorpay or Paymento).

-- What each request is paid with: the product id from data/products.json.
alter table public.project_requests drop constraint if exists project_requests_tier_check;
alter table public.project_requests add constraint project_requests_tier_check
  check (tier is null or tier in ('project-toy', 'course-4', 'course-6', 'course-8'));

create or replace function public.submit_request(
  p_kind text, p_tier text, p_project text, p_email text, p_website text, p_x text, p_details jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if p_kind = 'toy' and p_tier is distinct from 'project-toy' then raise exception 'Unknown package.'; end if;
  if p_kind = 'course' and p_tier not in ('course-4', 'course-6', 'course-8') then raise exception 'Unknown package.'; end if;
  if p_kind not in ('toy', 'course') then raise exception 'Unknown package.'; end if;
  if length(btrim(coalesce(p_project, ''))) < 2 or length(p_project) > 120 then raise exception 'Add your project name.'; end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'Add an email we can reply to.'; end if;
  if length(coalesce(p_website, '')) > 300 or length(coalesce(p_x, '')) > 60 then raise exception 'A link is too long.'; end if;
  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object' or length(coalesce(p_details, '{}'::jsonb)::text) > 8000 then raise exception 'Your answers are too long.'; end if;
  if (select count(*) from public.project_requests
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That is a lot of requests today. Email us instead.';
  end if;

  insert into public.project_requests (user_id, email, project, website, x_handle, kind, tier, details)
  values (auth.uid(), btrim(p_email), btrim(p_project), nullif(btrim(coalesce(p_website, '')), ''),
          nullif(btrim(coalesce(p_x, '')), ''), p_kind, p_tier, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.submit_request(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_request(text, text, text, text, text, text, jsonb) to authenticated;

-- When the order for a request is paid, mark the request Paid.
create or replace function public.request_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid')
     and new.product_id in ('project-toy', 'course-4', 'course-6', 'course-8')
     and new.item ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.project_requests
      set order_id = new.id,
          status = case when status = 'submitted' then 'paid' else status end,
          updated_at = now()
      where id = new.item::uuid and tier = new.product_id and user_id = new.user_id
        and (order_id is null or order_id = new.id);
  end if;
  return new;
end; $$;

drop trigger if exists orders_request_paid on public.orders;
create trigger orders_request_paid after insert or update of status on public.orders
  for each row execute function public.request_paid();
