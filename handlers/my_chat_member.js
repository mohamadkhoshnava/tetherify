// handlers/my_chat_member.js — the bot's own membership changing in a chat.
//
// Used to greet a group on join, and to stop broadcasting to chats the bot has
// been removed from.

import { api } from 'sdk';
import { touchChat, setSubscribed } from 'lib/store';
import { BRAND } from 'lib/config';
import { esc } from 'lib/fa';
import { mainKeyboard } from 'lib/keyboard';

const GONE = ['left', 'kicked'];
const PRESENT = ['member', 'administrator', 'creator'];

export default async function (upd) {
  if (!upd || !upd.chat || !upd.new_chat_member) return;

  const chat = upd.chat;
  const status = upd.new_chat_member.status;
  const addedBy = upd.from ? upd.from.id : null;

  await touchChat(chat, addedBy);

  if (GONE.includes(status)) {
    await setSubscribed(chat.id, false);
    console.info('removed from chat', chat.id, status);
    return;
  }

  if (!PRESENT.includes(status)) return;
  if (chat.type === 'private') return;
  if (PRESENT.includes(upd.old_chat_member && upd.old_chat_member.status)) return;

  try {
    await api.sendMessage({
      chat_id: chat.id,
      parse_mode: 'HTML',
      reply_markup: mainKeyboard(),
      text:
        `👋 سلام به <b>${esc(chat.title || 'این گروه')}</b>!\n\n` +
        `من <b>${BRAND}</b> هستم. قیمت تتر را از حدود ۹۰ صرافی ایرانی می‌گیرم، ` +
        `نرخ‌های خطادار و قدیمی را کنار می‌گذارم و خلاصه‌ی تمیزش را می‌دهم.\n\n` +
        `• /price — قیمت لحظه‌ای\n` +
        `• /top — بهترین‌ها برای خرید و فروش\n` +
        `• /avg — میانگین امروز\n` +
        `• /excluded — چه نرخ‌هایی حذف شدند و چرا\n\n` +
        `مدیران گروه می‌توانند با /subscribe گزارش روزانه را فعال کنند.`,
    });
  } catch (err) {
    console.warn('greeting failed for', chat.id, err && err.description);
  }
}
