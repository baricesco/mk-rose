-- ============================================================
--  BillFlow — fix a bug from the soft-delete migration
--
--  The soft-delete migration replaced rates' UNIQUE(month, year)
--  with a partial unique index (WHERE deleted_at IS NULL) so a
--  deleted rate wouldn't block re-adding the same period.
--
--  Problem: saveRate() uses an upsert with
--  ON CONFLICT (month, year) — and Postgres cannot target a
--  PARTIAL unique index with a plain ON CONFLICT clause. This
--  silently breaks adding/editing rates.
--
--  There is no delete-rate feature in the app, so rates never
--  actually get soft-deleted. Fix: give rates back a normal,
--  non-partial unique constraint. The deleted_at column stays
--  (harmless, just unused for rates for now).
--
--  Safe to run: there are 0 deleted rate rows, so this constraint
--  cannot fail on existing data.
-- ============================================================

drop index if exists public.rates_month_year_active_uq;

alter table public.rates
  add constraint rates_month_year_key unique (month, year);
