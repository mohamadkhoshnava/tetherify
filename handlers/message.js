// handlers/message.js — every incoming message, in private chats and groups.

import { parseCommand, dispatch, send } from 'lib/commands';
import { touchChat, getChat, isAdmin, recentDays } from 'lib/store';
import { maybeRunDigest } from 'lib/digest';
import { ensureMember } from 'lib/gate';
import { refresh } from 'lib/prices';
import { getMarketOverview } from 'lib/market';
import { sendMarketWidget } from 'lib/widget';
import {
  priceCard, cryptoCard, goldCard, fiatCard, marketOverviewCard,
  topMessage, chartMessage, helpMessage,
} from 'lib/format';
import { mainKeyboard, marketKeyboard, backKeyboard, BTN, pvReplyKeyboard } from 'lib/keyboard';
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

    // 1. Reply keyboard buttons and natural language in PV
    if (text === BTN.MARKET || WIDGET_WORDS.test(text)) {
      const market = await getMarketOverview();
      const caption = marketOverviewCard(market);
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'market', caption });
      if (!sent) await send(chatId, caption, { reply_markup: mainKeyboard() });
      return;
    }

    if (text === BTN.CRYPTO || CRYPTO_WORDS.test(text)) {
      const market = await getMarketOverview();
      const caption = cryptoCard(market);
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'crypto', caption });
      if (!sent) await send(chatId, caption, { reply_markup: marketKeyboard('crypto') });
      return;
    }

    if (text === BTN.GOLD || GOLD_WORDS.test(text)) {
      const market = await getMarketOverview();
      const caption = goldCard(market);
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'gold', caption });
      if (!sent) await send(chatId, caption, { reply_markup: marketKeyboard('gold') });
      return;
    }

    if (text === BTN.FIAT || FIAT_WORDS.test(text)) {
      const market = await getMarketOverview();
      const caption = fiatCard(market);
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'fiat', caption });
      if (!sent) await send(chatId, caption, { reply_markup: marketKeyboard('fiat') });
      return;
    }

    if (text === BTN.TETHER || PRICE_WORDS.test(text)) {
      const market = await getMarketOverview();
      const caption = priceCard(market.tether || (await refresh()));
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'tether', caption });
      if (!sent) await send(chatId, caption, { reply_markup: mainKeyboard() });
      return;
    }

    if (text === BTN.TOP) {
      const market = await getMarketOverview();
      const caption = topMessage(market.tether || (await refresh()));
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'tether', caption });
      if (!sent) await send(chatId, caption, { reply_markup: backKeyboard() });
      return;
    }

    if (text === BTN.CHART) {
      const market = await getMarketOverview();
      const snapshot = market.tether || (await refresh());
      const days = await recentDays(7);
      const caption = chartMessage(days, snapshot);
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'market', caption });
      if (!sent) await send(chatId, caption, { reply_markup: backKeyboard() });
      return;
    }

    if (text === BTN.CALC) {
      const market = await getMarketOverview();
      const rate = market.usdtMedian || 255000;
      const caption =
        `🧮 <b>ماشین‌حساب و تبدیل نرخ لحظه‌ای</b>\n\n` +
        `از دکمه‌های لمسی زیر استفاده کنید یا بنویسید:\n` +
        `• <code>100 usdt</code> (تبدیل ۱۰۰ تتر به تومان)\n` +
        `• <code>5000000 toman</code> (تبدیل ۵ میلیون تومان به تتر)\n` +
        `• <code>0.2 btc</code> (تبدیل بیت‌کوین به تومان)\n\n` +
        `یا از دستور <code>/calc 100 usdt</code> استفاده کنید.\n\n` +
        `<i>💡 نرخ مبنای هر تتر: <b>${faNum(rate)}</b> تومان</i>`;
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'calc', caption });
      if (!sent) await send(chatId, caption, { reply_markup: marketKeyboard('calc') });
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
        const caption =
          `🧮 <b>نتیجه تبدیل</b>\n\n` +
          `<b>${faNum(amount)}</b> تومان برابر است با:\n` +
          `💵 <b>${toFaDigits(usdtVal)}</b> تتر (USDT)\n\n` +
          `<i>مبنا: تتر ${faNum(rate)} تومان</i>`;
        const sent = await sendMarketWidget(chatId, market, { initialTab: 'calc', caption });
        if (!sent) await send(chatId, caption);
        return;
      }

      if (unit === 'btc') {
        const btc = (market.crypto || []).find((c) => c.symbol === 'BTC');
        const btcUsd = (btc && btc.usdPrice) || 73000;
        const tomanVal = Math.round(amount * btcUsd * rate);
        const caption =
          `🧮 <b>نتیجه تبدیل بیت‌کوین</b>\n\n` +
          `<b>${toFaDigits(amount)}</b> BTC برابر است با:\n` +
          `🇮🇷 <b>${faNum(tomanVal)}</b> تومان\n\n` +
          `<i>مبنا: بیت‌کوین $${toFaDigits(faNum(btcUsd))}</i>`;
        const sent = await sendMarketWidget(chatId, market, { initialTab: 'calc', caption });
        if (!sent) await send(chatId, caption);
        return;
      }

      const tomanVal = Math.round(amount * rate);
      const caption =
        `🧮 <b>نتیجه تبدیل تتر</b>\n\n` +
        `<b>${toFaDigits(amount)}</b> تتر (USDT) برابر است با:\n` +
        `🇮🇷 <b>${faNum(tomanVal)}</b> تومان\n\n` +
        `<i>مبنا: هر تتر ${faNum(rate)} تومان</i>`;
      const sent = await sendMarketWidget(chatId, market, { initialTab: 'calc', caption });
      if (!sent) await send(chatId, caption);
      return;
    }

    // A bare number is almost always someone reaching for a price alert.
    const numeric = toEnDigits(text).replace(/[^\d]/g, '');
    if (numeric && numeric.length >= 5 && numeric.length <= 9) {
      const price = Number(numeric);
      await send(chatId,
        `عدد <b>${faNum(price)}</b> را دیدم.\n\n` +
        `اگر می‌خواهید وقتی قیمت به این عدد رسید خبرتان کنم، بنویسید:\n` +
        `<code>/alert ${numeric}</code>`);
      return;
    }

    const market = await getMarketOverview();
    const caption = startMessage(from ? from.first_name : '');
    const sent = await sendMarketWidget(chatId, market, { initialTab: 'market', caption });
    if (!sent) {
      await send(chatId, caption, { reply_markup: mainKeyboard() });
    }
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
