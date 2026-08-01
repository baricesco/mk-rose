-- ============================================================
--  BillFlow — flag an entity as vacated (tenant/shop owner left)
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: adds one nullable timestamp column. NULL means
--  currently occupied; a timestamp means vacated as of that time.
--  Nothing existing is touched. Safe to re-run.
-- ============================================================

alter table public.entities add column if not exists vacated_at timestamptz;
