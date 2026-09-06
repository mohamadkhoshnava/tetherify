# AGENTS.md

Orientation for AI coding assistants (and humans) working in this project.
This file is auto-loaded by Claude Code, Cursor, and similar tools — keep it short
and true. For the full SDK reference (db, Bot API, fetch), see
[docs/tgcloud-sdk.md](docs/tgcloud-sdk.md).

## What this project is

**Tetherify** ([@tetherifybot](https://t.me/tetherifybot)) — a Telegram bot that
reports the Iranian USDT market from ~90 exchanges, discarding erroneous quotes
before computing anything. It runs on Telegram's serverless platform: you write
JavaScript modules (database schema, shared library code, update handlers) and
the platform runs them in a V8 isolate. The `tgcloud` CLI syncs this local
project with the bot's cloud environment — think `wrangler`/`vercel` +
`drizzle-kit`.

See [README.md](README.md) for what the bot does and how to set it up.

There is no server to run locally and no `node_modules` to import from at runtime:
the only things available inside a module are the platform SDK and other modules
in this project.

## Layout

| Path            | What it is                                                        |
|-----------------|-------------------------------------------------------------------|
| `schema.js`     | Database schema — tables as **named exports**. One file, at root. |
| `lib/`          | Shared modules. Subdirectories allowed (`lib/internal/util.js`).  |
| `handlers/`     | Update handlers, **one level only**. Names match Telegram Bot API update types (`message`, `callback_query`, …). |
| `docs/`         | Reference docs (this project's, for you). Not deployed.           |
| `.tgcloud/`     | CLI state (credentials, snapshot, cached layout). **Never edit or read from here** — it's gitignored machine state. |

Only `.js` files in `schema.js`, `lib/`, and `handlers/` are deployed. Everything
else (Markdown, config, `.tgcloud/`) is local-only.

## Module system — the rules that bite

- **Import by bare module name, never a relative path or file extension.**
  The platform resolves modules by their name in the module space, not by the
  filesystem.
  - ✅ `import { users } from 'schema'`
  - ✅ `import { addItem } from 'lib/cart'`
  - ✅ `import { db, api, fetch } from 'sdk'` / `import { eq, sql } from 'sdk/db'`
  - ❌ `import { users } from './schema'` or `'../schema'` → **won't compile**
  - ❌ `import x from 'lib/cart.js'` → drop the `.js`
- **No filesystem, no npm packages** at runtime. Only `sdk` (and its submodules
  like `sdk/db`) and your own project modules exist.
- A handler module's `export default` is what the platform invokes, with the
  update's **payload** as the first argument — for `handlers/message` that's the
  `Message` (i.e. `update.message`), for `handlers/callback_query` the
  `CallbackQuery`, and so on. The full `Update` (with `update_id`) is on the
  second argument: `ctx.update`.

## Platform SDK (`import … from 'sdk'`)

- **`db`** — the database (query builder + schema DSL). Full API: [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md).
- **`api`** — the Telegram Bot API. `api.<method>({...})` (e.g. `api.sendMessage`,
  `api.getMe`) returns the **unwrapped** result and **throws `BotApiError`** on
  failure (`import { BotApiError } from 'sdk'`; it has `.code`/`.description`/`.parameters`).
- **`fetch`** — outbound HTTP, web-`fetch`-like (`res.status/ok`, `res.json()`,
  `res.text()`, streaming via `for await`, redirects followed).

## Database — the rules that bite

Full API in [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md). The non-obvious parts:

- **Every DB call is async — always `await`.** `.all()`, `.get()`, `.values()`,
  `.run()`, `db.$count()` and the raw `db.run/all/get` all return Promises.
- **No foreign keys.** `.references()` and `foreignKey()` **throw at declaration**
  — the runtime runs with FKs off, so they'd be silently inert. Enforce integrity
  in application code (delete children before parents, etc.).
- **Drops happen only via `.deprecated('reason')`** on a column/table/index.
  Deleting the declaration does *not* drop anything.
- **Type changes aren't automatic** — do them by hand with `db.run(...)`.

## Deploy & migrate workflow

**Deploying never touches the database.** Schema sync is a separate, explicit step.

The CLI is a local dev-dependency, so run it with `npx tgcloud <command>` (or use
the `npm run` scripts in package.json — e.g. `npm run deploy`):

```
npx tgcloud status     # what changed locally vs the cloud
npx tgcloud push       # deploy modules to the cloud
npx tgcloud migrate    # apply schema.js changes to the database (interactive)
npx tgcloud run <module> [args]   # execute a handler server-side
npx tgcloud pull       # bring the local project in line with the cloud
npx tgcloud login      # link this project to a bot
npx tgcloud webhook    # show the bot's webhook and whether it matches your handlers
```

After you change `schema.js`, `push` reports what the DB *would* change but applies
nothing — run `npx tgcloud migrate` to actually apply it.

The platform manages the bot's webhook for you, derived from your deployed
`handlers/*`, and refreshes it on `push`. If it ever drifts — e.g. someone called
`setWebhook` with the raw bot token — `npx tgcloud webhook` shows the mismatch and
`npx tgcloud webhook sync` repairs it.


## This project's own rules

**Quote quality is the point of the bot.** `lib/quality.js` decides which quotes
are real. Anything it rejects must stay out of every minimum, maximum and
average — that is the core requirement, not a nicety. Rejections are never
silent: they carry a reason and surface in `/excluded`.

- The reference is the **median**, and the band is driven by **MAD**, because a
  mean and a standard deviation are both movable by the very outliers being
  hunted. Do not "simplify" these into a mean.
- Unit errors (exactly 10x or 1/10 off) are **corrected and kept**, not dropped.
- Freshness is measured against the freshest quote on the page, not wall-clock
  time, so the source lagging as a whole cannot mark every exchange stale.

**No secrets in this repo.** The runtime has no environment variables and needs
none — the Bot API is pre-authenticated through `sdk`'s `api`. The only secret is
`TGCLOUD_TOKEN` (`.env`, git-ignored; and the GitHub Actions secret). Never add a
bot token to the code. Runtime-tunable values belong in the `settings` table via
`lib/store.js`, not in a new config file.

**`handlers/shipping_query.js` is the cron entry point**, not a payments handler.
The platform has no scheduler and `tgcloud run` only executes modules under
`handlers/`, so the job runner is parked on an update type this bot can never
receive. Keep the guard that ignores genuine shipping queries.

**Message text is Persian.** Use the helpers in `lib/fa.js` — `faNum`, `faPct`,
`faAgo`, `toFaDigits` — rather than raw `toLocaleString`. Always `esc()` anything
interpolated into a `parse_mode: 'HTML'` message. Telegram caps a message at 4096
characters, so anything list-shaped must paginate.

**`tgcloud run` hits the live database.** There is no staging environment. Treat
every run as production, and prefer `dryRun` on the digest job.

## Checks

```
npm run check        # node --check on every deployed module
npm run status       # local vs deployed
npm run job:sample   # exercise fetch -> parse -> analyze -> db, on the platform
```
