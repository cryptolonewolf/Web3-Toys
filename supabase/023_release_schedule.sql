-- web3.toys: the release schedule of 16 Nov 2026.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 010_releases.sql and 012_early_bird.sql first.
--
--   - Switch on (admin, Releases tab) for items marked onlyIfReady in
--     data/releases.json: they stay locked, even after their date, until
--     you switch them on
--   - Back to schedule keeps a Switch on
--   - Early Bird starts on each toy's own unlock date. Spots players already
--     earned are kept; new spots are counted from the new date. Toys with no
--     date yet start in 2099 (no Early Bird until they get one).

-- ---------- Switch on ----------
alter table public.release_overrides alter column action drop not null;
alter table public.release_overrides drop constraint if exists release_overrides_action_check;
alter table public.release_overrides add constraint release_overrides_action_check check (action is null or action in ('release', 'delay'));
alter table public.release_overrides add column if not exists ready boolean not null default false;

-- p_action: 'release', 'delay' (until p_until, or until you clear it) or
-- null (back to the schedule; a Switch on stays).
create or replace function public.admin_set_release(p_toy text, p_action text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_action is null then
    update public.release_overrides set action = null, until = null, updated_at = now(), updated_by = auth.uid() where toy_id = p_toy and ready;
    delete from public.release_overrides where toy_id = p_toy and not ready;
    return;
  end if;
  if p_action not in ('release', 'delay') then raise exception 'Unknown action'; end if;
  insert into public.release_overrides (toy_id, action, until, updated_by)
  values (p_toy, p_action, case when p_action = 'delay' then p_until else null end, auth.uid())
  on conflict (toy_id) do update set action = excluded.action, until = excluded.until, updated_at = now(), updated_by = excluded.updated_by;
end; $$;
revoke all on function public.admin_set_release(text, text, timestamptz) from public, anon;
grant execute on function public.admin_set_release(text, text, timestamptz) to authenticated;

create or replace function public.admin_set_ready(p_toy text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(p_on, false) then
    insert into public.release_overrides (toy_id, action, ready, updated_by) values (p_toy, null, true, auth.uid())
    on conflict (toy_id) do update set ready = true, updated_by = excluded.updated_by;
  else
    update public.release_overrides set ready = false, updated_by = auth.uid() where toy_id = p_toy;
    delete from public.release_overrides where toy_id = p_toy and action is null and not ready;
  end if;
end; $$;
revoke all on function public.admin_set_ready(text, boolean) from public, anon;
grant execute on function public.admin_set_ready(text, boolean) to authenticated;

-- ---------- Early Bird from each toy's own unlock date ----------
update public.early_bird_toys t set starts_at = v.starts_at::timestamptz
from (values
  ('crypto-in-5', '2026-11-16 10:00:00+05:30'),
  ('scam', '2026-11-16 10:00:00+05:30'),
  ('invest-100', '2026-11-16 10:00:00+05:30'),
  ('dead-projects', '2026-11-16 10:00:00+05:30'),
  ('web3-hacks', '2026-11-19 10:00:00+05:30'),
  ('dont-lose-money', '2026-11-23 10:00:00+05:30'),
  ('token-split', '2026-11-30 10:00:00+05:30'),
  ('getting-started', '2026-12-03 10:00:00+05:30'),
  ('earn-small', '2026-12-07 10:00:00+05:30'),
  ('web3-roles', '2026-12-14 10:00:00+05:30'),
  ('tokenomics-basics', '2099-01-01 10:00:00+05:30'),
  ('hall-of-fame', '2026-11-10 10:00:00+05:30'),
  ('ways-to-moon', '2099-01-01 10:00:00+05:30'),
  ('first-job', '2099-01-01 10:00:00+05:30'),
  ('raise-first-round', '2099-01-01 10:00:00+05:30'),
  ('token-simulator', '2026-11-10 10:00:00+05:30')
) as v (toy, starts_at)
where t.toy = v.toy;
