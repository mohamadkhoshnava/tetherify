# Tetherify · تتریفای

A Telegram bot that reports the Iranian USDT (Tether) market — pulling quotes from
~90 local exchanges, **throwing out the ones that are wrong**, and reporting only
what is left.

It runs entirely on [Telegram's serverless platform](https://core.telegram.org/bots/serverless):
no server, no container, no host to pay for. Telegram executes the handlers in a
V8 isolate next to the Bot API, with an SQLite database attached.

**Bot:** [@tetherifybot](https://t.me/tetherifybot)

---

## Why the filtering matters

The upstream aggregator republishes whatever each exchange advertises, and a
meaningful slice of that is simply wrong. On a typical fetch, **17 of 89 quotes
are unusable**. Feeding those into a "lowest price" or an average produces a
number that describes nothing.

Four failure modes show up in real data, and each is handled differently:

| Problem | What it looks like | What the bot does |
|---|---|---|
| 🔧 **Unit error** | An exchange publishes rials where tomans are expected — the number is exactly 10× or ⅒ off (e.g. `2,264,657` or `22,534` against a `225,897` market) | Rescaled and kept, marked 🔧 |
| ⏳ **Stale quote** | The exchange stopped updating days or weeks ago; the price is real but describes a market that is gone (e.g. `194,402`, last updated a month ago) | Excluded, listed under `/excluded` |
| ↔️ **Broken bid** | A sane ask with a bid at half of it (`ask 224,155 / bid 109,355`). That is a data error, not a spread | Ask kept, bid discarded |
| ⚠️ **Outlier** | Anything else implausibly far from the market | Excluded, listed under `/excluded` |

The reference point is the **median**, and the tolerance band is driven by the
**median absolute deviation** — both chosen because, unlike a mean, a handful of
absurd values cannot drag them around. The band widens on its own in a genuinely
volatile market and stays tight in a calm one.

**Nothing rejected is counted in the minimum, maximum, or average.** Every
exclusion is visible with `/excluded`, along with the reason and the thresholds
that produced it.

---

## What it does

### In private chat
| Command | |
|---|---|
| `/price` `/p` | Live market summary: cheapest buy, best sell, average, median, range |
| `/list` | Every trusted exchange, cheapest first, paginated |
| `/top` | Five best exchanges to buy from and to sell to |
| `/excluded` `/ex` | Which quotes were thrown out and exactly why |
| `/avg` | Today's average so far, compared with yesterday |
| `/chart` | Seven-day trend with a sparkline |
| `/alert 230000` | One-shot alert when the price crosses a number |
| `/alerts` · `/delalert` | Manage alerts |
| `/subscribe` | Daily report at 21:00 Tehran |
| `/about` · `/help` · `/id` | |

Plain language works too: "قیمت چنده؟" gets a price card, and a bare number
offers to set an alert.

### In groups
Commands work as above. A group admin can `/subscribe` to receive the daily
digest. The bot greets a group when added and stays quiet otherwise — it only
speaks when addressed.

### Inline
Type `@tetherifybot` in any chat to send the market summary, cheapest buy, best
sell, or average without leaving the conversation. Typing a name filters to that
exchange — `@tetherifybot نوبیتکس`.

> **Inline mode must be switched on once in @BotFather** (`/setinline`) — it is
> off by default for every new bot.

### Daily digest
At 21:00 Tehran the bot posts the day's average, low, high, open/close, the
change versus yesterday, and a seven-day sparkline to every subscribed chat.

### Admin
`/stats` · `/health` · `/raw` · `/digest` · `/refresh` · `/broadcast` · `/config` ·
`/set <key> <value>` · `/block` · `/unblock` · `/ban` · `/unban`

Thresholds are tunable at runtime without a redeploy — `/set devTolerancePct 3`
takes effect on the next fetch.

---

## Layout

```
schema.js                  database tables (chats, samples, daily, alerts, cache, settings)
lib/
  config.js                constants and default thresholds
  fa.js                    Persian digits, number formatting, Jalali calendar
  source.js                fetch + parse the upstream exchange table
  quality.js               ← the outlier / staleness / unit-error engine
  prices.js                caching, sampling, alert firing
  store.js                 every database read and write
  format.js                all user-facing messages
  keyboard.js              inline keyboards
  digest.js                the daily report
  commands.js              command routing
handlers/
  message.js               private + group messages
  callback_query.js        inline keyboard buttons
  inline_query.js          inline mode
  my_chat_member.js        added to / removed from a chat
  shipping_query.js        ← scheduled job entry point (see below)
```

### Why the job runner is called `shipping_query.js`

The platform has no cron, and `tgcloud run` only executes modules under
`handlers/`, whose names must be real Bot API update types. So the scheduled job
is parked on an update type this bot can never receive: `shipping_query` is only
delivered for invoices with flexible shipping, and this bot has no payments. A
guard ignores anything that looks like a genuine shipping query.

`.github/workflows/cron.yml` drives it — `tgcloud run` executes the handler **on
the platform** against the real database, so these are true scheduled runs of the
deployed bot, not a second copy running on a CI runner. A market sample is taken
every 30 minutes and the digest fires at 17:30 UTC.

The bot also samples opportunistically on user traffic, so if CI is paused the
daily average loses resolution rather than disappearing.

---

## Setup

Requires Node.js 18+.

```bash
git clone https://github.com/mohamadkhoshnava/tetherify.git
cd tetherify
npm install
cp .env.example .env     # then fill in TGCLOUD_TOKEN
```

Get the CLI access token from **@BotFather → your bot → Serverless → CLI Access**.
It has the form `app<id>:<secret>` and is *not* the bot's API token.

```bash
npx tgcloud login        # interactive; or export TGCLOUD_TOKEN
npx tgcloud push         # deploy the modules
npx tgcloud migrate      # create the database tables
npm run job:setup        # register the command menu
```

Useful during development:

```bash
npm run check            # syntax-check every deployed module
npm run status           # local vs deployed
npm run job:sample       # take a market sample now
npm run job:digest       # build the daily digest without sending it
npx tgcloud run handlers/message '{ chat: { id: 123, type: "private" }, text: "/price" }'
```

`tgcloud run` executes against the live database, so treat it as production.

### CI

Add one repository secret — **`TGCLOUD_TOKEN`** (Settings → Secrets and variables
→ Actions). Then:

* `deploy.yml` — syntax-checks and deploys on every push to `main`. Schema
  migrations are **not** automatic; run the workflow manually with the `migrate`
  input once you have reviewed what `push` reports.
* `cron.yml` — the scheduled sample and digest jobs.

> GitHub disables scheduled workflows in a repository with no activity for 60
> days, and may delay runs under load.

---

## Security

* **The bot token is not in this repository and is not needed by it.** The
  serverless runtime authenticates the Bot API inside the sandbox, so the
  deployed code calls `api.sendMessage(...)` without ever holding a credential.
* **The only real secret is `TGCLOUD_TOKEN`**, and it lives in exactly two
  places: `.env` (git-ignored) and the GitHub Actions secret.
* `.tgcloud/` is git-ignored — `tgcloud login` writes credentials there.
* The admin user id in `lib/config.js` is deliberately in the clear: a Telegram
  user id is not a secret, and the runtime has no environment variables to hide
  it in anyway.
* If a token is ever exposed, rotate it in @BotFather — revoking the API token
  and reissuing the CLI access token are both one command there.

---

## Notes

This bot reports prices. It does not give financial advice.

Data comes from [TGJU](https://www.tgju.org/crypto/exchanges/local/asset/usdt).
Layout changes upstream will reduce the number of parsed exchanges rather than
crash a handler; `/health` shows how many were read on the last fetch.

## License

MIT
