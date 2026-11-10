// handlers/message.js — every incoming message, in private chats and groups.

import { parseCommand, dispatch, send } from 'lib/commands';
import { touchChat, getChat, isAdmin, recentDays, getDay, addAlert, listAlerts } from 'lib/store';
import { maybeRunDigest } from 'lib/digest';
import { ensureMember } from 'lib/gate';
import { refresh } from 'lib/prices';
import { getMarketOverview } from 'lib/market';
import { sendMarketWidget } from 'lib/widget';
import {
  priceCard, cryptoCard, goldCard, fiatCard, marketOverviewCard,
  topMessage, chartMessage, helpMessage, alertMenuMessage, settingsMessage,
} from 'lib/format';
import {
  mainKeyboard, marketKeyboard, backKeyboard, BTN, pvReplyKeyboard,
  priceKeyboard, alertInteractiveKeyboard, settingsKeyboard,
} from 'lib/keyboard';
import { toEnDigits, faNum, toFaDigits } from 'lib/fa';

// Natural language matchers
const WIDGET_WORDS = /(ویجت|widget|تابلو|پنل|لمسی)/i;
const CRYPTO_WORDS = /(کریپتو|crypto|ارز\s*دیجیتال|بیت\s*کوین|بیتکوین|اتریوم|تون\s*کوین|سولانا|دوج)/i;
const GOLD_WORDS = /(طلا|سکه|gold|coin|مثقال|مظنه|انس|امامی|بهار\s*آزادی|نیم\s*سکه|ربع\s*سکه)/i;
const FIAT_WORDS = /(ارز|دلار|یورو|درهم|پوند|لیر|dollar|forex)/i;
const PRICE_WORDS = /(قیمت|تتر|usdt|tether|نرخ|چنده|چقدره|بازار)/i;

