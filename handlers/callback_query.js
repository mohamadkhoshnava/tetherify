// handlers/callback_query.js — the inline keyboard buttons.
//
// Buttons edit the message in place rather than sending a new one, so a chat
// does not fill up with near-identical price cards.

import { api } from 'sdk';
import { CB, BRAND } from 'lib/config';
import { refresh } from 'lib/prices';
import { getMarketOverview } from 'lib/market';
import { sendMarketWidget } from 'lib/widget';
import { sendRichMarketCard, editRichMarketCard } from 'lib/rich';
import { faNum } from 'lib/fa';
import {
  priceCard, listMessage, topMessage, excludedMessage, avgMessage, chartMessage,
  helpMessage, startMessage, cryptoCard, goldCard, fiatCard, marketOverviewCard,
  alertMenuMessage, alertListMessage, settingsMessage,
} from 'lib/format';
import {
  mainKeyboard, listKeyboard, backKeyboard, subscribeKeyboard, marketKeyboard,
  priceKeyboard, alertInteractiveKeyboard, alertListKeyboard, settingsKeyboard, widgetKeyboard, richCardKeyboard,
} from 'lib/keyboard';
import {
  getDay, recentDays, setSubscribed, isAdmin, touchChat,
  addAlert, listAlerts, removeAlert, clearAlerts,
} from 'lib/store';
import { isMember, gateEnabled, gateTarget, gatePrompt, forgetMembership } from 'lib/gate';

async function edit(query, text, markup) {
  const msg = query.message;
  if (msg.widget || (!msg.text && !msg.rich_message)) {
    return api.sendMessage({
      chat_id: msg.chat.id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: markup,
    });
  }
  try {
    await api.editMessageText({
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: markup,
    });
  } catch (err) {
    // 400 "message is not modified" just means the price has not moved.
    const desc = String(err && err.description || '');
    if (desc.includes('message is not modified')) return;
    if (!err || err.code !== 400) throw err;
    return api.sendMessage({
      chat_id: msg.chat.id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: markup,
    });
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
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, { tab: 'market', reply_markup: richCardKeyboard(market, 'market') });
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

      case CB.REFRESH: {
        const market = await getMarketOverview();
        const sent = await editRichMarketCard(query, market, {
          tab: 'tether',
          timeframe: '7d',
          reply_markup: richCardKeyboard(market, 'tether'),
        });
        toast = sent ? 'تتر به‌روزرسانی شد 🔄' : '';
        break;
      }

      case CB.TF_24H: {
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, {
          tab: 'tether',
          timeframe: '24h',
          reply_markup: richCardKeyboard(market, 'tether'),
        });
        toast = 'نمای ۲۴ ساعته ⏰';
        break;
      }

      case CB.TF_7D: {
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, {
          tab: 'tether',
          timeframe: '7d',
          reply_markup: richCardKeyboard(market, 'tether'),
        });
        toast = 'نمای ۷ روزه 📊';
        break;
      }

      case CB.HOME:
      case CB.WIDGET:
      case CB.MARKET: {
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, {
          tab: 'market',
          reply_markup: richCardKeyboard(market, 'market'),
        });
        toast = 'تابلوی بازار 📊';
        break;
      }

      case CB.CRYPTO: {
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, {
          tab: 'crypto',
          reply_markup: richCardKeyboard(market, 'crypto'),
        });
        toast = 'ارزهای دیجیتال 💎';
        break;
      }

      case CB.GOLD: {
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, {
          tab: 'gold',
          reply_markup: richCardKeyboard(market, 'gold'),
        });
        toast = 'طلا و سکه 🪙';
        break;
      }

      case CB.FIAT: {
        const market = await getMarketOverview();
        await editRichMarketCard(query, market, {
          tab: 'fiat',
          reply_markup: richCardKeyboard(market, 'fiat'),
        });
        toast = 'دلار و ارز 💵';
        break;
      }

      case CB.TOUCH: {
        const market = await getMarketOverview();
        const sent = await sendMarketWidget(query.message.chat.id, market, {
          initialTab: 'market',
          caption: '📱 <b>تابلوی لمسی و تعاملی تتریفای</b>',
          reply_markup: widgetKeyboard('market'),
        });
        toast = sent ? 'تابلوی لمسی 📱' : 'خطا در باز کردن تابلو';
        break;
      }

      case CB.CALC: {
        const market = await getMarketOverview();
        const sent = await sendMarketWidget(query.message.chat.id, market, {
          initialTab: 'calc',
          caption: '🧮 <b>ماشین‌حساب و محاسبه‌گر هوشمند تتر</b>',
          reply_markup: widgetKeyboard('market'),
        });
        toast = sent ? 'ماشین‌حساب 🧮' : '';
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

      case CB.SUB: {
        const on = arg === '1';
        await setSubscribed(query.message.chat.id, on);
        toast = on ? 'گزارش روزانه فعال شد' : 'گزارش روزانه غیرفعال شد';
        await edit(query, settingsMessage(on), settingsKeyboard(on));
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
