-- ============================================================
--  BillFlow — per-entity share link toggle + unguessable link
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  Purely additive: adds two columns (an on/off flag, default true —
--  and a random token used in the link instead of the entity's plain
--  numeric id, so changing e=1 to e=2 in a URL can't be used to browse
--  someone else's bills). Nothing existing is touched. Safe to re-run —
--  running it again after share_enabled already exists is a no-op for
--  that line, and re-running won't rotate an existing share_token.
-- ============================================================

alter table public.entities add column if not exists share_enabled boolean not null default true;

create extension if not exists pgcrypto;
alter table public.entities add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists entities_share_token_uq on public.entities (share_token);
