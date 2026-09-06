// lib/store.js — every database read/write the bot does.
//
// Handlers never touch `db` directly; keeping it here means the schema can move
// without chasing query builders through a dozen files.

import { db } from 'sdk';
import { eq, and, desc, asc, gte, lte, inArray, sql } from 'sdk/db';
import { chats, samples, daily, alerts, cache, settings } from 'schema';
import { DEFAULTS, ADMIN_IDS } from 'lib/config';

export const nowSec = () => Math.floor(Date.now() / 1000);

export function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

// --- settings ---------------------------------------------------------------

export async function getSetting(key, fallback = null) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row && row.value !== undefined && row.value !== null ? row.value : fallback;
}

export async function setSetting(key, value) {
  await db.insert(settings).values({ key, value, updatedAt: nowSec() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: nowSec() } });
}

export async function allSettings() {
  return db.select().from(settings).all();
}

/** DEFAULTS overlaid with any admin overrides stored in the database. */
export async function effectiveConfig() {
  const rows = await allSettings();
  const cfg = { ...DEFAULTS, blocklist: ['پول نو'] };
  for (const r of rows) {
    if (r.key in cfg || r.key === 'blocklist') cfg[r.key] = r.value;
  }
  return cfg;
}

// --- chats ------------------------------------------------------------------

/** Upsert the chat and bump its activity counters. */
export async function touchChat(chat, addedBy = null) {
  if (!chat) return null;
  const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || null;
  const existing = await db.select().from(chats).where(eq(chats.id, chat.id)).get();

  if (!existing) {
    await db.insert(chats).values({
      id: chat.id,
      type: chat.type || 'private',
      title,
      username: chat.username || null,
      addedBy,
      msgCount: 1,
      lastSeen: nowSec(),
    }).onConflictDoNothing({ target: chats.id });
    return db.select().from(chats).where(eq(chats.id, chat.id)).get();
  }

  await db.update(chats)
    .set({ title, username: chat.username || null, type: chat.type || existing.type, msgCount: existing.msgCount + 1, lastSeen: nowSec() })
    .where(eq(chats.id, chat.id));
  return { ...existing, msgCount: existing.msgCount + 1 };
}

export async function getChat(chatId) {
  return db.select().from(chats).where(eq(chats.id, chatId)).get();
}

export async function setSubscribed(chatId, value) {
  await db.update(chats).set({ subscribed: !!value }).where(eq(chats.id, chatId));
}

export async function setBanned(chatId, value) {
  await db.update(chats).set({ banned: !!value }).where(eq(chats.id, chatId));
}

export async function subscribedChats() {
  return db.select().from(chats)
    .where(and(eq(chats.subscribed, true), eq(chats.banned, false)))
    .all();
}

export async function chatStats() {
  const total = await db.$count(chats);
  const priv = await db.$count(chats, eq(chats.type, 'private'));
  const subs = await db.$count(chats, eq(chats.subscribed, true));
  const banned = await db.$count(chats, eq(chats.banned, true));
  const groups = total - priv;
  const msgs = await db.get(sql`SELECT COALESCE(SUM(msg_count), 0) AS c FROM chats`);
  return { total, priv, groups, subs, banned, msgs: msgs ? msgs.c : 0 };
}

// --- cache ------------------------------------------------------------------

export async function cacheGet(key) {
  const row = await db.select().from(cache).where(eq(cache.key, key)).get();
  if (!row) return null;
  if (row.expiresAt <= nowSec()) return null;
  return row.value;
}

export async function cacheSet(key, value, ttlSec) {
  await db.insert(cache).values({ key, value, expiresAt: nowSec() + ttlSec })
    .onConflictDoUpdate({ target: cache.key, set: { value, expiresAt: nowSec() + ttlSec } });
}

export async function cacheClear(key) {
  await db.delete(cache).where(eq(cache.key, key));
}

// --- samples & daily rollup -------------------------------------------------

export async function lastSample() {
  return db.select().from(samples).orderBy(desc(samples.ts)).limit(1).get();
}

export async function recordSample(day, stats) {
  await db.insert(samples).values({
    ts: nowSec(),
    day,
    avg: stats.avg,
    median: stats.median,
    bestBuy: stats.bestBuy,
    bestSell: stats.bestSell,
    minAsk: stats.minAsk,
    maxAsk: stats.maxAsk,
    okCount: stats.count,
    badCount: stats.rejectedCount,
  });
}

export async function samplesForDay(day) {
  return db.select().from(samples).where(eq(samples.day, day)).orderBy(asc(samples.ts)).all();
}

/** Fold a day's samples into one `daily` row. Idempotent — safe to re-run. */
export async function rollupDay(day, jalali) {
  const rows = await samplesForDay(day);
  if (!rows.length) return null;
  const avgs = rows.map((r) => r.avg);
  const record = {
    day,
    jalali,
    avg: avgs.reduce((s, v) => s + v, 0) / avgs.length,
    min: Math.min(...rows.map((r) => r.minAsk)),
    max: Math.max(...rows.map((r) => r.maxAsk)),
    open: rows[0].avg,
    close: rows[rows.length - 1].avg,
    samples: rows.length,
  };
  await db.insert(daily).values(record)
    .onConflictDoUpdate({
      target: daily.day,
      set: { avg: record.avg, min: record.min, max: record.max, open: record.open, close: record.close, samples: record.samples, jalali },
    });
  return db.select().from(daily).where(eq(daily.day, day)).get();
}

export async function getDay(day) {
  return db.select().from(daily).where(eq(daily.day, day)).get();
}

export async function recentDays(limit = 7) {
  const rows = await db.select().from(daily).orderBy(desc(daily.day)).limit(limit).all();
  return rows.reverse();
}

export async function markReported(day) {
  await db.update(daily).set({ reported: true }).where(eq(daily.day, day));
}

// --- alerts -----------------------------------------------------------------

export async function addAlert(chatId, userId, direction, price) {
  await db.insert(alerts).values({ chatId, userId, direction, price, active: true, createdAt: nowSec() });
}

export async function listAlerts(chatId) {
  return db.select().from(alerts)
    .where(and(eq(alerts.chatId, chatId), eq(alerts.active, true)))
    .orderBy(asc(alerts.price)).all();
}

export async function activeAlerts() {
  return db.select().from(alerts).where(eq(alerts.active, true)).all();
}

export async function deactivateAlerts(ids) {
  if (!ids.length) return;
  await db.update(alerts).set({ active: false, firedAt: nowSec() }).where(inArray(alerts.id, ids));
}

export async function removeAlert(id, chatId) {
  await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.chatId, chatId)));
}

export async function clearAlerts(chatId) {
  await db.delete(alerts).where(eq(alerts.chatId, chatId));
}

export async function alertCount() {
  return db.$count(alerts, eq(alerts.active, true));
}
