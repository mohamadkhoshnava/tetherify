// lib/commands.js — command parsing and dispatch for private chats and groups.

import { api } from 'sdk';
import { refresh, getSnapshot } from 'lib/prices';
import { runDigest } from 'lib/digest';
import { postToChannel, channelTarget } from 'lib/channel';
import { gateEnabled, gateTarget, isMember } from 'lib/gate';
import { tehran, faNum, faAgo, esc, toEnDigits, toFaDigits } from 'lib/fa';
import { FLAG_LABEL, FLAG_ICON, rejectionReport } from 'lib/quality';
import { BRAND, DEFAULTS } from 'lib/config';
import {
  priceCard, listMessage, topMessage, excludedMessage, avgMessage, chartMessage,
  startMessage, helpMessage, aboutMessage, alertsMessage,
} from 'lib/format';
import { mainKeyboard, listKeyboard, backKeyboard, subscribeKeyboard } from 'lib/keyboard';
import {
  isAdmin, getChat, setSubscribed, setBanned, subscribedChats, chatStats,
  getDay, recentDays, addAlert, listAlerts, removeAlert, clearAlerts, alertCount,
  effectiveConfig, setSetting, getSetting, allSettings, cacheClear, lastSample, nowSec,
} from 'lib/store';

const MAX_LEN = 4000;

