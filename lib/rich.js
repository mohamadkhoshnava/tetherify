// lib/rich.js — Forwardable, copyable RichMessage cards (Bot API 10.4).
//
// Why sendRichMessage for primary market cards:
//   Telegram production forces has_protected_content=true on sendWidget and
//   sendSharedWidget, which blocks forwarding and copy-text. sendRichMessage
//   renders native tables, embedded charts, and <tg-button-row> pill buttons
//   inside the message while keeping Forward and Copy Text enabled in all chats.
//   The interactive HTML Touch Board (lib/widget.js) remains one tap away.

import { api } from 'sdk';
import { CB, BRAND, CHANNEL_ID, BOT_USERNAME } from 'lib/config';
import { EMOJI, EMOJI_ID } from 'lib/emoji';
import { esc, faNum, faPct, toFaDigits, tehran } from 'lib/fa';
import { recentDays, samplesForDay } from 'lib/store';

function btn(label, data, { style = '', emojiId = '' } = {}) {
  const styleAttr = style ? ` style="${style}"` : '';
  const icon = emojiId ? `<tg-emoji emoji-id="${emojiId}">🔹</tg-emoji> ` : '';
  return `<tg-button type="callback_data"${styleAttr} data="${esc(data)}">${icon}${esc(label)}</tg-button>`;
}

