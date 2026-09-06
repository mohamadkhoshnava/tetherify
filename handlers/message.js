// handlers/message.js — every incoming message, in private chats and groups.

import { parseCommand, dispatch, send } from 'lib/commands';
import { touchChat, getChat, isAdmin } from 'lib/store';
import { maybeRunDigest } from 'lib/digest';
import { refresh } from 'lib/prices';
import { priceCard } from 'lib/format';
import { mainKeyboard } from 'lib/keyboard';
import { toEnDigits, faNum } from 'lib/fa';

// In private chats the bot also answers plain language, not just slash commands.
const PRICE_WORDS = /(قیمت|تتر|usdt|tether|دلار|نرخ|چنده|چقدره)/i;

export default async function (message, ctx) {
  if (!message || !message.chat) return;

  const chat = message.chat;
  const from = message.from;
  const chatId = chat.id;
  const userId = from ? from.id : null;
  const isPrivate = chat.type === 'private';

  const record = await touchChat(chat, userId);
  if (record && record.banned) return;

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

    // "قیمت چنده؟" and friends.
    if (PRICE_WORDS.test(text)) {
      const snapshot = await refresh();
      await send(chatId, priceCard(snapshot), { reply_markup: mainKeyboard() });
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

    await send(chatId,
      `سلام! 👋\nبرای دیدن قیمت لحظه‌ای /price را بزنید یا از دکمه‌های زیر استفاده کنید.`,
      { reply_markup: mainKeyboard() });
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