function clip(text) {
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}\n<i>… بریده شد</i>` : text;
}

async function send(chatId, text, extra = {}) {
  return api.sendMessage({
    chat_id: chatId,
    text: clip(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

/**
 * Parse "/price@some_bot arg1 arg2" into a command name and its arguments.
 * Returns null when the text is not a command.
 */
export function parseCommand(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  const name = head.slice(1).split('@')[0].toLowerCase();
  if (!name) return null;
  return { name, args: rest, argText: rest.join(' ') };
}

/** Group commands are only honoured for users who administer that group. */
async function isChatAdmin(chatId, userId) {
  try {
    const member = await api.getChatMember({ chat_id: chatId, user_id: userId });
    return member && (member.status === 'creator' || member.status === 'administrator');
  } catch {
    return false;
  }
}

const PRIVATE = (chat) => chat.type === 'private';

// ---------------------------------------------------------------------------
// Public commands
// ---------------------------------------------------------------------------

const publicHandlers = {
  async start(ctx) {
    const name = ctx.from ? ctx.from.first_name : '';
    await send(ctx.chatId, startMessage(name), { reply_markup: mainKeyboard() });
  },

  async help(ctx) {
    await send(ctx.chatId, helpMessage(isAdmin(ctx.userId)));
  },

  async about(ctx) {
    await send(ctx.chatId, aboutMessage(), { reply_markup: backKeyboard() });
  },

  async id(ctx) {
    await send(ctx.chatId,
      `🆔 شناسه‌ی این چت: <code>${ctx.chatId}</code>\n` +
      `👤 شناسه‌ی شما: <code>${ctx.userId}</code>\n` +
      `📂 نوع چت: <code>${esc(ctx.chat.type)}</code>`);
  },

  async price(ctx) {
    const snapshot = await refresh();
    await send(ctx.chatId, priceCard(snapshot), { reply_markup: mainKeyboard() });
  },

  async list(ctx) {
    const snapshot = await refresh();
    const page = Math.max(0, (Number(toEnDigits(ctx.args[0])) || 1) - 1);
    const { text, pages, page: p } = listMessage(snapshot, page, snapshot.cfg.pageSize);
    await send(ctx.chatId, text, { reply_markup: listKeyboard(p, pages) });
  },

  async top(ctx) {
    const snapshot = await refresh();
    await send(ctx.chatId, topMessage(snapshot), { reply_markup: backKeyboard() });
  },

  async excluded(ctx) {
    const snapshot = await refresh();
    await send(ctx.chatId, excludedMessage(snapshot), { reply_markup: backKeyboard() });
  },

  async avg(ctx) {
    const snapshot = await refresh();
    const t = snapshot.tehranNow;
    const today = await getDay(t.day);
    const days = await recentDays(2);
    const yesterday = days.find((d) => d.day !== t.day) || null;
    await send(ctx.chatId, avgMessage(snapshot, today, yesterday), { reply_markup: backKeyboard() });
  },

  async chart(ctx) {
    const snapshot = await refresh();
    const days = await recentDays(7);
    await send(ctx.chatId, chartMessage(days, snapshot), { reply_markup: backKeyboard() });
  },

  async alert(ctx) {
    const raw = toEnDigits(ctx.argText).replace(/[^\d.]/g, '');
    const price = Number(raw);
    if (!raw || !isFinite(price) || price <= 0) {
      await send(ctx.chatId,
        `🔔 <b>ساخت هشدار قیمت</b>\n\n` +
        `عدد مورد نظر را بنویسید، مثلاً:\n<code>/alert 230000</code>\n\n` +
        `اگر عدد بالاتر از قیمت فعلی باشد هشدار صعودی و اگر پایین‌تر باشد هشدار نزولی ساخته می‌شود.`);
      return;
    }

    const snapshot = await refresh();
    if (!snapshot.stats.ok) {
      await send(ctx.chatId, '⚠️ فعلاً قیمت معتبری در دسترس نیست. کمی بعد دوباره تلاش کنید.');
      return;
    }

    const current = snapshot.stats.bestBuy;
    const direction = price >= current ? 'above' : 'below';
    const existing = await listAlerts(ctx.chatId);
    if (existing.length >= 10) {
      await send(ctx.chatId, '⚠️ حداکثر ۱۰ هشدار فعال می‌توانید داشته باشید. یکی را با /delalert حذف کنید.');
      return;
    }

    await addAlert(ctx.chatId, ctx.userId, direction, price);
    const word = direction === 'above' ? 'بالاتر از' : 'پایین‌تر از';
    await send(ctx.chatId,
      `✅ هشدار ثبت شد.\n\nهر وقت قیمت تتر ${word} <b>${faNum(price)}</b> تومان شد خبرتان می‌کنم.\n` +
      `<i>قیمت فعلی: ${faNum(current)} تومان</i>`);
  },

  async alerts(ctx) {
    await send(ctx.chatId, alertsMessage(await listAlerts(ctx.chatId)));
  },

  async delalert(ctx) {
    const arg = toEnDigits(ctx.argText).trim();
    if (arg === 'all' || arg === 'همه') {
      await clearAlerts(ctx.chatId);
      await send(ctx.chatId, '🗑 همه‌ی هشدارهای این چت حذف شد.');
      return;
    }
    const id = Number(arg);
    if (!id) {
      await send(ctx.chatId, 'شناسه‌ی هشدار را بنویسید، مثلاً <code>/delalert 3</code>\nفهرست: /alerts');
      return;
    }
    await removeAlert(id, ctx.chatId);
    await send(ctx.chatId, `🗑 هشدار ${toFaDigits(id)} حذف شد.`);
  },

  async subscribe(ctx) {
    if (!PRIVATE(ctx.chat) && !isAdmin(ctx.userId) && !(await isChatAdmin(ctx.chatId, ctx.userId))) {
      await send(ctx.chatId, '⛔️ فقط مدیران گروه می‌توانند گزارش روزانه را فعال کنند.');
      return;
    }
    await setSubscribed(ctx.chatId, true);
    const cfg = await effectiveConfig();
    await send(ctx.chatId,
      `🔔 گزارش روزانه فعال شد.\n\nهر شب حوالی ساعت ${toFaDigits(cfg.digestHour)} ` +
      `خلاصه‌ی میانگین روز را همین‌جا می‌فرستم.\n<i>برای لغو: /unsubscribe</i>`,
      { reply_markup: subscribeKeyboard(true) });
  },

  async unsubscribe(ctx) {
    if (!PRIVATE(ctx.chat) && !isAdmin(ctx.userId) && !(await isChatAdmin(ctx.chatId, ctx.userId))) {
      await send(ctx.chatId, '⛔️ فقط مدیران گروه می‌توانند این تنظیم را تغییر دهند.');
      return;
    }
    await setSubscribed(ctx.chatId, false);
    await send(ctx.chatId, '🔕 گزارش روزانه غیرفعال شد.', { reply_markup: subscribeKeyboard(false) });
  },
};

// Aliases.
publicHandlers.p = publicHandlers.price;
publicHandlers.ex = publicHandlers.excluded;
publicHandlers.average = publicHandlers.avg;
publicHandlers.sub = publicHandlers.subscribe;
publicHandlers.unsub = publicHandlers.unsubscribe;
publicHandlers.history = publicHandlers.chart;

// ---------------------------------------------------------------------------
// Admin commands
// ---------------------------------------------------------------------------

const adminHandlers = {
  async stats(ctx) {
    const s = await chatStats();
    const alerts = await alertCount();
    const last = await lastSample();
    const days = await recentDays(30);
    await send(ctx.chatId,
      `🛠 <b>آمار ${BRAND}</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      `👥 کل چت‌ها: <b>${faNum(s.total)}</b>\n` +
      `💬 خصوصی: ${faNum(s.priv)} · گروه/کانال: ${faNum(s.groups)}\n` +
      `🔔 مشترک گزارش روزانه: <b>${faNum(s.subs)}</b>\n` +
      `⛔️ مسدود: ${faNum(s.banned)}\n` +
      `📨 مجموع پیام‌های دریافتی: ${faNum(s.msgs)}\n` +
      `🔕 هشدارهای فعال: ${faNum(alerts)}\n` +
      `📆 روزهای ثبت‌شده: ${faNum(days.length)}\n` +
      `🕐 آخرین نمونه: ${last ? esc(faAgo((nowSec() - last.ts) / 60)) : '—'}`);
  },

  async health(ctx) {
    const snapshot = await getSnapshot();
    const last = await lastSample();
    const lastDigest = await getSetting('lastDigestAt', 0);
    await send(ctx.chatId,
      `❤️ <b>وضعیت سامانه</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      `منبع: ${snapshot.degraded ? '⚠️ در دسترس نیست (داده‌ی ذخیره‌شده)' : '✅ سالم'}\n` +
      `کش: ${snapshot.cached ? 'استفاده شد' : 'تازه گرفته شد'} · سن داده: ${esc(faAgo(snapshot.ageSec / 60))}\n` +
      `صرافی‌های خوانده‌شده: ${faNum(snapshot.stats.total)}\n` +
      `معتبر: ${faNum(snapshot.stats.count)} · حذف‌شده: ${faNum(snapshot.stats.rejectedCount)}\n` +
      `میانه: ${faNum(snapshot.meta.ref)} · MAD: ${faNum(snapshot.meta.madPct, 3)}٪\n` +
      `پهنای مجاز انحراف: ${faNum(snapshot.meta.band, 2)}٪\n` +
      `آخرین نمونه: ${last ? esc(faAgo((nowSec() - last.ts) / 60)) : '—'}\n` +
      `آخرین گزارش روزانه: ${lastDigest ? esc(faAgo((nowSec() - lastDigest) / 60)) : '—'}`);
  },

  async raw(ctx) {
    const snapshot = await getSnapshot();
    let m = `🔬 <b>گزارش کامل کیفیت داده</b>\n`;
    m += `میانه ${faNum(snapshot.meta.ref)} · MAD ${faNum(snapshot.meta.madPct, 3)}٪ · پهنا ${faNum(snapshot.meta.band, 2)}٪\n`;
    m += `━━━━━━━━━━━━━━━\n`;
    for (const [reason, list] of rejectionReport(snapshot)) {
      m += `\n${FLAG_ICON[reason] || '•'} <b>${esc(FLAG_LABEL[reason] || reason)}</b> (${faNum(list.length)})\n`;
      for (const r of list) {
        m += `  ${esc(r.name)} | ask ${faNum(r.ask)} | bid ${faNum(r.bid)} | ` +
             `dev ${r.devPct == null ? '—' : faNum(r.devPct, 2) + '٪'} | ` +
             `stale ${r.staleMin == null ? '—' : faNum(r.staleMin) + 'd'} | x${toFaDigits(r.factor)}\n`;
      }
    }
    await send(ctx.chatId, m);
  },

  async digest(ctx) {
    await send(ctx.chatId, '⏳ در حال ساخت و ارسال گزارش روزانه…');
    const result = await runDigest({ force: true });
    await send(ctx.chatId,
      `✅ گزارش اجرا شد.\n<code>${esc(JSON.stringify(result, null, 1))}</code>`);
  },

  async channel(ctx) {
    const dry = /^(dry|test|آزمایش)$/i.test(ctx.argText.trim());
    await send(ctx.chatId, dry ? '⏳ ساخت پیش‌نمایش پست کانال…' : '⏳ ارسال پست به کانال…');
    const result = await postToChannel({ force: true, dryRun: dry });
    if (result.preview) {
      await send(ctx.chatId, result.preview);
      return;
    }
    await send(ctx.chatId,
      result.ok
        ? `✅ پست کانال ارسال شد به <code>${esc(result.target)}</code>.`
        : `⛔️ ارسال ناموفق بود.\n<code>${esc(JSON.stringify(result, null, 1))}</code>`);
  },

  async forcejoin(ctx) {
    const arg = ctx.argText.trim().toLowerCase();
    const target = await gateTarget();

    if (!arg) {
      const on = await gateEnabled();
      await send(ctx.chatId,
        `🔒 <b>عضویت اجباری</b>: ${on ? '✅ روشن' : '⛔️ خاموش'}\n` +
        `کانال: <code>${esc(target || '—')}</code>\n\n` +
        `تغییر: <code>/forcejoin on</code> یا <code>/forcejoin off</code>\n` +
        `<i>فقط روی چت خصوصی اعمال می‌شود؛ گروه‌ها آزادند.</i>`);
      return;
    }

    const on = ['on', 'روشن', '1', 'true', 'فعال'].includes(arg);
    const off = ['off', 'خاموش', '0', 'false', 'غیرفعال'].includes(arg);
    if (!on && !off) {
      await send(ctx.chatId, 'فقط <code>on</code> یا <code>off</code>.');
      return;
    }

    await setSetting('forceJoin', on ? 1 : 0);
    await send(ctx.chatId,
      on
        ? `🔒 عضویت اجباری روشن شد. کاربران پیوی باید عضو <code>${esc(target)}</code> باشند.`
        : `🔓 عضویت اجباری خاموش شد.`);
  },

  async setchannel(ctx) {
    const target = ctx.argText.trim();
    if (!target) {
      const current = await channelTarget();
      await send(ctx.chatId,
        `📣 کانال فعلی: <code>${esc(current || '—')}</code>\n\n` +
        `تغییر: <code>/setchannel @channelusername</code>\n` +
        `<i>ربات باید در آن کانال ادمین باشد.</i>`);
      return;
    }
    await setSetting('channelId', target);
    await send(ctx.chatId,
      `✅ کانال روی <code>${esc(target)}</code> تنظیم شد.\n` +
      `<i>برای آزمایش: /channel</i>`);
  },

  async refresh(ctx) {
    await cacheClear('source:rows');
    const snapshot = await refresh({ force: true });
    await send(ctx.chatId,
      `🔄 کش پاک و داده تازه گرفته شد.\n` +
      `${faNum(snapshot.stats.count)} معتبر از ${faNum(snapshot.stats.total)} صرافی.`);
  },

  async broadcast(ctx) {
    const text = ctx.argText.trim();
    if (!text) {
      await send(ctx.chatId, 'متن پیام را بعد از دستور بنویسید:\n<code>/broadcast سلام</code>');
      return;
    }
    const targets = await subscribedChats();
    let sent = 0;
    let failed = 0;
    for (const c of targets) {
      try {
        await send(c.id, `📢 <b>پیام از ${BRAND}</b>\n\n${esc(text)}`);
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    await send(ctx.chatId, `📢 ارسال شد به ${faNum(sent)} چت. ناموفق: ${faNum(failed)}.`);
  },

  async config(ctx) {
    const cfg = await effectiveConfig();
    const overrides = await allSettings();
    const overridden = new Set(overrides.map((o) => o.key));
    let m = `⚙️ <b>تنظیمات فعلی</b>\n━━━━━━━━━━━━━━━\n`;
    for (const [k, v] of Object.entries(cfg)) {
      const mark = overridden.has(k) ? '✏️' : '  ';
      m += `${mark} <code>${esc(k)}</code> = <b>${esc(Array.isArray(v) ? v.join('، ') : v)}</b>\n`;
    }
    m += `\n<i>تغییر: </i><code>/set devTolerancePct 3</code>`;
    await send(ctx.chatId, m);
  },

  async set(ctx) {
    const [key, ...rest] = ctx.args;
    const value = toEnDigits(rest.join(' ')).trim();
    if (!key || !value) {
      await send(ctx.chatId, 'قالب درست: <code>/set devTolerancePct 3</code>\nفهرست کلیدها: /config');
      return;
    }
    if (!(key in DEFAULTS)) {
      await send(ctx.chatId, `⛔️ کلید <code>${esc(key)}</code> شناخته نشد. فهرست: /config`);
      return;
    }
    const num = Number(value);
    if (!isFinite(num) || num < 0) {
      await send(ctx.chatId, '⛔️ مقدار باید یک عدد مثبت باشد.');
      return;
    }
    await setSetting(key, num);
    await send(ctx.chatId, `✅ <code>${esc(key)}</code> روی <b>${faNum(num, 2)}</b> تنظیم شد.`);
  },

  async block(ctx) {
    const name = ctx.argText.trim();
    if (!name) {
      await send(ctx.chatId, 'نام صرافی را بنویسید: <code>/block پول نو</code>');
      return;
    }
    const cfg = await effectiveConfig();
    const list = Array.from(new Set([...(cfg.blocklist || []), name]));
    await setSetting('blocklist', list);
    await cacheClear('source:rows');
    await send(ctx.chatId, `🚫 «${esc(name)}» به فهرست مسدود اضافه شد.\nفهرست: ${esc(list.join('، '))}`);
  },

  async unblock(ctx) {
    const name = ctx.argText.trim();
    const cfg = await effectiveConfig();
    const list = (cfg.blocklist || []).filter((n) => n !== name);
    await setSetting('blocklist', list);
    await cacheClear('source:rows');
    await send(ctx.chatId, `✅ «${esc(name)}» از فهرست مسدود حذف شد.\nفهرست: ${esc(list.join('، ') || '—')}`);
  },

  async ban(ctx) {
    const id = Number(toEnDigits(ctx.argText).trim());
    if (!id) { await send(ctx.chatId, 'شناسه‌ی عددی چت را بنویسید.'); return; }
    await setBanned(id, true);
    await send(ctx.chatId, `⛔️ چت <code>${id}</code> مسدود شد.`);
  },

  async unban(ctx) {
    const id = Number(toEnDigits(ctx.argText).trim());
    if (!id) { await send(ctx.chatId, 'شناسه‌ی عددی چت را بنویسید.'); return; }
    await setBanned(id, false);
    await send(ctx.chatId, `✅ چت <code>${id}</code> از مسدودی خارج شد.`);
  },
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Run a command. Returns true when the command existed and was handled.
 */
export async function dispatch(cmd, ctx) {
  if (adminHandlers[cmd.name]) {
    if (!isAdmin(ctx.userId)) {
      // Stay quiet in groups so the bot does not advertise its admin surface.
      if (PRIVATE(ctx.chat)) await send(ctx.chatId, '⛔️ این دستور فقط برای مدیر ربات است.');
      return true;
    }
    await adminHandlers[cmd.name]({ ...ctx, args: cmd.args, argText: cmd.argText });
    return true;
  }

  if (publicHandlers[cmd.name]) {
    await publicHandlers[cmd.name]({ ...ctx, args: cmd.args, argText: cmd.argText });
    return true;
  }

  return false;
}

export { send, publicHandlers, adminHandlers };
