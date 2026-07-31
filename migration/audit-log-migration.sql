-- ============================================================
--  BillFlow — add an audit log (who/what/when for every change)
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: creates one new table. Nothing existing is
--  touched. Safe to re-run.
-- ============================================================

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,               -- 'entities' | 'bills' | 'rates' | 'settings'
  record_id   bigint,
  action      text not null,               -- 'create' | 'update' | 'delete' | 'restore'
  summary     text not null,               -- human-readable description
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "anon all audit_log" on public.audit_log;
create policy "anon all audit_log" on public.audit_log for all to anon, authenticated using (true) with check (true);
