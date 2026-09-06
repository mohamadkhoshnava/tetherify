// lib/prices.js — the one place that turns "someone asked for the price" into
// a clean, analysed market snapshot.
//
// Responsibilities: cache the upstream page so a busy group cannot hammer it,
// survive an upstream outage by serving the last good snapshot, record periodic
// samples for the daily average, and fire user price alerts.

import { api } from 'sdk';
import { fetchExchanges } from 'lib/source';
import { analyze } from 'lib/quality';
import { tehran, faNum } from 'lib/fa';
import { BRAND } from 'lib/config';
import {
  cacheGet, cacheSet, effectiveConfig, recordSample, lastSample,
  activeAlerts, deactivateAlerts, nowSec,
} from 'lib/store';

const CACHE_KEY = 'source:rows';
const LAST_GOOD_KEY = 'source:last_good';

/**
 * Current market snapshot.
 * @param {{force?: boolean}} opts  force bypasses the cache
 */
export async function getSnapshot({ force = false } = {}) {
  const cfg = await effectiveConfig();

  let payload = force ? null : await cacheGet(CACHE_KEY);
  let cached = !!payload;
  let degraded = false;

  if (!payload) {
    try {
      const rows = await fetchExchanges();
      payload = { rows, at: nowSec() };
      await cacheSet(CACHE_KEY, payload, cfg.cacheTtlSec);
      // Kept far longer than the hot cache purely as an outage fallback.
      await cacheSet(LAST_GOOD_KEY, payload, 6 * 3600);
    } catch (err) {
      console.error('upstream fetch failed:', err && err.message);
      payload = await cacheGet(LAST_GOOD_KEY);
      if (!payload) throw err;
      degraded = true;
      cached = true;
    }
  }

  const result = analyze(payload.rows, cfg);
  const t = tehran();

  return {
    ...result,
    cfg,
    cached,
    degraded,
    fetchedAt: payload.at,
    ageSec: Math.max(0, nowSec() - payload.at),
    tehranNow: t,
  };
}

/**
 * Store a market sample if enough time has passed since the last one.
 * Called opportunistically on user traffic and deliberately by the cron job, so
 * the daily average keeps filling in even between scheduled runs.
 */
export async function maybeRecordSample(snapshot) {
  if (!snapshot.stats.ok) return false;
  const last = await lastSample();
  const minGap = (snapshot.cfg.snapshotIntervalMin || 20) * 60;
  if (last && nowSec() - last.ts < minGap) return false;
  await recordSample(snapshot.tehranNow.day, snapshot.stats);
  return true;
}

/**
 * Fire any price alert the current market has crossed, then deactivate it.
 * Alerts are one-shot on purpose — a repeating alert on a price that hovers
 * around the threshold would be a notification firehose.
 */
export async function processAlerts(snapshot) {
  if (!snapshot.stats.ok) return 0;
  const price = snapshot.stats.bestBuy;
  const rows = await activeAlerts();
  const fired = rows.filter((a) =>
    (a.direction === 'above' && price >= a.price) ||
    (a.direction === 'below' && price <= a.price));

  if (!fired.length) return 0;

  for (const a of fired) {
    const arrow = a.direction === 'above' ? '📈' : '📉';
    const word = a.direction === 'above' ? 'بالاتر از' : 'پایین‌تر از';
    try {
      await api.sendMessage({
        chat_id: a.chatId,
        parse_mode: 'HTML',
        text:
          `${arrow} <b>هشدار قیمت</b>\n\n` +
          `قیمت تتر ${word} <b>${faNum(a.price)}</b> تومان رفت.\n` +
          `قیمت فعلی (بهترین خرید): <b>${faNum(price)}</b> تومان\n\n` +
          `<i>این هشدار یک‌بار مصرف بود و غیرفعال شد.</i>\n${BRAND}`,
      });
    } catch (err) {
      console.warn('alert delivery failed for', a.chatId, err && err.description);
    }
  }

  await deactivateAlerts(fired.map((a) => a.id));
  return fired.length;
}

/**
 * The full opportunistic pipeline: snapshot, sample, alerts. Handlers call this
 * rather than wiring the three steps themselves.
 */
export async function refresh({ force = false, quiet = false } = {}) {
  const snapshot = await getSnapshot({ force });
  if (!quiet) {
    try {
      await maybeRecordSample(snapshot);
      await processAlerts(snapshot);
    } catch (err) {
      console.warn('post-snapshot work failed:', err && err.message);
    }
  }
  return snapshot;
}
