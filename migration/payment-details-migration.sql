-- ============================================================
--  BillFlow — record payment mode + remarks when a bill is marked paid
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: adds two nullable columns to bills. Nothing
--  existing is touched. Safe to re-run.
-- ============================================================

alter table public.bills add column if not exists payment_mode    text;
alter table public.bills add column if not exists payment_remarks text;