export default async function (message, ctx) {
  if (!message || !message.chat) return;

  const chat = message.chat;
  const from = message.from;
  const chatId = chat.id;
  const userId = from ? from.id : null;
  const isPrivate = chat.type === 'private';

  const record = await touchChat(chat, userId);
  if (record && record.banned) return;

  // Forced channel membership, private chats only. Non-members get the join
  // prompt and nothing else — including /start.
  if (!(await ensureMember(chat, userId))) return;

  const base = { chat, chatId, userId, from, message, update: ctx && ctx.update };

  try {
    const text = message.text || message.caption || '';
    const cmd = parseCommand(text);

    if (cmd) {
      const handled = await dispatch(cmd, base);
      if (!handled && isPrivate) {
        await send(chatId,
          `🤔 دستور <code>/${cmd.name}</code> را نمی‌شناسم.\n\nفهرست دستورها: /help`);
      }
      return;
    }

    // Groups stay quiet unless spoken to.
    if (!isPrivate) return;

    if (!text.trim()) return;

    // 1. Reply keyboard 1-tap quick actions inspired by Dollar Chande
    if (/^💸\s*کپی/i.test(text)) {
      const rawNum = text.match(/[\d,]+/);
      const numStr = rawNum ? rawNum[0].replace(/,/g, '') : '255000';
      const enNum = toEnDigits(numStr);
      await send(chatId, `📋 <b>کپی سریع نرخ تتر:</b>\n<code>${enNum}</code>\n<i>(روی عدد لمس کنید تا در کلیپ‌بورد کپی شود)</i>`);
      return;
    }

    if (/^⏰\s*رد\s*شد\s*از/i.test(text)) {
      const rawNum = text.match(/[\d,]+/);
      const numStr = rawNum ? rawNum[0].replace(/,/g, '') : '';
      const target = Number(toEnDigits(numStr));
      if (target > 0) {
        const snapshot = await refresh();
        const current = Math.round(snapshot.stats.median);
        const direction = target >= current ? 'above' : 'below';
        await addAlert(chatId, userId, direction, target);
        await send(chatId, `✅ <b>هشدار هوشمند ثبت شد!</b>\n\nهر زمان قیمت تتر از <b>${faNum(target)}</b> تومان عبور کرد، فوراً به شما پیام می‌دهم.\n<i>نرخ فعلی: ${faNum(current)} تومان</i>`, {
          reply_markup: pvReplyKeyboard(current),
        });
        return;
      }
    }

    if (text === BTN.SHARE || /ارسال به گروه/.test(text)) {
      await send(chatId, `برای ارسال تابلوی زنده قیمت به گروه‌ها و کانال‌ها، روی دکمه‌ی زیر بزنید و چت مقصد را انتخاب کنید:`, {
        reply_markup: {
          inline_keyboard: [[{ text: '👥 انتخاب گروه و ارسال تابلوی زنده ↗️', switch_inline_query: '' }]],
        },
      });
      return;
    }

    if (text === BTN.TOUCH_CHART || /تابلوی لمسی/.test(text)) {
      const market = await getMarketOverview();
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'market' });
      if (!sent) await send(chatId, marketOverviewCard(market), { reply_markup: mainKeyboard() });
      return;
    }

    if (text === BTN.HOME || text === BTN.BACK || text === BTN.TETHER || PRICE_WORDS.test(text)) {
      const snapshot = await refresh();
      const today = await getDay(snapshot.tehranNow.day);
      const days = await recentDays(7);
      const card = priceCard(snapshot, { timeframe: '24h', today, days });
      await send(chatId, card, {
        reply_markup: priceKeyboard(snapshot, { activeTimeframe: '24h' }),
      });
      return;
    }

    if (text === BTN.SETTINGS || /تنظیمات/.test(text)) {
      await send(chatId, settingsMessage(false), {
        reply_markup: settingsKeyboard(false),
      });
      return;
    }

    if (text === BTN.ALERT || /هشدار/.test(text)) {
      const snapshot = await refresh();
      const alerts = await listAlerts(chatId);
      const current = Math.round(snapshot.stats.median);
      await send(chatId, alertMenuMessage(current, alerts), {
        reply_markup: alertInteractiveKeyboard(current, alerts),
      });
      return;
    }

    if (text === BTN.MARKET || WIDGET_WORDS.test(text)) {
      const market = await getMarketOverview();
      await send(chatId, marketOverviewCard(market), { reply_markup: marketKeyboard('market') });
      return;
    }

    if (text === BTN.CRYPTO || CRYPTO_WORDS.test(text)) {
      const market = await getMarketOverview();
      await send(chatId, cryptoCard(market), { reply_markup: marketKeyboard('crypto') });
      return;
    }

    if (text === BTN.GOLD || GOLD_WORDS.test(text)) {
      const market = await getMarketOverview();
      await send(chatId, goldCard(market), { reply_markup: marketKeyboard('gold') });
      return;
    }

    if (text === BTN.FIAT || FIAT_WORDS.test(text)) {
      const market = await getMarketOverview();
      await send(chatId, fiatCard(market), { reply_markup: marketKeyboard('fiat') });
      return;
    }

    if (text === BTN.TOP) {
      const market = await getMarketOverview();
      await send(chatId, topMessage(market.tether || (await refresh())), { reply_markup: backKeyboard() });
      return;
    }

    if (text === BTN.CHART) {
      const market = await getMarketOverview();
      const snapshot = market.tether || (await refresh());
      const days = await recentDays(7);
      await send(chatId, chartMessage(days, snapshot), { reply_markup: backKeyboard() });
      return;
    }

    if (text === BTN.CALC) {
      const market = await getMarketOverview();
      const rate = market.usdtMedian || 255000;
      const caption =
        `🧮 <b>ماشین‌حساب و تبدیل نرخ لحظه‌ای</b>\n\n` +
        `برای تبدیل بنویسید:\n` +
        `• <code>100 usdt</code> (تبدیل ۱۰۰ تتر به تومان)\n` +
        `• <code>5000000 toman</code> (تبدیل ۵ میلیون تومان به تتر)\n` +
        `• <code>0.2 btc</code> (تبدیل بیت‌کوین به تومان)\n\n` +
        `<i>💡 نرخ مبنای هر تتر: <b>${faNum(rate)}</b> تومان</i>`;
      await send(chatId, caption, { reply_markup: marketKeyboard('calc') });
      return;
    }

    if (text === BTN.ALERT) {
      await send(chatId,
        `🔔 <b>تنظیم هشدار قیمت تتر</b>\n\n` +
        `برای ساخت هشدار، کافیست عدد مورد نظر را بنویسید (مثلاً <code>240000</code>) یا از دستور زیر استفاده کنید:\n` +
        `<code>/alert 240000</code>\n\n` +
        `فهرست هشدارهای فعال: /alerts`);
      return;
    }

    if (text === BTN.HELP) {
      await send(chatId, helpMessage(isAdmin(userId)));
      return;
    }

    // Fast inline calculator like "100 usdt" or "200 usd"
    const calcMatch = toEnDigits(text).trim().toLowerCase().match(/^(\d+(\.\d+)?)\s*(usdt|toman|irr|btc|تومان|تتر)$/);
    if (calcMatch) {
      const amount = Number(calcMatch[1]);
      const unit = calcMatch[3];
      const market = await getMarketOverview();
      const rate = market.usdtMedian || 255000;

      if (unit === 'toman' || unit === 'irr' || unit === 'تومان') {
        const usdtVal = (amount / rate).toFixed(2);
        await send(chatId,
          `🧮 <b>نتیجه تبدیل</b>\n\n` +
          `<b>${faNum(amount)}</b> تومان برابر است با:\n` +
          `💵 <b>${toFaDigits(usdtVal)}</b> تتر (USDT)\n\n` +
          `<i>مبنا: تتر ${faNum(rate)} تومان</i>`);
        return;
      }

      if (unit === 'btc') {
        const btc = (market.crypto || []).find((c) => c.symbol === 'BTC');
        const btcUsd = (btc && btc.usdPrice) || 73000;
        const tomanVal = Math.round(amount * btcUsd * rate);
        await send(chatId,
          `🧮 <b>نتیجه تبدیل بیت‌کوین</b>\n\n` +
          `<b>${toFaDigits(amount)}</b> BTC برابر است با:\n` +
          `🇮🇷 <b>${faNum(tomanVal)}</b> تومان\n\n` +
          `<i>مبنا: بیت‌کوین $${toFaDigits(faNum(btcUsd))}</i>`);
        return;
      }

      const tomanVal = Math.round(amount * rate);
      await send(chatId,
        `🧮 <b>نتیجه تبدیل تتر</b>\n\n` +
        `<b>${toFaDigits(amount)}</b> تتر (USDT) برابر است با:\n` +
        `🇮🇷 <b>${faNum(tomanVal)}</b> تومان\n\n` +
        `<i>مبنا: هر تتر ${faNum(rate)} تومان</i>`);
      return;
    }

    // A bare number: offer a 1-tap button to register an alert immediately!
    const numeric = toEnDigits(text).replace(/[^\d]/g, '');
    if (numeric && numeric.length >= 5 && numeric.length <= 9) {
      const price = Number(numeric);
      const snapshot = await refresh();
      const current = Math.round(snapshot.stats.median);
      const direction = price >= current ? 'above' : 'below';
      const word = direction === 'above' ? 'عبور قیمت از' : 'افت قیمت به زیر';

      await send(chatId,
        `🎯 <b>تنظیم سریع هشدار قیمت تتر</b>\n\n` +
        `آیا مایلید به محض ${word} <b>${faNum(price)}</b> تومان به شما اطلاع دهم؟\n\n` +
        `<i>نرخ لحظه‌ای تتر: ${faNum(current)} تومان</i>`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `⏰ بله، فعال‌سازی هشدار ${faNum(price)} ت`, callback_data: `${CB.ALERT_SET}:${price}` }],
              [{ text: '🔙 انصراف', callback_data: CB.REFRESH }],
            ],
          },
        });
      return;
    }

    const snapshot = await refresh();
    const today = await getDay(snapshot.tehranNow.day);
    const days = await recentDays(7);
    const card = priceCard(snapshot, { timeframe: '24h', today, days });
    await send(chatId, card, {
      reply_markup: priceKeyboard(snapshot, { activeTimeframe: '24h' }),
    });
  } catch (err) {
    console.error('message handler failed:', err && (err.description || err.message));
    if (isPrivate) {
      try {
        await send(chatId, '⚠️ مشکلی پیش آمد. لطفاً کمی بعد دوباره تلاش کنید.');
      } catch { /* the chat is gone; nothing to do */ }
    }
  } finally {
    // Traffic-driven fallback for the daily report, in case the scheduled
    // trigger is not running. Cheap and self-throttling.
    await maybeRunDigest();
  }
}
