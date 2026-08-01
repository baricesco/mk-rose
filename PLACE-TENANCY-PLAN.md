# Place / Tenancy Model — Plan

## The problem

Right now `entities` conflates two different things into one row:

1. **The physical unit** — a specific flat or shop in the building. This
   doesn't change. "Shop 3" is "Shop 3" forever.
2. **Whoever currently occupies it** — a tenant/owner, their name, phone,
   and their entire bill history (readings, payments, arrears).

Because both live in one row, when a person moves out and someone new
moves in, there's no clean way to say "new tenant, same shop" — you're
stuck either renaming the existing entity (which rewrites/loses the old
tenant's billing history under a new name) or creating an entirely
disconnected new entity with no link back to "this is the same physical
shop as before." The new "vacated" flag (`vacated_at`, shipped earlier)
band-aids the *status* problem (marking someone as gone) but doesn't
solve the *continuity* problem — there's still no first-class concept of
"this shop/flat, across everyone who's ever occupied it."

## The goal

- A fixed, known list of physical **places** (flats + shops) — the
  building's actual unit list, which you'll provide.
- Each **entity** (the thing that owns bill history) points at one place,
  the way it already points at nothing structural today.
- Moving a new tenant in = create a *new* entity row linked to the same
  place. The old entity (old tenant) keeps its full history untouched
  and stays visible/vacated. The place's identity (e.g. "Shop 3")
  persists across every tenant who's ever been in it.
- One person can hold multiple places (e.g. the same owner has Shop 3
  and Flat 12) — this already works today since `owner_name` is a free
  text field with no uniqueness constraint, so no schema change is
  strictly required for that part. The only improvement worth making is
  a **dropdown of known people** instead of retyping a name each time,
  so "M. Abbas" doesn't become "M Abbass" on a second entity by typo —
  see Phase 4, optional.

## Proposed schema changes

### New table: `places`

```sql
create table public.places (
  id         bigint generated always as identity primary key,
  name       text not null,               -- "Shop 3", "Flat 12", etc.
  type       text not null check (type in ('flat','shop')),
  meter      text,                        -- see open question below
  created_at timestamptz not null default now()
);
```

Seeded once from the list you provide (shop names + flat names). This
table changes rarely — new rows only when the building physically adds
a unit, never per-tenant.

### `entities` gets a `place_id`

```sql
alter table public.entities add column if not exists place_id bigint references public.places(id);
```

Nullable at first so existing rows aren't broken, then backfilled once
we map your existing entities to the new `places` list, then (ideally)
made `not null` once every entity has a place.

### `entities` also gets an `occupied_at` (mirrors `vacated_at`)

```sql
alter table public.entities add column if not exists occupied_at timestamptz;
```

Same shape as the existing `vacated_at` — nullable, optional. Records
when this tenancy started, the same way `vacated_at` records when it
ended. Both fields move from "month + year only" to "month + year,
with an optional exact day":

- If a day is given, store that exact date.
- If left blank, fall back to today's existing default — last day of
  the chosen month for `vacated_at` (they were still there through that
  month), first day of the chosen month for `occupied_at` (move-in is
  naturally a start-of-period date, not an end-of-period one).

This means the current "Mark as vacated" dialog also gets a small
retrofit: keep the month+year selector as the required fields, add an
optional day field next to it for when you know the exact date.

### `entities.name` today vs. after

Today `name` is doing double duty — sometimes it reads like a place
("Flat 4"), sometimes like a tenant's business name ("M. Abbas Karyana
Store"). After this change, the *place* owns the "Shop 3 / Flat 12"
identity, and `entities.name` can either:
- (a) stay as the tenant/business display name (what shows on bills), or
- (b) be dropped in favor of always deriving the display as
  `place.name + owner_name`, e.g. "Shop 3 — M. Abbas Karyana Store".

Leaning toward (a): keep `entities.name` as-is (tenant/business name,
editable per-tenancy), and let the UI show `place.name` alongside it as
context, rather than replacing a field bills already depend on. Final
call once real data is in front of us.

## New workflow

**Add Entity modal** gets a required "Place" dropdown (populated from
`places`, grouped Flats/Shops) instead of — or alongside — the current
free-text name field. Selecting a place doesn't restrict anything else;
you still fill in owner name/phone/meter/opening reading same as today.

**"New tenant" quick action**: from an entity that's marked vacated
(or from a place's own view, once that exists), a button like *"Move a
new tenant into Shop 3"* opens the Add Entity modal pre-filled with that
`place_id`, so the operator doesn't have to remember the place's exact
name/spelling — just fill in the new tenant's details and save. The old
(vacated) entity is left completely alone.

Because it's the same physical meter, this flow inherits continuity
from the vacated entity's last bill instead of starting from a blank
"initial reading":
- **Opening reading** is pre-filled from the previous tenant's last
  bill's `curr_reading` — that's the true current state of the meter,
  so the new tenant's first bill starts from the right number instead
  of an operator having to remember/re-check it.
- **The previous tenant's last bill photo** is carried over and shown
  as the starting reference photo (what the meter looked like at
  handover), even before the new tenant's own first reading photo
  exists.

The dialog also asks **"When did they occupy this flat/shop?"** — a
month+year selector plus an optional exact-day field, saved as
`occupied_at` (same shape/rules as `vacated_at`, see schema section
above).

**Entities list**: add a "Place" column/filter so you can see, at a
glance, every tenant who's ever been tied to a given place (handy for
"who was in Shop 3 before this guy").

## What does NOT change

- Billing math, arrears/carry-forward logic, month locking — all
  operate on `entities`/`bills` exactly as now; `place_id` is purely an
  added label, not part of the billing engine.
- Share links (`share_token`) stay per-entity, not per-place — a
  tenant's share link only ever shows *their own* tenancy's bills, never
  a previous or future tenant's, which is almost certainly what you want
  (nobody should see the prior tenant's payment history).
- `vacated_at` keeps meaning exactly what it means today: this specific
  tenancy (entity) has ended. It's what triggers the "new tenant"
  quick-action, not a replacement for it.
- `occupied_at` is informational only, same as `vacated_at` — neither
  one feeds into arrears/carry-forward math, which still runs purely
  off bill rows.

## Open questions (need your input before Phase 1 lands)

1. **The actual place list** — every flat name/number and every shop
   name/number, and their types. This is the blocking input; nothing
   below can be seeded without it.
2. **Does the electricity meter belong to the place or the tenant?**
   If the meter is physically wired to the unit (typical for a
   building), `meter` should live on `places` and every tenant of that
   unit inherits the same meter number automatically. If tenants
   sometimes get a fresh meter/connection, it should stay on `entities`
   like today. This changes which table owns `meter`.
3. **Naming convention** — do flats/shops have stable numbers (e.g.
   "Flat 12") independent of who's living there, or are some currently
   named after the shop's business (meaning the "place name" itself
   changes when the business changes, not just the tenant)? This decides
   whether `places.name` can truly stay fixed forever or needs occasional
   editing too.
4. **Do you want the People-dropdown (Phase 4)**, or is free-text
   owner name/phone per entity good enough? It's a nice-to-have, not
   required for the core place/tenancy fix.

## Phased implementation

- **Phase 1 — schema + seed**: create `places`, seed it from your list,
  add `entities.place_id` (nullable), backfill existing entities to the
  right place based on their current `name`/`meter`.
- **Phase 2 — Add Entity UI**: add the Place dropdown to the Add/Edit
  Entity modal; entities list gets a Place column + filter.
- **Phase 3 — "Move new tenant in" quick action**: one-click flow from
  a vacated entity straight into a pre-filled Add Entity modal for the
  same place.
- **Phase 4 (optional)** — a `people` table + dropdown so
  owner name/phone are picked from a known list instead of retyped,
  enabling "show me every place this person has ever held" as a real
  query instead of a text-match guess.

Phase 1 is blocked on the place list (#1 above) — everything else can
be built/reviewed in the meantime once that's the only missing piece.
