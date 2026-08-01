-- ============================================================
--  BillFlow — per-entity share link toggle
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: adds one boolean column (default true, so every
--  existing entity's link starts active). Nothing existing is touched.
--  Safe to re-run.
-- ============================================================

alter table public.entities add column if not exists share_enabled boolean not null default true;
