// handlers/callback_query.js — the inline keyboard buttons.
//
// Buttons edit the message in place rather than sending a new one, so a chat
// does not fill up with near-identical price cards.

import { api } from 'sdk';
import { CB } from 'lib/config';
import { refresh } from 'lib/prices';
import {
  priceCard, listMessage, topMessage, excludedMessage, avgMessage, chartMessage,
  helpMessage, startMessage,
} from 'lib/format';
import { mainKeyboard, listKeyboard, backKeyboard, subscribeKeyboard } from 'lib/keyboard';
import { getDay, recentDays, setSubscribed, isAdmin, touchChat } from 'lib/store';

async function edit(query, text, markup) {
  try {
    await api.editMessageText({
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: markup,
    });
  } catch (err) {
    // 400 "message is not modified" just means the price has not moved.
    if (!err || err.code !== 400) throw err;
  }
}

export default async function (query) {
  if (!query || !query.data || !query.message) return;

  const data = query.data;
  const [key, arg] = data.split(':');
  let toast = '';

  try {
    switch (key) {
      case 'noop':
        break;

      case CB.REFRESH: {
        const snapshot = await refresh({ force: true });
        await edit(query, priceCard(snapshot), mainKeyboard());
        toast = 'به‌روز شد';
        break;
      }

      case CB.HOME: {
        const snapshot = await refresh();
        await edit(query, priceCard(snapshot), mainKeyboard());
        break;
      }

      case CB.LIST: {
        const snapshot = await refresh();
        const { text, pages, page } = listMessage(snapshot, Number(arg) || 0, snapshot.cfg.pageSize);
        await edit(query, text, listKeyboard(page, pages));
        break;
      }

      case CB.TOP: {
        const snapshot = await refresh();
        await edit(query, topMessage(snapshot), backKeyboard());
        break;
      }

      case CB.EXCLUDED: {
        const snapshot = await refresh();
        await edit(query, excludedMessage(snapshot), backKeyboard());
        break;
      }

      case CB.AVG: {
        const snapshot = await refresh();
        const t = snapshot.tehranNow;
        const today = await getDay(t.day);
        const days = await recentDays(2);
        const yesterday = days.find((d) => d.day !== t.day) || null;
        await edit(query, avgMessage(snapshot, today, yesterday), backKeyboard());
        break;
      }

      case CB.CHART: {
        const snapshot = await refresh();
        await edit(query, chartMessage(await recentDays(7), snapshot), backKeyboard());
        break;
      }

      case CB.HELP: {
        await edit(query, helpMessage(isAdmin(query.from && query.from.id)), backKeyboard());
        break;
      }

      case CB.SUB: {
        const on = arg === '1';
        await setSubscribed(query.message.chat.id, on);
        toast = on ? 'گزارش روزانه فعال شد' : 'گزارش روزانه غیرفعال شد';
        await edit(query, query.message.text || '', subscribeKeyboard(on));
        break;
      }

      default:
        toast = 'این دکمه دیگر کار نمی‌کند';
    }
  } catch (err) {
    console.error('callback failed:', err && (err.description || err.message));
    toast = 'خطا در پردازش';
  }

  // Always answer, or the client shows a spinner until it times out.
  try {
    await api.answerCallbackQuery({ callback_query_id: query.id, text: toast || undefined });
  } catch { /* the query expired */ }
}
