# MK ROSE

Electricity billing for one building's flats and shops. Register a unit, enter
a monthly meter reading with a photo, and it works out units × rate with an
arrears carry-forward chain, prints PDF bills, and gives each tenant a
read-only share link.

Static site — no build step, no bundler, no `npm install`. Open `index.html`
over any HTTP server and it runs. Supabase is the backend.

```
python3 -m http.server 8000     # then http://127.0.0.1:8000
```

Deployed on Vercel from `main`. `migration/` and `*.sql` are excluded from the
deploy by `.vercelignore`.

## Layout

| Path | What |
|---|---|
| `index.html` | The whole app's markup: login, 9 pages, 13 modals. Behaviour lives in `js/`. |
| `share.html` | Public read-only page for one entity, resolved by `?s=<share_token>`. |
| `css/style.css` | All styling. Light + dark via `:root[data-theme]` tokens at the top. |
| `js/*.js` | Plain classic scripts sharing one global scope, loaded in dependency order at the bottom of `index.html`. Order matters. |
| `migration/*.sql` | The de-facto schema history. Each is idempotent — run once in the Supabase SQL editor. |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA. |

Two `<script>` blocks in `<head>` run before first paint and must stay inline:
they set `data-theme` and `data-authed` from localStorage so there's no flash
of the wrong theme or of the login screen on an already-signed-in reload.

## Billing model

Everything derives from bill rows; no month list is hardcoded.

```
ownUnits  = curr − prev                  this month's consumption
ownCharge = ownUnits × rate              this month's own charge
arrears   = sum of ownCharge over the unbroken run of UNPAID months before it
totalDue  = ownCharge + arrears          payable now
```

Carried amounts keep their **original** month's rate — never re-rated — so
summing `ownCharge` across months never double-counts. Paying month X settles
X and every consecutive unpaid month before it (`markPaidUpTo`, `js/data.js`).

`prev_reading` is stored per bill and feeds only that bill's units, so
correcting one month can't shift any other.

Supabase is the source of truth; `DB` in `js/config.js` is an in-memory mirror
re-hydrated after every mutation, then rendered synchronously.

## Data

Tables: `entities`, `bills`, `rates`, `settings`, `locked_periods`,
`audit_log`, plus a `verify_login` RPC. Photos go to the `bill-images` storage
bucket under `<entityId>/<year>-<month>-<timestamp>.<ext>`.

Constraints worth knowing: `bills` is unique on `(entity_id, month, year)` —
a duplicate surfaces as Postgres error `23505`. Rows are soft-deleted via
`deleted_at` and every query filters on it.

To set up a fresh Supabase project, run each file in `migration/` once, in any
order — they're all additive and safe to re-run. Then put the project URL and
anon key at the top of `js/config.js`.

**The login is a UI gate only.** `verify_login` checks the password
server-side and the accounts table has no anon policies, but the data tables
use permissive anon RLS, and the anon key is committed here. Fine for internal
use; not access control.

## Adding a reading

The Add-reading modal has three behaviours that are easy to trip over:

- The month field opens on the first month the chosen entity has **no** reading
  for, so the usual case needs no month picking. The global month selector
  parks on the latest period that has bills, so without this an already-billed
  entity would open on a month that can only fail against the unique
  constraint.
- **Selecting a month that already has a reading loads it for updating** —
  the title and button change to "Update reading", a note says the save
  replaces it, and saving issues an `update` on that row rather than an
  insert that the unique constraint would reject. This is the normal way to
  correct a wrong reading. Moving back to a free month returns the modal to a
  blank new entry.
- **Previous reading** auto-fills from the entity's last bill but is editable.
  Changing entity, month or year re-derives it, since it belongs to the period
  being billed.
- A vacated entity is the only thing that blocks saving, and says so on
  screen. Nothing else disables the button — a disabled Save with no visible
  reason reads as the app being broken.

## PWA

Installable, with an offline app shell. The rule that matters is in `sw.js`:

- **Supabase REST / RPC / auth / storage writes are never cached.** Bills,
  payments, readings and the login check always hit the network; offline they
  fail exactly as they did before. Nothing stale ever reaches the screen.
- Documents and same-origin JS/CSS are network-first with cache as the offline
  fallback. Both, deliberately — these filenames carry no content hash, so
  caching scripts while fetching HTML fresh would pair new markup with the
  previous deploy's scripts and leave buttons silently doing nothing.
- Version-pinned CDN libraries are cache-first.
- Public meter photos are cache-first, capped at 400, so past photos stay
  viewable with no connection.

Bump `VERSION` in `sw.js` when the precache list changes; older caches are
dropped on activate. `icons/` is generated from the app's own bolt logo
(`.logo-mark`, `css/style.css`).

`share.html` deliberately gets **no** manifest and no service worker — a
tenant opening their link should get the plain live page with nothing
installed or cached on their device.

## Deferred: places / tenancy

`entities` currently conflates the physical unit ("Shop 3") with whoever
occupies it. When a tenant leaves and another moves in there's no clean way to
say "new tenant, same shop" — you either rename the entity, losing the old
tenant's history under a new name, or create a disconnected one with no link
back to the same physical unit. `vacated_at` marks *status*, not *continuity*.

The intended fix is a `places` table (fixed list of flats/shops) with
`entities.place_id` pointing at it, so moving someone in creates a new entity
row against the same place while the old one keeps its history untouched. The
new tenancy would inherit the meter, open at the previous tenant's last
`curr_reading`, and carry over their final meter photo as proof of the
handover reading.

**Blocked on one input:** the building's actual list of flat and shop names.
Also undecided — whether the meter belongs to the place (wired to the unit) or
to the tenant, which decides which table owns the `meter` column.
