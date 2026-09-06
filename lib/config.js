// lib/config.js — static configuration.
//
// NOTE ON SECRETS: the serverless runtime has no environment variables, and it
// needs none. The Bot API is pre-authenticated through `sdk`'s `api`, so the bot
// token never appears in this codebase. The only secret in the whole project is
// the tgcloud CLI access token, which lives in .tgcloud/credentials (git-ignored)
// and in the TGCLOUD_TOKEN GitHub Actions secret. Nothing here is confidential.
//
// Values that should be tunable without a redeploy live in the `settings` table
// instead — see lib/store.js `getSetting`.

/** Telegram user ids allowed to run /admin commands. */
export const ADMIN_IDS = [463152143];

/** Upstream aggregator: ~90 Iranian exchanges quoting USDT. */
export const SOURCE_URL = 'https://www.tgju.org/crypto/exchanges/local/asset/usdt';
export const SOURCE_NAME = 'TGJU';

export const BRAND = 'Tetherify';
export const BOT_USERNAME = 'tetherifybot';

/**
 * Channel the bot auto-posts the market summary to. Overridable at runtime with
 * /setchannel, which stores the value in the `settings` table.
 */
export const CHANNEL_ID = '@tetherify';

/** Iran has no DST; the offset is a fixed +03:30. */
export const TEHRAN_OFFSET_MINUTES = 210;

/**
 * Defaults for the quote-quality filter. Every one of these is overridable at
 * runtime by an admin (/set <key> <value>), so they are starting points, not law.
 */
export const DEFAULTS = {
  // A quote may sit this far from the market median (%) and still be trusted.
  devTolerancePct: 2.5,
  // A quote lagging the freshest quote by more than this is dropped as stale.
  // Plenty of smaller exchanges only refresh every couple of hours, and a
  // two-hour-old quote sitting 0.3% off the median is still a real price — so
  // this is deliberately generous and the deviation band does the real work.
  maxStaleMinutes: 360,
  // Lag beyond this is merely flagged in the listing, not excluded.
  staleWarnMinutes: 90,
  // ask/bid spread wider than this (%) means the bid side is broken, not a price.
  maxSpreadPct: 5,
  // Below this many trusted quotes we refuse to publish statistics at all.
  minTrusted: 5,
  // Upstream is fetched at most once per this many seconds.
  cacheTtlSec: 90,
  // A market sample is stored at most this often.
  snapshotIntervalMin: 20,
  // Tehran hour at which the daily digest goes out.
  digestHour: 21,
  // Minimum gap between two automatic channel posts. The scheduled trigger runs
  // hourly; this is the guard that keeps a retry or a manual run from
  // double-posting.
  channelIntervalMin: 60,
  // Cap on how many exchanges a /list page shows.
  pageSize: 15,
  // Require private-chat users to be members of CHANNEL_ID before the bot
  // answers them. 1 = on, 0 = off. Toggle at runtime with /forcejoin.
  forceJoin: 1,
  // How long a confirmed membership is trusted before it is re-checked, so an
  // active conversation does not call getChatMember on every single message.
  memberCacheMin: 10,
};

export const CB = {
  REFRESH: 'r',
  LIST: 'l',
  TOP: 't',
  AVG: 'a',
  EXCLUDED: 'x',
  HELP: 'h',
  HOME: 'm',
  CHART: 'c',
  SUB: 's',
  JOIN: 'j',
};
