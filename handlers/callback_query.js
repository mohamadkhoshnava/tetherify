// handlers/callback_query.js — the inline keyboard buttons.
//
// Buttons edit the message in place rather than sending a new one, so a chat
// does not fill up with near-identical price cards.

import { api } from 'sdk';
import { CB } from 'lib/config';
import { refresh } from 'lib/prices';
import { getMarketOverview } from 'lib/market';
import { sendMarketWidget } from 'lib/widget';
import { faNum } from 'lib/fa';
import {
  priceCard, listMessage, topMessage, excludedMessage, avgMessage, chartMessage,
  helpMessage, startMessage, cryptoCard, goldCard, fiatCard, marketOverviewCard,
  alertMenuMessage, alertListMessage, settingsMessage,
} from 'lib/format';
import {
  mainKeyboard, listKeyboard, backKeyboard, subscribeKeyboard, marketKeyboard,
  priceKeyboard, alertInteractiveKeyboard, alertListKeyboard, settingsKeyboard,
} from 'lib/keyboard';
import {
  getDay, recentDays, setSubscribed, isAdmin, touchChat,
  addAlert, listAlerts, removeAlert, clearAlerts,
} from 'lib/store';
import { isMember, gateEnabled, gateTarget, gatePrompt, forgetMembership } from 'lib/gate';

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
  const userId = query.from && query.from.id;
  const isPrivate = query.message.chat.type === 'private';
  let toast = '';

  try {
    // The "I joined" button: re-check without the cache, then let them in.
    if (key === CB.JOIN) {
      await forgetMembership(userId);
      const ok = await isMember(userId, { fresh: true });
      if (ok) {
        const snapshot = await refresh();
        await edit(query, priceCard(snapshot), mainKeyboard());
        toast = 'خوش آمدید! ✅';
      } else {
        toast = 'هنوز عضو کانال نیستید';
      }
      await api.answerCallbackQuery({
        callback_query_id: query.id,
        text: toast,
        show_alert: !ok,
      });
      return;
    }

    // Every other button in a private chat is gated the same way messages are.
    if (isPrivate && await gateEnabled() && !(await isMember(userId))) {
      const prompt = await gatePrompt(await gateTarget());
      await edit(query, prompt.text, prompt.reply_markup);
      await api.answerCallbackQuery({ callback_query_id: query.id, text: 'اول عضو کانال شوید' });
      return;
    }

    switch (key) {
      case 'noop':
        break;

      case CB.REFRESH:
      case CB.HOME:
      case CB.TF_24H: {
        const snapshot = await refresh({ force: key === CB.REFRESH });
        const today = await getDay(snapshot.tehranNow.day);
        const days = await recentDays(7);
        await edit(query, priceCard(snapshot, { timeframe: '24h', today, days }), priceKeyboard(snapshot, { activeTimeframe: '24h' }));
        toast = key === CB.REFRESH ? 'به‌روزرسانی شد 🔄' : '';
        break;
      }

      case CB.TF_7D: {
        const snapshot = await refresh();
        const today = await getDay(snapshot.tehranNow.day);
        const days = await recentDays(7);
        await edit(query, priceCard(snapshot, { timeframe: '7d', today, days }), priceKeyboard(snapshot, { activeTimeframe: '7d' }));
        toast = 'نمای ۷ روزه 🥞';
        break;
      }

      case CB.ALERT_MENU: {
        const snapshot = await refresh();
        const alerts = await listAlerts(query.message.chat.id);
        const current = Math.round(snapshot.stats.median);
        await edit(query, alertMenuMessage(current, alerts), alertInteractiveKeyboard(current, alerts));
        break;
      }

      case CB.ALERT_SET: {
        const target = Number(arg);
        if (target > 0) {
          const snapshot = await refresh();
          const current = Math.round(snapshot.stats.median);
          const direction = target >= current ? 'above' : 'below';
          await addAlert(query.message.chat.id, userId, direction, target);
          const alerts = await listAlerts(query.message.chat.id);
          await edit(query, alertMenuMessage(current, alerts), alertInteractiveKeyboard(current, alerts));
          toast = `✅ هشدار ${faNum(target)} ت ثبت شد!`;
        }
        break;
      }

      case CB.ALERT_CLEAR: {
        await clearAlerts(query.message.chat.id);
        const snapshot = await refresh();
        const current = Math.round(snapshot.stats.median);
        await edit(query, alertMenuMessage(current, []), alertInteractiveKeyboard(current, []));
        toast = '🗑 همه هشدارها حذف شد';
        break;
      }

      case CB.ALERT_DEL: {
        if (arg) {
          await removeAlert(Number(arg), query.message.chat.id);
          toast = '🗑 هشدار حذف شد';
        }
        const alerts = await listAlerts(query.message.chat.id);
        await edit(query, alertListMessage(alerts), alertListKeyboard(alerts));
        break;
      }

      case CB.SETTINGS: {
        await edit(query, settingsMessage(false), settingsKeyboard(false));
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

      case CB.WIDGET: {
        const market = await getMarketOverview();
        const sent = await sendMarketWidget(query.message.chat.id, market);
        toast = sent ? 'تابلوی بازار ارسال شد 📱' : 'تابلوی بازار فعال شد';
        if (!sent) {
          await edit(query, marketOverviewCard(market), marketKeyboard('market'));
        }
        break;
      }

      case CB.CRYPTO: {
        const market = await getMarketOverview();
        await edit(query, cryptoCard(market), marketKeyboard('crypto'));
        toast = 'ارزهای دیجیتال';
        break;
      }

      case CB.GOLD: {
        const market = await getMarketOverview();
        await edit(query, goldCard(market), marketKeyboard('gold'));
        toast = 'طلا و سکه';
        break;
      }

      case CB.FIAT: {
        const market = await getMarketOverview();
        await edit(query, fiatCard(market), marketKeyboard('fiat'));
        toast = 'ارز و دلار';
        break;
      }

      case CB.MARKET: {
        const market = await getMarketOverview();
        await edit(query, marketOverviewCard(market), marketKeyboard('market'));
        toast = 'خلاصه بازار';
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
