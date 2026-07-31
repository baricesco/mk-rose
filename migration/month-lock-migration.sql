-- ============================================================
--  BillFlow — add month locking (freeze a billing period)
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: creates one new table. Nothing existing is
--  touched. Safe to re-run.
-- ============================================================

create table if not exists public.locked_periods (
  month      int not null check (month between 1 and 12),
  year       int not null,
  locked_at  timestamptz not null default now(),
  primary key (month, year)
);

alter table public.locked_periods enable row level security;

drop policy if exists "anon all locked_periods" on public.locked_periods;
create policy "anon all locked_periods" on public.locked_periods for all to anon, authenticated using (true) with check (true);