function pctText(pct) {
  if (pct == null || isNaN(pct)) return '۰٪';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${toFaDigits(Number(pct).toFixed(2))}٪`;
}

function changeBadge(pct) {
  if (pct == null || isNaN(pct) || Math.abs(pct) < 0.01) return '▫️ ۰٪';
  const icon = pct > 0 ? EMOJI.CHART_UP : EMOJI.CHART_DOWN;
  return `${icon} ${pctText(pct)}`;
}

/** Build a clean dark-theme QuickChart PNG URL (strictly ASCII labels to avoid missing-glyph boxes). */
function buildChartUrl(values, { titleLeft = 'USDT · TETHERIFY', subtitle = '7D · TOMAN', lastPrice = 0, changePct = null } = {}) {
  if (!Array.isArray(values) || values.length < 2) return null;

  const isDown = changePct != null ? changePct < 0 : values[values.length - 1] < values[0];
  const color = isDown ? '#ef4444' : '#22c55e';
  const fill = isDown ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.16)';

  const pctStr = changePct != null
    ? `${changePct >= 0 ? '+' : ''}${Number(changePct).toFixed(2)}%`
    : (() => {
        const base = values[0];
        if (!base) return '';
        const diff = ((values[values.length - 1] - base) / base) * 100;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
      })();

  const priceStr = lastPrice >= 1000
    ? `${(lastPrice / 1000).toFixed(1)}K`
    : String(Math.round(lastPrice));

  const titleText = `${titleLeft}   ${subtitle}   ${pctStr ? `${pctStr} · ` : ''}${priceStr}`;

  const cfg = {
    type: 'line',
    data: {
      labels: values.map((_, i) => String(i + 1)),
      datasets: [{
        data: values.map((v) => Math.round(v)),
        borderColor: color,
        backgroundColor: fill,
        borderWidth: 3,
        fill: true,
        tension: 0.32,
        pointRadius: values.map((_, i) => (i === values.length - 1 ? 4 : 0)),
        pointBackgroundColor: color,
      }],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: titleText,
        fontColor: isDown ? '#f87171' : '#4ade80',
        fontSize: 13,
        padding: 10,
      },
      layout: { padding: { left: 8, right: 12, top: 2, bottom: 8 } },
      scales: {
        xAxes: [{ display: false }],
        yAxes: [{
          gridLines: { color: 'rgba(148,163,184,0.14)', zeroLineColor: 'rgba(148,163,184,0.2)' },
          ticks: {
            fontColor: '#94a3b8',
            fontSize: 11,
            maxTicksLimit: 5,
          },
        }],
      },
    },
  };

  return `https://quickchart.io/chart?w=720&h=320&bkg=%230e1726&f=png&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

/** Collect 24h or 7d numeric series for the chart from stored DB history. */
async function loadChartSeries(market, timeframe = '7d') {
  const s = market?.tether?.stats;
  const median = Math.round(market?.usdtMedian || s?.median || 0);
  if (!median) return [];

  try {
    if (timeframe === '24h') {
      const todayDay = market?.tehranNow?.day || tehran().day;
      const rows = await samplesForDay(todayDay);
      let vals = (rows || []).map((r) => Math.round(r.avg)).filter((v) => v > 0);
      if (vals.length >= 2) {
        if (vals[vals.length - 1] !== median) vals.push(median);
        return vals.slice(-16);
      }
    }

    const days = await recentDays(7);
    let vals = (days || []).map((d) => Math.round(d.close || d.avg)).filter((v) => v > 0);
    if (vals.length >= 2) {
      if (vals[vals.length - 1] !== median) vals.push(median);
      return vals;
    }
  } catch (err) {
    console.warn('chart history load skipped:', err && err.message);
  }

  // Fallback curve anchored on real intraday min/max/median so new installs still get a valid chart.
  if (s && s.ok && s.minAsk > 0 && s.maxAsk > 0) {
    return [
      Math.round((s.minAsk + median) / 2),
      Math.round(s.minAsk),
      Math.round(s.avg || median),
      Math.round(s.maxAsk),
      median,
    ];
  }
  return [];
}

function marketTabsRows(activeTab) {
  return (
    `<tg-button-row align="center">` +
      btn('تابلوی بازار', CB.MARKET, { emojiId: EMOJI_ID.BAR_CHART, style: activeTab === 'market' ? 'primary' : '' }) +
      btn('تتر (USDT)', CB.REFRESH, { emojiId: EMOJI_ID.EXCHANGE, style: activeTab === 'tether' ? 'primary' : '' }) +
    `</tg-button-row>` +
    `<tg-button-row align="center">` +
      btn('کریپتو', CB.CRYPTO, { emojiId: EMOJI_ID.DIAMOND, style: activeTab === 'crypto' ? 'primary' : '' }) +
      btn('طلا و سکه', CB.GOLD, { emojiId: EMOJI_ID.COIN, style: activeTab === 'gold' ? 'primary' : '' }) +
      btn('دلار و ارز', CB.FIAT, { emojiId: EMOJI_ID.DOLLAR, style: activeTab === 'fiat' ? 'primary' : '' }) +
    `</tg-button-row>`
  );
}

function footerLine(market) {
  const t = market?.tehranNow || tehran();
  const hhmm = `${toFaDigits(String(t.hour).padStart(2, '0'))}:${toFaDigits(String(t.minute).padStart(2, '0'))}`;
  const chan = CHANNEL_ID.startsWith('@') ? CHANNEL_ID : `@${BOT_USERNAME}`;
  return `<footer>${esc(chan)} · بروزرسانی ${esc(t.dateFa)} · ساعت ${hhmm}</footer>`;
}

/** Build the RichMessage HTML + bottom metadata for each market view. */
export async function buildRichMarketHtml(market, {
  tab = 'market',
  timeframe = '7d',
  welcome = false,
  includeChart = true,
  interactive = true,
} = {}) {
  const s = market?.tether?.stats;
  const usdt = Math.round(market?.usdtMedian || s?.median || 0);
  const series = includeChart ? await loadChartSeries(market, timeframe) : [];

  if (tab === 'tether' && s && s.ok) {
    const spread = Math.round(s.bestSell - s.bestBuy);
    const spreadPct = s.bestBuy > 0 ? (spread / s.bestBuy) * 100 : 0;
    const base = series.length >= 2 ? series[0] : s.median;
    const diff = s.median - base;
    const diffPct = base > 0 ? (diff / base) * 100 : 0;

    const chartUrl = includeChart
      ? buildChartUrl(series, {
          titleLeft: 'USDT · TETHER',
          subtitle: timeframe === '24h' ? '24H · TOMAN' : '7D · TOMAN',
          lastPrice: s.median,
          changePct: diffPct,
        })
      : null;

    const rows = [
      `<tr><td>خرید (ارزان‌ترین)</td><td align="left"><b>${faNum(Math.round(s.bestBuy))} ت</b> (${esc(s.bestBuyName)})</td></tr>`,
      `<tr><td>فروش (بهترین)</td><td align="left"><b>${faNum(Math.round(s.bestSell))} ت</b> (${esc(s.bestSellName)})</td></tr>`,
      `<tr><td>سقف معتبر</td><td align="left">${faNum(Math.round(s.maxAsk))} تومان</td></tr>`,
      `<tr><td>کف معتبر</td><td align="left">${faNum(Math.round(s.minAsk))} تومان</td></tr>`,
      `<tr><td>میانه بازار</td><td align="left"><b>${faNum(Math.round(s.median))} تومان</b></td></tr>`,
      `<tr><td>فرصت آربیتراژ</td><td align="left">${faNum(spread)} ت (${faPct(spreadPct, 2)})</td></tr>`,
      `<tr><td>پالایش صرافی‌ها</td><td align="left">${toFaDigits(s.count)} مجاز · ${toFaDigits(s.rejectedCount)} حذف</td></tr>`,
    ].join('');

    const tfLabel = timeframe === '24h' ? 'نمای ۲۴ ساعته' : 'نمای ۷ روزه';
    const buttons = interactive
      ? `<tg-button-row align="center">` +
          btn('۲۴ ساعته', CB.TF_24H, { emojiId: EMOJI_ID.WATCH, style: timeframe === '24h' ? 'primary' : '' }) +
          btn('۷ روزه', CB.TF_7D, { emojiId: EMOJI_ID.BAR_CHART, style: timeframe === '7d' ? 'primary' : '' }) +
        `</tg-button-row>` +
        `<tg-button-row align="center">` +
          btn('صرافی‌ها', `${CB.LIST}:0`, { emojiId: EMOJI_ID.BANK }) +
          btn('تنظیم هشدار', CB.ALERT_MENU, { emojiId: EMOJI_ID.TARGET }) +
        `</tg-button-row>`
      : '';

    return (
      `<h3>${EMOJI.BAG} تتر ایران · Tether USDT</h3>` +
      `<p>$USDT · <i>${tfLabel}</i><br/>` +
      `${EMOJI.DOLLAR} <b>${faNum(Math.round(s.median))}</b> تومان · ${changeBadge(diffPct)}</p>` +
      (chartUrl ? `<img src="${esc(chartUrl)}"/>` : '') +
      `<table striped compact>${rows}</table>` +
      buttons +
      footerLine(market)
    );
  }

  if (tab === 'crypto') {
    const list = (market?.crypto || []).slice(0, 8);
    const rows = list.map((c) => {
      const usd = c.symbol === 'USDT'
        ? '$1.00'
        : `$${c.usdPrice >= 100 ? faNum(Math.round(c.usdPrice)) : toFaDigits(Number(c.usdPrice).toFixed(2))}`;
      const chg = c.symbol === 'USDT' ? '—' : pctText(c.change24h);
      return `<tr><td><b>${esc(c.nameFa)}</b> (${esc(c.symbol)})</td><td align="left"><b>${faNum(c.tomanPrice)} ت</b> · ${esc(usd)} (${chg})</td></tr>`;
    }).join('');

    return (
      `<h3>${EMOJI.DIAMOND} رمزارزهای بازار</h3>` +
      `<p>$BTC $ETH $TON $SOL · نرخ تومانی بر مبنای تتر پالایش‌شده (${faNum(usdt)} تومان)</p>` +
      `<table striped compact>${rows}</table>` +
      marketTabsRows('crypto') +
      footerLine(market)
    );
  }

  if (tab === 'gold') {
    const list = (market?.gold || []).slice(0, 8);
    const rows = list.map((g) => {
      const val = g.key === 'ons' ? `$${faNum(Math.round(g.price))}` : `${faNum(g.price)} ت`;
      return `<tr><td><b>${esc(g.nameFa)}</b></td><td align="left"><b>${val}</b> (${pctText(g.changePct)})</td></tr>`;
    }).join('');

    return (
      `<h3>${EMOJI.COIN} طلا و سکه</h3>` +
      `<p>#طلا #سکه · نرخ لحظه‌ای بازار داخلی و انس جهانی</p>` +
      `<table striped compact>${rows}</table>` +
      marketTabsRows('gold') +
      footerLine(market)
    );
  }

  if (tab === 'fiat') {
    const list = (market?.fiat || []).slice(0, 8);
    const rows = list.map((f) =>
      `<tr><td><b>${esc(f.nameFa)}</b></td><td align="left"><b>${faNum(f.price)} ت</b> (${pctText(f.changePct)})</td></tr>`
    ).join('');

    return (
      `<h3>${EMOJI.DOLLAR} دلار و ارزهای آزاد</h3>` +
      `<p>$USD $EUR #ارز · مظنه لحظه‌ای اسکناس بازار آزاد</p>` +
      `<table striped compact>${rows}</table>` +
      marketTabsRows('fiat') +
      footerLine(market)
    );
  }

  // Default: 'market' overview (and '/start' welcome mode)
  const findGold = (k) => (market?.gold || []).find((g) => g.key === k);
  const findFiat = (k) => (market?.fiat || []).find((f) => f.key === k);
  const findCrypto = (sym) => (market?.crypto || []).find((c) => c.symbol === sym);

  const usdFree = findFiat('price_dollar_rl');
  const eurFree = findFiat('price_eur');
  const gold18 = findGold('geram18');
  const seke = findGold('sekee');
  const btc = findCrypto('BTC');
  const ton = findCrypto('TON');

  const chartUrl = includeChart
    ? buildChartUrl(series, {
        titleLeft: 'TETHERIFY · USDT',
        subtitle: '7D · TOMAN',
        lastPrice: usdt,
      })
    : null;

  const rows = [
    `<tr><td>${EMOJI.EXCHANGE} تتر (USDT)</td><td align="left"><b>${faNum(usdt)} ت</b></td></tr>`,
    usdFree ? `<tr><td>${EMOJI.DOLLAR} دلار آزاد</td><td align="left"><b>${faNum(usdFree.price)} ت</b> (${pctText(usdFree.changePct)})</td></tr>` : '',
    eurFree ? `<tr><td>${EMOJI.EURO} یورو اروپا</td><td align="left"><b>${faNum(eurFree.price)} ت</b> (${pctText(eurFree.changePct)})</td></tr>` : '',
    gold18 ? `<tr><td>${EMOJI.COIN} طلای ۱۸ عیار</td><td align="left"><b>${faNum(gold18.price)} ت</b> (${pctText(gold18.changePct)})</td></tr>` : '',
    seke ? `<tr><td>${EMOJI.TROPHY} سکه امامی</td><td align="left"><b>${faNum(seke.price)} ت</b> (${pctText(seke.changePct)})</td></tr>` : '',
    btc ? `<tr><td>${EMOJI.DIAMOND} بیت‌کوین ($BTC)</td><td align="left"><b>${faNum(btc.tomanPrice)} ت</b> · $${faNum(Math.round(btc.usdPrice))}</td></tr>` : '',
    ton ? `<tr><td>${EMOJI.ROCKET} تون‌کوین ($TON)</td><td align="left"><b>${faNum(ton.tomanPrice)} ت</b> (${pctText(ton.change24h)})</td></tr>` : '',
  ].filter(Boolean).join('');

  const intro = welcome
    ? `<p>مرجع لحظه‌ای تتر ($USDT)، رمزارزها، طلا، سکه و دلار — پالایش آماری از ~۹۰ صرافی معتبر ایرانی با حذف نرخ‌های پرت.</p>`
    : `<p>$USDT $BTC · تابلوی جامع و زنده بازارهای مالی ${BRAND}</p>`;

  const heading = welcome
    ? `<h3>${EMOJI.STAR} به تابلوی هوشمند تتریفای (${BRAND}) خوش آمدید</h3>`
    : `<h3>${EMOJI.BAR_CHART} تابلوی زنده بازارهای مالی · تتریفای</h3>`;

  return (
    heading +
    intro +
    (chartUrl ? `<img src="${esc(chartUrl)}"/>` : '') +
    `<table striped compact>${rows}</table>` +
    (interactive ? marketTabsRows('market') : '') +
    footerLine(market)
  );
}

/**
 * Send a forwardable RichMessage card.
 * Retries cleanly without chart <img> if Telegram cannot fetch the remote image URL.
 */
export async function sendRichMarketCard(chatId, market, {
  tab = 'market',
  timeframe = '7d',
  welcome = false,
  interactive = true,
  reply_markup = undefined,
} = {}) {
  const html = await buildRichMarketHtml(market, { tab, timeframe, welcome, includeChart: true, interactive });
  const opts = reply_markup ? { reply_markup } : {};

  try {
    return await api.sendRichMessage({
      chat_id: chatId,
      rich_message: { is_rtl: true, html },
      ...opts,
    });
  } catch (err) {
    // Retry without chart image if Telegram rejected remote URL fetch
    if (err && err.code === 400 && html.includes('<img ')) {
      try {
        const htmlNoImg = await buildRichMarketHtml(market, { tab, timeframe, welcome, includeChart: false, interactive });
        return await api.sendRichMessage({
          chat_id: chatId,
          rich_message: { is_rtl: true, html: htmlNoImg },
          ...opts,
        });
      } catch (retryErr) {
        console.error('sendRichMessage retry failed:', retryErr && (retryErr.description || retryErr.message));
      }
    } else {
      console.error('sendRichMessage failed:', err && (err.description || err.message));
    }
    return null;
  }
}

/**
 * Edit an existing RichMessage in place (or send a new one if triggered from an HTML widget).
 */
export async function editRichMarketCard(query, market, {
  tab = 'market',
  timeframe = '7d',
  reply_markup = undefined,
} = {}) {
  const msg = query?.message;
  if (!msg) return null;

  // HTML sendWidget messages cannot be edited into RichMessages; send a fresh card instead.
  if (msg.widget) {
    return sendRichMarketCard(msg.chat.id, market, { tab, timeframe, reply_markup });
  }

  const html = await buildRichMarketHtml(market, { tab, timeframe, welcome: false, includeChart: true });
  const opts = reply_markup ? { reply_markup } : {};

  try {
    return await api.editMessageText({
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      rich_message: { is_rtl: true, html },
      ...opts,
    });
  } catch (err) {
    const desc = String(err?.description || '');
    if (desc.includes('message is not modified')) return msg;
    if (err && err.code === 400 && html.includes('<img ')) {
      try {
        const htmlNoImg = await buildRichMarketHtml(market, { tab, timeframe, welcome: false, includeChart: false });
        return await api.editMessageText({
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          rich_message: { is_rtl: true, html: htmlNoImg },
          ...opts,
        });
      } catch {
        // fall through to send
      }
    }
    return sendRichMarketCard(msg.chat.id, market, { tab, timeframe, reply_markup });
  }
}
