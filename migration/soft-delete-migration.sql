-- ============================================================
--  BillFlow — switch to soft delete (nothing is ever hard-deleted again)
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: adds a nullable column + swaps two UNIQUE
--  constraints for equivalent partial unique indexes. No rows,
--  columns, or tables are dropped. Safe to re-run.
-- ============================================================

-- 1) Add a "deleted_at" marker to every table that can be deleted from.
--    NULL = active/visible. A timestamp = soft-deleted (still in the DB,
--    just hidden from the app and restorable at any time).
alter table public.entities add column if not exists deleted_at timestamptz;
alter table public.bills    add column if not exists deleted_at timestamptz;
alter table public.rates    add column if not exists deleted_at timestamptz;

create index if not exists entities_deleted_at_idx on public.entities (deleted_at);
create index if not exists bills_deleted_at_idx    on public.bills (deleted_at);
create index if not exists rates_deleted_at_idx    on public.rates (deleted_at);

-- 2) bills had `unique (entity_id, month, year)` — with soft delete, a
--    deleted bill would otherwise permanently block re-adding a reading
--    for that same entity/month/year. Replace it with a *partial* unique
--    index that only enforces uniqueness among ACTIVE rows.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.bills'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%entity_id%'
      and pg_get_constraintdef(oid) ilike '%month%'
      and pg_get_constraintdef(oid) ilike '%year%';
  if c is not null then
    execute format('alter table public.bills drop constraint %I', c);
  end if;
end $$;

create unique index if not exists bills_entity_month_year_active_uq
  on public.bills (entity_id, month, year) where deleted_at is null;

-- 3) Same treatment for rates' `unique (month, year)`.
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.rates'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%month%'
      and pg_get_constraintdef(oid) ilike '%year%';
  if c is not null then
    execute format('alter table public.rates drop constraint %I', c);
  end if;
end $$;

create unique index if not exists rates_month_year_active_uq
  on public.rates (month, year) where deleted_at is null;

-- 4) Sanity check — should show 0 deleted rows right after running this.
select
  (select count(*) from public.entities where deleted_at is not null) as deleted_entities,
  (select count(*) from public.bills    where deleted_at is not null) as deleted_bills,
  (select count(*) from public.rates    where deleted_at is not null) as deleted_rates;
