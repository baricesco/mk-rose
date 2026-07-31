-- ============================================================
--  BillFlow — simple table-based login (NOT Supabase Auth)
--  Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--
--  This is a lightweight UI gate, not a real security boundary:
--  the anon key is public (it ships in the client bundle), and the
--  app's existing tables already use permissive "anon all ... using
--  (true)" policies, so anyone with the anon key can already reach
--  the underlying data via the REST API regardless of this screen.
--  It stops casual/accidental access to the UI; it does not replace
--  Supabase Auth as an access-control layer.
--
--  Passwords are still hashed (via pgcrypto) and the accounts table
--  has NO anon/authenticated policies at all — the only way to check
--  a password is through verify_login() below, which runs as
--  SECURITY DEFINER so it can read the table while nobody can query
--  it directly. The hash itself is never sent to the browser.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  password_hash text not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- RLS enabled with zero policies = nobody (anon or authenticated) can
-- select/insert/update/delete this table directly, from the client.
alter table public.accounts enable row level security;

create or replace function public.verify_login(p_username text, p_password text)
returns table (ok boolean, display_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select true, a.display_name
    from public.accounts a
    where a.username = p_username
      and a.password_hash = crypt(p_password, a.password_hash)
    limit 1;
end;
$$;

revoke all on function public.verify_login(text, text) from public;
grant execute on function public.verify_login(text, text) to anon, authenticated;

-- ── Add your own account(s) ──────────────────────────────────
-- Run this yourself (in the SQL editor) with a real username/password —
-- nothing is seeded automatically. crypt()/gen_salt('bf') hashes it
-- server-side; the plaintext password never gets stored.
--
-- insert into public.accounts (username, password_hash, display_name)
-- values ('accountant@riviera', crypt('choose-a-strong-password', gen_salt('bf')), 'Accountant');
