// lib/channel.js — the recurring public channel post.
//
// The previous incarnation of this project was a cron'd Python script that
// pushed a price message to the channel every 10 minutes. That behaviour lives
// on here at an hourly cadence, driven by .github/workflows/cron.yml.

import { api } from 'sdk';
import { getSnapshot, maybeRecordSample } from 'lib/prices';
import { channelPost } from 'lib/format';
import { CHANNEL_ID } from 'lib/config';
import { effectiveConfig, getSetting, setSetting, getDay, nowSec } from 'lib/store';

/** Where the automatic post goes. Runtime override wins over the constant. */
export async function channelTarget() {
  return getSetting('channelId', CHANNEL_ID);
}

/**
 * Publish the market summary to the channel.
 *
 * @param {{force?: boolean, dryRun?: boolean}} opts
 *   force  — post even if the interval has not elapsed
 *   dryRun — build the message and return it without sending
 */
export async function postToChannel(opts = {}) {
  const { force = false, dryRun = false } = opts;
  const cfg = await effectiveConfig();
  const target = await channelTarget();

  if (!target) return { ok: false, reason: 'no_channel_configured' };

  // The scheduled trigger is hourly, but a retry or a manual run could land
  // early; the 2-minute slack absorbs ordinary scheduler jitter without
  // allowing a genuine double post.
  const last = await getSetting('lastChannelPostAt', 0);
  const minGap = Math.max(0, (cfg.channelIntervalMin || 60) * 60 - 120);
  if (!force && last && nowSec() - last < minGap) {
    return { ok: true, skipped: 'too_soon', secondsSinceLast: nowSec() - last, target };
  }

  const snapshot = await getSnapshot({ force: true });
  if (!snapshot.stats.ok) {
    return { ok: false, reason: 'insufficient_data', trusted: snapshot.stats.count };
  }

  await maybeRecordSample(snapshot);

  const today = await getDay(snapshot.tehranNow.day);
  const text = channelPost(snapshot, today);

  if (dryRun) return { ok: true, dryRun: true, target, preview: text };

  try {
    const sent = await api.sendMessage({
      chat_id: target,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    await setSetting('lastChannelPostAt', nowSec());
    return {
      ok: true,
      target,
      messageId: sent.message_id,
      avg: Math.round(snapshot.stats.avg),
      bestBuy: Math.round(snapshot.stats.bestBuy),
      trusted: snapshot.stats.count,
      rejected: snapshot.stats.rejectedCount,
    };
  } catch (err) {
    // Almost always "bot is not a member of the channel chat" or a missing
    // post-messages right — worth reporting precisely rather than as a generic
    // failure, because the fix is a permission change, not a code change.
    console.error('channel post failed:', err && (err.description || err.message));
    return {
      ok: false,
      reason: 'send_failed',
      target,
      code: err && err.code,
      description: err && err.description,
      hint: 'ربات باید در کانال ادمین باشد و اجازه‌ی ارسال پیام داشته باشد.',
    };
  }
}
