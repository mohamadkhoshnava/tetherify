// handlers/shipping_query.js — the scheduled-job entry point.
//
// WHY THIS FILE HAS A STRANGE NAME
// The serverless platform has no cron, and `tgcloud run` will only execute
// modules under handlers/, whose names must be real Bot API update types. So the
// scheduled job is parked on an update type this bot can never actually receive:
// `shipping_query` is only ever delivered for invoices with flexible shipping,
// and this bot has no payments at all.
//
// It is driven by .github/workflows/cron.yml:
//     tgcloud run handlers/shipping_query '{ job: "sample" }'    every 30 min
//     tgcloud run handlers/shipping_query '{ job: "channel" }'   hourly
//     tgcloud run handlers/shipping_query '{ job: "digest" }'    once a day
//
// A real ShippingQuery (should Telegram ever send one) carries `invoice_payload`
// and is ignored, so the guard below keeps the two paths from ever crossing.

import { api } from 'sdk';
import { runDigest } from 'lib/digest';
import { postToChannel } from 'lib/channel';
import { isMember, gateEnabled, gateTarget, channelLink } from 'lib/gate';
import { getSnapshot, processAlerts } from 'lib/prices';
import { recordSample, rollupDay } from 'lib/store';
import { tehran } from 'lib/fa';

/** Sample the market and fold it into today's rollup, without broadcasting. */
async function sampleJob() {
  // getSnapshot, not refresh: refresh() samples on its own schedule, and this
  // job records unconditionally — going through both would double-count.
  const snapshot = await getSnapshot({ force: true });
  if (!snapshot.stats.ok) {
    return { ok: false, reason: 'insufficient_data', trusted: snapshot.stats.count };
  }
  const t = tehran();
  await recordSample(t.day, snapshot.stats);
  await processAlerts(snapshot);
  const day = await rollupDay(t.day, t.jalali);
  return {
    ok: true,
    day: t.day,
    avg: Math.round(snapshot.stats.avg),
    bestBuy: Math.round(snapshot.stats.bestBuy),
    trusted: snapshot.stats.count,
    rejected: snapshot.stats.rejectedCount,
    samplesToday: day ? day.samples : 0,
  };
}

/**
 * Register the command menu Telegram shows users. Idempotent, so it is safe to
 * re-run after every deploy.
 */
async function setupJob() {
  const publicCmds = [
    { command: 'price', description: '💵 قیمت لحظه‌ای تتر' },
    { command: 'top', description: '🏆 بهترین صرافی‌ها برای خرید و فروش' },
    { command: 'list', description: '📋 فهرست کامل صرافی‌های معتبر' },
    { command: 'avg', description: '📊 میانگین امروز و مقایسه با دیروز' },
    { command: 'chart', description: '📈 روند هفت روز اخیر' },
    { command: 'excluded', description: '🧹 قیمت‌های حذف‌شده و دلیلشان' },
    { command: 'alert', description: '🔔 هشدار وقتی قیمت به عددی رسید' },
    { command: 'alerts', description: '🔕 فهرست هشدارهای فعال' },
    { command: 'subscribe', description: '🌙 فعال‌سازی گزارش روزانه' },
    { command: 'help', description: 'ℹ️ راهنمای کامل' },
  ];

  const groupCmds = [
    { command: 'price', description: '💵 قیمت لحظه‌ای تتر' },
    { command: 'top', description: '🏆 بهترین صرافی‌ها' },
    { command: 'avg', description: '📊 میانگین امروز' },
    { command: 'excluded', description: '🧹 قیمت‌های حذف‌شده' },
    { command: 'subscribe', description: '🌙 گزارش روزانه (مدیران گروه)' },
    { command: 'help', description: 'ℹ️ راهنما' },
  ];

  const applied = [];
  for (const [scope, commands] of [
    [{ type: 'default' }, publicCmds],
    [{ type: 'all_private_chats' }, publicCmds],
    [{ type: 'all_group_chats' }, groupCmds],
  ]) {
    await api.setMyCommands({ commands, scope, language_code: 'fa' });
    await api.setMyCommands({ commands, scope });
    applied.push(scope.type);
  }

  await api.setChatMenuButton({ menu_button: { type: 'commands' } });

  const me = await api.getMe();
  return {
    ok: true,
    username: me.username,
    scopes: applied,
    inlineEnabled: !!me.supports_inline_queries,
    note: me.supports_inline_queries
      ? undefined
      : 'inline mode is OFF — enable it in @BotFather: /setinline',
  };
}

/**
 * Diagnose the membership gate for one user id. Answers the two questions that
 * actually go wrong in practice: can the bot read the channel's membership at
 * all, and what does it see for this user.
 */
async function gatecheckJob(userId) {
  const target = await gateTarget();
  const enabled = await gateEnabled();
  const out = { enabled, target, link: channelLink(target), userId };

  if (!userId) {
    out.note = 'pass a userId: { job: "gatecheck", userId: 123 }';
    return out;
  }

  try {
    const member = await api.getChatMember({ chat_id: target, user_id: userId });
    out.rawStatus = member && member.status;
    out.isMember = await isMember(userId, { fresh: true });
    out.canReadMembership = true;
  } catch (err) {
    // This is the failure that matters: if the bot cannot read membership, the
    // gate fails open and silently lets everyone through.
    out.canReadMembership = false;
    out.code = err && err.code;
    out.description = err && err.description;
    out.hint = 'ربات باید در کانال ادمین باشد تا بتواند عضویت را بخواند.';
  }
  return out;
}

export default async function (input = {}) {
  const payload = input && typeof input === 'object' ? input : {};

  // A genuine Telegram shipping query — not ours. Do nothing.
  if (payload.invoice_payload || payload.shipping_address) {
    console.warn('ignoring a real shipping_query');
    return { ignored: true };
  }

  const job = payload.job || 'sample';
  console.info('running scheduled job:', job);

  let result;
  switch (job) {
    case 'digest':
      result = await runDigest({ force: !!payload.force, dryRun: !!payload.dryRun });
      break;
    case 'sample':
      result = await sampleJob();
      break;
    case 'channel':
      result = await postToChannel({ force: !!payload.force, dryRun: !!payload.dryRun });
      break;
    case 'gatecheck':
      result = await gatecheckJob(payload.userId);
      break;
    case 'setup':
      result = await setupJob();
      break;
    default:
      result = { ok: false, reason: `unknown job "${job}"` };
  }

  console.info('job result:', JSON.stringify(result));
  return result;
}
