// handlers/inline_query.js — inline mode: "@bot" from inside any chat.
//
// Typing a query filters to matching exchanges, so `@bot نوبیتکس` offers that
// exchange's quote directly. An empty query offers the market summary.

import { api } from 'sdk';
import { getSnapshot } from 'lib/prices';
import { priceCard, topMessage, excludedMessage } from 'lib/format';
import { faNum, faPct, esc } from 'lib/fa';
import { BRAND } from 'lib/config';
import { FLAG_LABEL, FLAG } from 'lib/quality';

const article = (id, title, description, text) => ({
  type: 'article',
  id,
  title,
  description,
  input_message_content: {
    message_text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  },
});

export default async function (query) {
  if (!query) return;

  const q = (query.query || '').trim();
  let results = [];

  try {
    const snapshot = await getSnapshot();
    const s = snapshot.stats;

    if (!s.ok) {
      results = [article('err', 'داده کافی نیست', 'قیمت معتبری در دسترس نیست',
        `⚠️ فعلاً قیمت معتبری در دسترس نیست.`)];
    } else if (q) {
      // Filter mode: match the query against exchange names.
      const matches = snapshot.rows
        .filter((r) => r.name.includes(q))
        .sort((a, b) => (b.askOk ? 1 : 0) - (a.askOk ? 1 : 0) || a.ask - b.ask)
        .slice(0, 20);

      results = matches.map((r, i) => {
        const bad = !r.askOk;
        const reason = bad ? (FLAG_LABEL[r.flags.find((f) => f !== FLAG.UNIT)] || 'نامعتبر') : null;
        const body = bad
          ? `⚠️ <b>${esc(r.name)}</b>\n\nقیمت اعلامی: ${faNum(r.ask)} تومان\n` +
            `<i>این نرخ معتبر شمرده نشد: ${esc(reason)}</i>\n\n${BRAND}`
          : `🏦 <b>${esc(r.name)}</b>\n\n` +
            `🟢 خرید: <b>${faNum(r.ask)}</b> تومان\n` +
            (r.bidOk ? `🔴 فروش: <b>${faNum(r.bid)}</b> تومان\n` : '') +
            `📊 نسبت به میانه بازار: ${faPct(r.devPct || 0)}\n\n${BRAND}`;

        return article(
          `x${i}`,
          `${bad ? '⚠️ ' : ''}${r.name}`,
          bad ? `نامعتبر — ${reason}` : `خرید ${faNum(r.ask)} تومان`,
          body,
        );
      });
    }

    if (!results.length) {
      results = [
        article('summary', '💵 خلاصه بازار تتر',
          `${faNum(s.bestBuy)} تا ${faNum(s.maxAsk)} تومان · ${faNum(s.count)} صرافی معتبر`,
          priceCard(snapshot)),

        article('buy', '🟢 ارزان‌ترین قیمت خرید',
          `${faNum(s.bestBuy)} تومان — ${s.bestBuyName}`,
          `🟢 <b>ارزان‌ترین خرید تتر</b>\n\n<b>${faNum(s.bestBuy)}</b> تومان\n` +
          `🏦 ${esc(s.bestBuyName)}\n\n<i>از ${faNum(s.count)} صرافی معتبر</i>\n${BRAND}`),

        article('sell', '🔴 بهترین قیمت فروش',
          `${faNum(s.bestSell)} تومان — ${s.bestSellName}`,
          `🔴 <b>بهترین قیمت فروش تتر</b>\n\n<b>${faNum(s.bestSell)}</b> تومان\n` +
          `🏦 ${esc(s.bestSellName)}\n\n<i>از ${faNum(s.count)} صرافی معتبر</i>\n${BRAND}`),

        article('avg', '⚖️ میانگین بازار',
          `${faNum(s.avg)} تومان · میانه ${faNum(s.median)}`,
          `⚖️ <b>میانگین بازار تتر</b>\n\nمیانگین: <b>${faNum(s.avg)}</b> تومان\n` +
          `میانه: ${faNum(s.median)} تومان\nبازه: ${faNum(s.minAsk)} تا ${faNum(s.maxAsk)}\n\n` +
          `<i>${faNum(s.count)} صرافی معتبر — ${faNum(s.rejectedCount)} مورد خطادار حذف شد</i>\n${BRAND}`),

        article('top', '🏆 بهترین صرافی‌ها',
          'پنج صرافی برتر خرید و فروش', topMessage(snapshot)),

        article('excluded', '🧹 قیمت‌های حذف‌شده',
          `${faNum(s.rejectedCount)} مورد کنار گذاشته شد`, excludedMessage(snapshot)),
      ];
    }
  } catch (err) {
    console.error('inline_query failed:', err && err.message);
    results = [article('err', 'خطا', 'دریافت قیمت ناموفق بود', '⚠️ دریافت قیمت ناموفق بود.')];
  }

  try {
    await api.answerInlineQuery({
      inline_query_id: query.id,
      results,
      cache_time: 45,
      is_personal: false,
      button: { text: 'باز کردن ربات و دیدن گزارش کامل', start_parameter: 'inline' },
    });
  } catch (err) {
    console.warn('answerInlineQuery failed:', err && err.description);
  }
}
