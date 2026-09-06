// schema.js — Tetherify's database.
//
// Tables are named exports. Deploying this file registers the schema;
// `npx tgcloud migrate` is what actually changes the database.
// Reminder: foreign keys are NOT supported — relations are enforced in app code.

import { table, integer, text, real, boolean, json, index, sql } from 'sdk/db';

const now = () => sql`(unixepoch())`;

/**
 * Every chat the bot has met: private chats, groups, supergroups, channels.
 * `subscribed` drives the daily digest broadcast.
 */
export const chats = table('chats', {
  id:         integer('id').primaryKey(),              // Telegram chat id
  type:       text('type').notNull().default('private'),
  title:      text('title'),                           // group title / user full name
  username:   text('username'),
  subscribed: boolean('subscribed').notNull().default(false),
  banned:     boolean('banned').notNull().default(false),
  msgCount:   integer('msg_count').notNull().default(0),
  addedBy:    integer('added_by'),                     // user id that added the bot
  lastSeen:   integer('last_seen').notNull().default(now()),
  createdAt:  integer('created_at').notNull().default(now()),
}, (t) => ({
  subIdx:  index('idx_chats_subscribed').on(t.subscribed),
  seenIdx: index('idx_chats_last_seen').on(t.lastSeen),
}));

/**
 * A periodic snapshot of the market, computed from TRUSTED quotes only.
 * This is the raw material for daily averages and the history chart.
 */
export const samples = table('samples', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  ts:        integer('ts').notNull().default(now()),   // unix seconds (UTC)
  day:       text('day').notNull(),                    // Tehran calendar day, "YYYY-MM-DD" gregorian
  avg:       real('avg').notNull(),                    // mean ask across trusted exchanges
  median:    real('median').notNull(),
  bestBuy:   real('best_buy').notNull(),               // cheapest ask
  bestSell:  real('best_sell').notNull(),              // highest bid
  minAsk:    real('min_ask').notNull(),
  maxAsk:    real('max_ask').notNull(),
  okCount:   integer('ok_count').notNull().default(0), // exchanges included in stats
  badCount:  integer('bad_count').notNull().default(0),// exchanges rejected as erroneous
}, (t) => ({
  tsIdx:  index('idx_samples_ts').on(t.ts),
  dayIdx: index('idx_samples_day').on(t.day),
}));

/**
 * One rolled-up row per calendar day (Tehran). Written by the digest job so the
 * history chart stays cheap no matter how many samples accumulate.
 */
export const daily = table('daily', {
  day:      text('day').primaryKey(),                  // "YYYY-MM-DD" gregorian (Tehran)
  jalali:   text('jalali').notNull(),                  // "۱۴۰۵/۰۶/۱۵"
  avg:      real('avg').notNull(),
  min:      real('min').notNull(),
  max:      real('max').notNull(),
  open:     real('open').notNull(),
  close:    real('close').notNull(),
  samples:  integer('samples').notNull().default(0),
  reported: boolean('reported').notNull().default(false), // digest already broadcast?
  createdAt: integer('created_at').notNull().default(now()),
});

/**
 * User price alerts: "tell me when USDT goes above / below X toman".
 */
export const alerts = table('alerts', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  userId:    integer('user_id').notNull(),
  direction: text('direction').notNull(),              // 'above' | 'below'
  price:     real('price').notNull(),                  // toman
  active:    boolean('active').notNull().default(true),
  firedAt:   integer('fired_at'),
  createdAt: integer('created_at').notNull().default(now()),
}, (t) => ({
  activeIdx: index('idx_alerts_active').on(t.active),
  chatIdx:   index('idx_alerts_chat').on(t.chatId),
}));

/**
 * Short-lived cache so we hit the upstream source at most once per TTL,
 * no matter how many users ask at the same moment.
 */
export const cache = table('cache', {
  key:       text('key').primaryKey(),
  value:     json('value'),
  expiresAt: integer('expires_at').notNull(),
});

/**
 * Runtime configuration the admin can change without a redeploy
 * (outlier tolerance, staleness window, digest hour, ...).
 */
export const settings = table('settings', {
  key:       text('key').primaryKey(),
  value:     json('value'),
  updatedAt: integer('updated_at').notNull().default(now()),
});
