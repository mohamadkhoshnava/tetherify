// lib/digest.js — the daily average report.
//
// The serverless platform has no cron, so this module is driven two ways:
//
//   1. A scheduled GitHub Actions workflow runs `tgcloud run lib/digest`, which
//      executes this file ON the platform against the real database. That is the
//      reliable clock.
//   2. `maybeRunDigest()` is called opportunistically from update handlers, so a
//      bot with traffic still samples and still reports even if CI is paused.
//
// Both paths are idempotent: the `reported` flag on the daily row means a digest
// goes out once per day no matter how often this runs.

import { api } from 'sdk';
import { getSnapshot } from 'lib/prices';
import { maybeRecordSample, processAlerts } from 'lib/prices';
import { tehran } from 'lib/fa';
import { digestMessage } from 'lib/format';
import {
  recordSample, rollupDay, getDay, recentDays, markReported,
  subscribedChats, setSubscribed, effectiveConfig, getSetting, setSetting, nowSec,
} from 'lib/store';

/** Best-effort pause between broadcast messages; a no-op if timers are absent. */
function sleep(ms) {
  if (typeof setTimeout !== 'function') return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Yesterday's Gregorian day key, relative to a Tehran-local day. */
function previousDayKey(t) {
  const d = new Date(Date.UTC(t.gy, t.gm - 1, t.gd));
  d.setUTCDate(d.getUTCDate() - 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Take a sample, roll up the day, and broadcast the digest when it is due.
 *
 * @param {{force?: boolean, dryRun?: boolean}} opts
 *   force  — broadcast regardless of the hour and the reported flag
 *   dryRun — do everything except send
 */
export async function runDigest(opts = {}) {
  const { force = false, dryRun = false } = opts;
  const cfg = await effectiveConfig();
  const t = tehran();

  const snapshot = await getSnapshot({ force: true });
  if (!snapshot.stats.ok) {
    console.warn('digest: not enough trusted quotes, skipping sample');
    return { ok: false, reason: 'insufficient_data', trusted: snapshot.stats.count };
  }

  // The cron path always samples — that is what keeps the daily average dense.
  await recordSample(t.day, snapshot.stats);
  await processAlerts(snapshot);

  const day = await rollupDay(t.day, t.jalali);
  // Keep yesterday's roll-up honest too, in case the last run of the day was missed.
  const prevKey = previousDayKey(t);
  const prev = await getDay(prevKey);

  const due = force || (t.hour >= cfg.digestHour && day && !day.reported);
  if (!due) {
    return { ok: true, sampled: true, broadcast: 0, day: t.day, avg: day ? day.avg : null, due: false };
  }

  const history = await recentDays(7);
  const text = digestMessage(day, snapshot, prev, history);

  if (dryRun) {
    return { ok: true, sampled: true, dryRun: true, day: t.day, preview: text };
  }

  const targets = await subscribedChats();
  let sent = 0;
  let dropped = 0;

  for (const chat of targets) {
    try {
      await api.sendMessage({
        chat_id: chat.id,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      sent += 1;
    } catch (err) {
      // 403 = blocked or kicked; 400 with "chat not found" = gone for good.
      if (err && (err.code === 403 || err.code === 400)) {
        await setSubscribed(chat.id, false);
        dropped += 1;
      } else {
        console.warn('digest send failed for', chat.id, err && err.description);
      }
    }
    await sleep(60);
  }

  if (!force) await markReported(t.day);
  await setSetting('lastDigestAt', nowSec());

  console.info(`digest: sent=${sent} dropped=${dropped} avg=${day.avg}`);
  return { ok: true, sampled: true, broadcast: sent, dropped, day: t.day, avg: day.avg };
}

/**
 * Cheap check used on the traffic-driven path — returns immediately unless a
 * digest is actually due, so it can be called on ordinary updates.
 */
export async function maybeRunDigest() {
  try {
    const cfg = await effectiveConfig();
    const t = tehran();
    if (t.hour < cfg.digestHour) return false;
    const day = await getDay(t.day);
    if (day && day.reported) return false;
    // Guard against two updates racing into a double broadcast.
    const lastTry = await getSetting('lastDigestTry', 0);
    if (nowSec() - lastTry < 300) return false;
    await setSetting('lastDigestTry', nowSec());
    await runDigest();
    return true;
  } catch (err) {
    console.warn('maybeRunDigest failed:', err && err.message);
    return false;
  }
}

/**
 * Default export so the job can be triggered with:
 *   npx tgcloud run lib/digest '{ "force": false }'
 */
export default async function (input = {}) {
  const opts = typeof input === 'object' && input ? input : {};
  const result = await runDigest(opts);
  console.info('digest result:', JSON.stringify(result));
  return result;
}
