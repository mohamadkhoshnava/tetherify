// handlers/inline_query.js — inline mode: "@bot" from inside any chat.
//
// Offers instant price cards for Tether, Cryptocurrencies, Gold & Coins,
// and Currencies, with filter support.

import { api } from 'sdk';
import { getMarketOverview } from 'lib/market';
import { buildWidgetHtml, compactPayload } from 'lib/widget';
import {
  priceCard, topMessage, excludedMessage,
  cryptoCard, goldCard, fiatCard, marketOverviewCard,
} from 'lib/format';
import { faNum, faPct, esc, toFaDigits } from 'lib/fa';
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

  const q = (query.query || '').trim().toLowerCase();
  let results = [];

  try {
    const market = await getMarketOverview();
    const tetherSnapshot = market.tether;
    const s = tetherSnapshot && tetherSnapshot.stats;

    // Search / filter mode
    if (q) {
      // 1. Search in cryptos
      const matchedCryptos = (market.crypto || []).filter(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.nameFa.includes(q),
      );

      for (let i = 0; i < matchedCryptos.length; i++) {
        const c = matchedCryptos[i];
        const chStr = faPct(c.change24h || 0);
        const arrow = (c.change24h || 0) >= 0 ? '🟢' : '🔴';
        const usd = c.usdPrice < 1 ? c.usdPrice.toFixed(4) : faNum(c.usdPrice);
        const text =
          `${c.icon || '🪙'} <b>${esc(c.nameFa)} (${c.symbol})</b>\n\n` +
          `💵 قیمت جهانی: <b>$${toFaDigits(usd)}</b>\n` +
          `🇮🇷 معادل تومانی: <b>${faNum(c.tomanPrice)}</b> تومان\n` +
          `${arrow} تغییر ۲۴ ساعت: <b>${chStr}</b>\n\n` +
          `<i>${BRAND}</i>`;

        results.push(
          article(
            `c_${c.symbol}`,
            `${c.icon || '🪙'} ${c.nameFa} (${c.symbol})`,
            `$${usd} · ${faNum(c.tomanPrice)} تومان (${chStr})`,
            text,
          ),
        );
      }

      // 2. Search in Gold & Coins
      const matchedGold = (market.gold || []).filter(
        (g) => g.key.toLowerCase().includes(q) || g.nameFa.includes(q),
      );

      for (let i = 0; i < matchedGold.length; i++) {
        const g = matchedGold[i];
        const chStr = faPct(g.changePct || 0);
        const unit = g.key === 'ons' ? 'دلار' : 'تومان';
        const text =
          `🪙 <b>${esc(g.nameFa)}</b>\n\n` +
          `💰 قیمت: <b>${faNum(g.price)}</b> ${unit}\n` +
          `📊 تغییر: <b>${chStr}</b>\n\n` +
          `<i>${BRAND}</i>`;

        results.push(
          article(
            `g_${g.key}`,
            `🪙 ${g.nameFa}`,
            `${faNum(g.price)} ${unit} (${chStr})`,
            text,
          ),
        );
      }

      // 3. Search in Currencies
      const matchedFiat = (market.fiat || []).filter(
        (f) => f.key.toLowerCase().includes(q) || f.nameFa.includes(q),
      );

      for (let i = 0; i < matchedFiat.length; i++) {
        const f = matchedFiat[i];
        const chStr = faPct(f.changePct || 0);
        const text =
          `💵 <b>${esc(f.nameFa)}</b>\n\n` +
          `💰 قیمت: <b>${faNum(f.price)}</b> تومان\n` +
          `📊 نوسان: <b>${chStr}</b>\n\n` +
          `<i>${BRAND}</i>`;

        results.push(
          article(
            `f_${f.key}`,
            `💵 ${f.nameFa}`,
            `${faNum(f.price)} تومان (${chStr})`,
            text,
          ),
        );
      }

      // 4. Search in Tether exchanges
      if (tetherSnapshot && tetherSnapshot.rows) {
        const matchedExchanges = tetherSnapshot.rows
          .filter((r) => r.name.toLowerCase().includes(q) || r.name.includes(q))
          .sort((a, b) => (b.askOk ? 1 : 0) - (a.askOk ? 1 : 0) || a.ask - b.ask)
          .slice(0, 10);

        for (let i = 0; i < matchedExchanges.length; i++) {
          const r = matchedExchanges[i];
          const bad = !r.askOk;
          const reason = bad ? (FLAG_LABEL[r.flags.find((f) => f !== FLAG.UNIT)] || 'نامعتبر') : null;
          const body = bad
            ? `⚠️ <b>${esc(r.name)}</b>\n\nقیمت اعلامی: ${faNum(r.ask)} تومان\n` +
              `<i>این نرخ معتبر شمرده نشد: ${esc(reason)}</i>\n\n${BRAND}`
            : `🏦 <b>${esc(r.name)}</b>\n\n` +
              `🟢 خرید: <b>${faNum(r.ask)}</b> تومان\n` +
              (r.bidOk ? `🔴 فروش: <b>${faNum(r.bid)}</b> تومان\n` : '') +
              `📊 نسبت به میانه بازار: ${faPct(r.devPct || 0)}\n\n${BRAND}`;

          results.push(
            article(
              `x_${i}`,
              `${bad ? '⚠️ ' : ''}${r.name}`,
              bad ? `نامعتبر — ${reason}` : `خرید ${faNum(r.ask)} تومان`,
              body,
            ),
          );
        }
      }
    }

    // Default overview list when query is empty or no matches
    if (!results.length) {
      results = [
        article(
          'overview',
          '📊 تابلوی جامع بازارهای مالی',
          `تتر ${faNum(market.usdtMedian)} · طلا، سکه، دلار و کریپتو`,
          marketOverviewCard(market),
        ),
        article(
          'crypto',
          '💎 قیمت ارزهای دیجیتال (Crypto)',
          'بیت‌کوین، اتریوم، تون‌کوین، سولانا، دوج‌کوین و ...',
          cryptoCard(market),
        ),
        article(
          'gold',
          '🪙 قیمت طلا و انواع سکه',
          'طلای ۱۸ عیار، مثقال، انس، سکه امامی، بهار، نیم و ربع',
          goldCard(market),
        ),
        article(
          'fiat',
          '💵 قیمت ارز و اسکناس (بازار آزاد)',
          'دلار، یورو، درهم، پوند، لیر، کانادا، استرالیا',
          fiatCard(market),
        ),
      ];

      if (tetherSnapshot && s && s.ok) {
        results.push(
          article(
            'tether_summary',
            '₮ خلاصه بازار تتر (صرافی‌های ایرانی)',
            `${faNum(s.bestBuy)} تا ${faNum(s.maxAsk)} تومان · ${faNum(s.count)} صرافی معتبر`,
            priceCard(tetherSnapshot),
          ),
          article(
            'top_exchanges',
            '🏆 بهترین صرافی‌های خرید و فروش تتر',
            'پنج صرافی برتر خرید و فروش',
            topMessage(tetherSnapshot),
          ),
        );
      }
    }
  } catch (err) {
    console.error('inline_query failed:', err && err.message);
    results = [article('err', 'خطا', 'دریافت قیمت ناموفق بود', '⚠️ دریافت قیمت ناموفق بود.')];
  }

  try {
    await api.answerInlineQuery({
      inline_query_id: query.id,
      results: results.slice(0, 30),
      cache_time: 30,
      is_personal: false,
      button: { text: '💎 باز کردن ربات تتریفای', start_parameter: 'inline' },
    });
  } catch (err) {
    console.warn('answerInlineQuery failed:', err && err.description);
  }
}
