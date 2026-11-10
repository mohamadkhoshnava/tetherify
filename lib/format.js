// lib/format.js — every user-facing message. Telegram HTML parse mode.
//
// Telegram caps a message at 4096 characters, so anything list-shaped paginates.

import { faNum, faPct, faAgo, esc, toFaDigits } from 'lib/fa';
import { FLAG, FLAG_ICON, FLAG_LABEL, rejectionReport } from 'lib/quality';
import { BRAND, SOURCE_NAME, BOT_USERNAME, CHANNEL_ID } from 'lib/config';

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const RULE = '━━━━━━━━━━━━━━━';

function footer(snapshot) {
  const age = snapshot.ageSec < 60 ? 'لحظه‌ای' : faAgo(snapshot.ageSec / 60);
  const warn = snapshot.degraded ? ' ⚠️ <i>منبع در دسترس نیست، آخرین داده سالم</i>' : '';
  return `\n<i>منبع: ${SOURCE_NAME} · به‌روزرسانی: ${esc(age)}</i>${warn}`;
}

function stamp(snapshot) {
  const t = snapshot.tehranNow;
  return `${t.weekday} ${t.jalaliLong} · ساعت ${t.clock}`;
}

/** The main price card. Forwardable, clean, aesthetic, inspired by modern financial bots. */
export function priceCard(snapshot, { timeframe = '24h', today = null, days = [] } = {}) {
  const s = snapshot.stats;
  if (!s.ok) return notEnoughData(snapshot);

  const t = snapshot.tehranNow;
  const price = Math.round(s.median);

  // Timeframe and 24h change
  let changeLine = '';
  if (today && today.samples > 1) {
    const diff = s.avg - today.open;
    const pct = today.open ? (diff / today.open) * 100 : 0;
    const arrow = diff > 0 ? '📈 +' : diff < 0 ? '📉 ' : '➖ ';
    changeLine = `✨ تغییر ۲۴ ساعته · <b>${arrow}${faNum(Math.abs(Math.round(diff)))} (${faPct(pct)})</b>\n`;
  }

  let trendLine = '';
  if (days && days.length >= 2) {
    const avgs = days.map((d) => d.avg);
    const first = avgs[0];
    const last = avgs[avgs.length - 1];
    const weekPct = first ? ((last - first) / first) * 100 : 0;
    trendLine = `🥞 <b>روند ۷ روزه:</b> <code>${sparkline(avgs)}</code> (${faPct(weekPct)})\n`;
  }

  const dayHigh = today && today.max ? today.max : s.maxAsk;
  const dayLow = today && today.min ? today.min : s.minAsk;

  let m = `💰 <b>تتر · Tether USDT</b>\n<code>$USDT</code>\n\n`;
  if (timeframe === '7d' && trendLine) {
    m += trendLine;
  }
  m += `💸 <b>${faNum(price)}</b> تومان\n`;
  if (changeLine) m += changeLine;

  m += `\n${RULE}\n`;
  m += `🟢 خرید (ارزان‌ترین)     <b>${faNum(s.bestBuy)}</b>  <i>(${esc(s.bestBuyName)})</i>\n`;
  m += `🔴 فروش (بهترین)      <b>${faNum(s.bestSell)}</b>  <i>(${esc(s.bestSellName)})</i>\n`;
  m += `🔺 سقف روز               <b>${faNum(dayHigh)}</b>\n`;
  m += `🔻 کف روز                 <b>${faNum(dayLow)}</b>\n`;
  m += `⚖️ میانه بازار              <b>${faNum(s.median)}</b>\n`;

  if (s.bestSell > s.bestBuy) {
    const gain = s.bestSell - s.bestBuy;
    const pct = (gain / s.bestBuy) * 100;
    m += `💡 فرصت آربیتراژ: <b>${faNum(gain)}</b> تومان (${faPct(pct)})\n`;
  }

  m += `${RULE}\n`;
  m += `✅ پالایش بین <b>${faNum(s.count)}</b> صرافی مجاز`;
  if (s.rejectedCount) m += ` · 🧹 <b>${faNum(s.rejectedCount)}</b> نرخ نامعتبر حذف شد`;
  m += `\n⏰ ${esc(stamp(snapshot))}`;
  return m;
}

/** Comprehensive Crypto Market Card. */
export function cryptoCard(market) {
  const t = market.tehranNow;
  const timeStr = `${t.weekday} ${t.jalaliLong} · ساعت ${t.clock}`;

  let m = `💎 <b>قیمت روز ارزهای دیجیتال (Crypto)</b>\n`;
  m += `🗓 ${esc(timeStr)}\n`;
  m += `${RULE}\n`;

  for (const c of market.crypto || []) {
    const ch = c.change24h || 0;
    const chStr = faPct(ch);
    const arrow = ch > 0 ? '🟢' : ch < 0 ? '🔴' : '⚪';
    const usd = c.usdPrice < 1 ? c.usdPrice.toFixed(4) : faNum(c.usdPrice);

    m += `${c.icon || '🪙'} <b>${esc(c.nameFa)} (${c.symbol})</b>\n`;
    m += `    💵 قیمت جهانی: <b>$${toFaDigits(usd)}</b>\n`;
    m += `    🇮🇷 معادل تومانی: <b>${faNum(c.tomanPrice)}</b> تومان\n`;
    m += `    ${arrow} تغییر ۲۴ ساعت: <b>${chStr}</b>\n\n`;
  }

  m += `${RULE}\n`;
  m += `<i>💡 معادل تومانی بر مبنای نرخ لحظه‌ای تتر (${faNum(market.usdtMedian)} تومان) محاسبه شده است.</i>`;
  return m;
}

/** Gold and Coins Card. */
export function goldCard(market) {
  const t = market.tehranNow;
  const timeStr = `${t.weekday} ${t.jalaliLong} · ساعت ${t.clock}`;

  let m = `🪙 <b>قیمت روز طلا و انواع سکه</b>\n`;
  m += `🗓 ${esc(timeStr)}\n`;
  m += `${RULE}\n`;

  for (const g of market.gold || []) {
    const ch = g.changePct || 0;
    const chStr = faPct(ch);
    const arrow = ch > 0 ? '🟢' : ch < 0 ? '🔴' : '⚪';
    const unit = g.key === 'ons' ? 'دلار' : 'تومان';

    m += `🔸 <b>${esc(g.nameFa)}:</b> <b>${faNum(g.price)}</b> ${unit}\n`;
    m += `    ${arrow} تغییر روز: <b>${chStr}</b>\n\n`;
  }

  m += `${RULE}\n`;
  m += `<i>منبع: بازار طلا و جواهر تهران / انس جهانی</i>`;
  return m;
}

/** Fiat Currencies Card. */
export function fiatCard(market) {
  const t = market.tehranNow;
  const timeStr = `${t.weekday} ${t.jalaliLong} · ساعت ${t.clock}`;

  let m = `💵 <b>قیمت روز ارز و اسکناس (بازار آزاد)</b>\n`;
  m += `🗓 ${esc(timeStr)}\n`;
  m += `${RULE}\n`;

  for (const f of market.fiat || []) {
    const ch = f.changePct || 0;
    const chStr = faPct(ch);
    const arrow = ch > 0 ? '🟢' : ch < 0 ? '🔴' : '⚪';

    m += `🔹 <b>${esc(f.nameFa)}:</b> <b>${faNum(f.price)}</b> تومان\n`;
    m += `    ${arrow} نوسان روز: <b>${chStr}</b>\n\n`;
  }

  m += `${RULE}\n`;
  m += `<i>منبع: بازار آزاد ارز تهران</i>`;
  return m;
}

/** Market Overview Dashboard Card. */
export function marketOverviewCard(market) {
  const t = market.tehranNow;
  const timeStr = `${t.weekday} ${t.jalaliLong} · ساعت ${t.clock}`;

  let m = `📊 <b>تابلوی جامع بازارهای مالی</b>\n`;
  m += `🗓 ${esc(timeStr)}\n`;
  m += `${RULE}\n`;

  // Tether
  m += `₮ <b>تتر:</b> <b>${faNum(market.usdtMedian)}</b> تومان\n`;

  // Dollar
  const usd = (market.fiat || []).find((f) => f.key === 'price_dollar_rl');
  if (usd) m += `💵 <b>دلار آزاد:</b> <b>${faNum(usd.price)}</b> تومان (${faPct(usd.changePct)})\n`;

  // Gold 18k
  const g18 = (market.gold || []).find((g) => g.key === 'geram18');
  if (g18) m += `🪙 <b>طلای ۱۸ عیار:</b> <b>${faNum(g18.price)}</b> تومان (${faPct(g18.changePct)})\n`;

  // Emami Coin
  const sek = (market.gold || []).find((g) => g.key === 'sekee');
  if (sek) m += `🟡 <b>سکه امامی:</b> <b>${faNum(sek.price)}</b> تومان (${faPct(sek.changePct)})\n`;

  // Bitcoin
  const btc = (market.crypto || []).find((c) => c.symbol === 'BTC');
  if (btc) m += `₿ <b>بیت‌کوین:</b> <b>$${toFaDigits(faNum(btc.usdPrice))}</b> (${faPct(btc.change24h)})\n`;

  // Toncoin
  const ton = (market.crypto || []).find((c) => c.symbol === 'TON');
  if (ton) m += `💎 <b>تون‌کوین:</b> <b>$${toFaDigits(ton.usdPrice.toFixed(2))}</b> (${faPct(ton.change24h)})\n`;

  m += `${RULE}\n`;
  m += `<i>📱 برای تابلوی لمسی پیشرفته دکمه زیر را لمس کنید.</i>`;
  return m;
}

/** Interactive Alert Setup Message. */
export function alertMenuMessage(currentPrice, alerts = []) {
  let m = `⏰ <b>تنظیم هوشمند هشدار قیمت تتر</b>\n${RULE}\n`;
  m += `💸 نرخ لحظه‌ای تتر: <b>${faNum(currentPrice)}</b> تومان\n\n`;
  m += `تنها با یک لمس می‌توانید هشدار صعودی یا نزولی بسازید:\n`;
  m += `• 🔺 گزینه‌های مثبت: به محض عبور قیمت به سمت بالا\n`;
  m += `• 🔻 گزینه‌های منفی: به محض افت قیمت به سمت پایین\n`;

  if (alerts && alerts.length > 0) {
    m += `\n${RULE}\n🔔 <b>هشدارهای فعال شما (${toFaDigits(alerts.length)} مورد):</b>\n`;
    alerts.forEach((a, i) => {
      const dir = a.direction === 'above' ? '🔺 بالاتر از' : '🔻 پایین‌تر از';
      m += `${toFaDigits(i + 1)}. ${dir} <b>${faNum(a.price)}</b> تومان\n`;
    });
  }
  return m;
}

/** Interactive Alert List Message. */
export function alertListMessage(alerts = []) {
  if (!alerts || !alerts.length) {
    return `🔔 <b>فهرست هشدارهای شما</b>\n${RULE}\nشما هیچ هشدار فعالی ندارید. می‌توانید با دکمه‌های زیر هشدار دلخواه خود را ثبت کنید.`;
  }
  let m = `🔔 <b>فهرست هشدارهای فعال شما</b>\n${RULE}\n`;
  alerts.forEach((a, i) => {
    const dir = a.direction === 'above' ? '🔺 بالاتر از' : '🔻 پایین‌تر از';
    m += `${toFaDigits(i + 1)}. ${dir} <b>${faNum(a.price)}</b> تومان\n`;
  });
  m += `\n<i>برای حذف، روی دکمه مربوط به هر کدام بزنید.</i>`;
  return m;
}

/** Settings Message. */
export function settingsMessage(subscribed) {
  return `⚙️ <b>تنظیمات ربات تتریفای</b>\n${RULE}\n` +
    `🔔 گزارش روزانه بازار: <b>${subscribed ? '✅ فعال' : '⛔️ غیرفعال'}</b>\n\n` +
    `با فعال‌سازی گزارش روزانه، هر شب خلاصه میانگین روز را دریافت می‌کنید.`;
}

export function notEnoughData(snapshot) {
  return `⚠️ <b>داده کافی برای گزارش نیست</b>\n\n` +
    `از ${faNum(snapshot.stats.total)} صرافی، فقط ${faNum(snapshot.stats.count)} مورد قیمت معتبر داشتند ` +
    `و این کمتر از حد لازم است.\n\nکمی بعد دوباره امتحان کنید.` + footer(snapshot);
}

/** One line per exchange, with a quality marker. */
function exchangeLine(r, index, best) {
  const icons = [];
  if (r.flags.includes(FLAG.UNIT)) icons.push(FLAG_ICON[FLAG.UNIT]);
  if (r.flags.includes(FLAG.DELAYED)) icons.push(FLAG_ICON[FLAG.DELAYED]);
  if (r.flags.includes(FLAG.BAD_BID)) icons.push(FLAG_ICON[FLAG.BAD_BID]);
  const mark = r === best ? '🥇' : `${toFaDigits(index)}.`;
  const bid = r.bidOk ? ` / <code>${faNum(r.bid)}</code>` : '';
  const tail = icons.length ? ` ${icons.join('')}` : '';
  return `${mark} <b>${esc(r.name)}</b>${tail}\n` +
         `     خرید <code>${faNum(r.ask)}</code>${bid}\n`;
}

/** Paginated list of trusted exchanges, cheapest first. */
export function listMessage(snapshot, page = 0, pageSize = 15) {
  const s = snapshot.stats;
  if (!s.ok) return { text: notEnoughData(snapshot), pages: 1, page: 0 };

  const sorted = [...snapshot.trusted].sort((a, b) => a.ask - b.ask);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = sorted.slice(p * pageSize, (p + 1) * pageSize);

  let m = `📋 <b>صرافی‌های معتبر</b> — صفحه ${toFaDigits(p + 1)} از ${toFaDigits(pages)}\n`;
  m += `<i>مرتب‌شده از ارزان‌ترین قیمت خرید</i>\n${RULE}\n`;
  slice.forEach((r, i) => { m += exchangeLine(r, p * pageSize + i + 1, sorted[0]); });
  m += `${RULE}\n`;
  m += `🔧 واحد اصلاح‌شده · 🕒 با تأخیر · ↔️ نرخ فروش نامعتبر\n`;
  m += footer(snapshot);
  return { text: m, pages, page: p };
}

/** Best five on each side. */
export function topMessage(snapshot) {
  const s = snapshot.stats;
  if (!s.ok) return notEnoughData(snapshot);

  const cheap = [...snapshot.trusted].sort((a, b) => a.ask - b.ask).slice(0, 5);
  const rich = snapshot.rows.filter((r) => r.bidOk).sort((a, b) => b.bid - a.bid).slice(0, 5);

  let m = `🏆 <b>بهترین‌های بازار</b>\n🗓 ${esc(stamp(snapshot))}\n${RULE}\n`;
  m += `🟢 <b>ارزان‌ترین برای خرید</b>\n`;
  cheap.forEach((r, i) => { m += `${toFaDigits(i + 1)}. ${esc(r.name)} — <b>${faNum(r.ask)}</b>\n`; });
  m += `\n🔴 <b>بهترین قیمت برای فروش</b>\n`;
  rich.forEach((r, i) => { m += `${toFaDigits(i + 1)}. ${esc(r.name)} — <b>${faNum(r.bid)}</b>\n`; });
  m += footer(snapshot);
  return m;
}

/**
 * The transparency view: exactly which exchanges were excluded and why.
 * These never enter the minimum, maximum or average.
 */
export function excludedMessage(snapshot) {
  const groups = rejectionReport(snapshot);
  if (!groups.size) {
    return `✅ <b>هیچ قیمت مشکوکی پیدا نشد</b>\n\nهر ${faNum(snapshot.stats.total)} صرافی داده‌ی سالمی دادند.` + footer(snapshot);
  }

  let m = `🧹 <b>قیمت‌های کنارگذاشته‌شده</b>\n`;
  m += `<i>این موارد در محاسبه‌ی کمترین، بیشترین و میانگین وارد نشده‌اند.</i>\n${RULE}\n`;

  for (const [reason, list] of groups) {
    m += `\n${FLAG_ICON[reason] || '•'} <b>${esc(FLAG_LABEL[reason] || reason)}</b> — ${faNum(list.length)} مورد\n`;
    for (const r of list.slice(0, 12)) {
      const bits = [];
      if (r.ask > 0) bits.push(`${faNum(r.ask)} ت`);
      if (r.devPct != null && reason !== FLAG.BAD_BID) bits.push(faPct(r.devPct));
      if (reason === FLAG.STALE && r.staleMin != null) bits.push(faAgo(r.staleMin));
      if (reason === FLAG.BAD_BID) bits.push(`نرخ فروش ${faNum(r.bid)}`);
      m += bits.length
        ? `   • ${esc(r.name)} <i>(${bits.join(' · ')})</i>\n`
        : `   • ${esc(r.name)}\n`;
    }
    if (list.length > 12) m += `   <i>… و ${faNum(list.length - 12)} مورد دیگر</i>\n`;
  }

  m += `${RULE}\n`;
  m += `<b>معیارها:</b> انحراف بیش از ${faNum(snapshot.meta.band, 2)}٪ از میانه، ` +
       `کهنگی بیش از ${faNum(snapshot.cfg.maxStaleMinutes)} دقیقه، ` +
       `یا فاصله‌ی خرید و فروش بیش از ${faNum(snapshot.cfg.maxSpreadPct)}٪.\n`;
  m += footer(snapshot);
  return m;
}

/** Sparkline over daily averages. */
export function sparkline(values) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v) => SPARK[Math.min(7, Math.floor(((v - min) / span) * 7.999))]).join('');
}

/** Today's average versus yesterday. */
export function avgMessage(snapshot, today, yesterday) {
  let m = `📊 <b>میانگین قیمت تتر</b>\n🗓 ${esc(stamp(snapshot))}\n${RULE}\n`;

  if (snapshot.stats.ok) {
    m += `🔵 <b>میانگین همین لحظه:</b> ${faNum(snapshot.stats.avg)} تومان\n`;
    m += `<i>از ${faNum(snapshot.stats.count)} صرافی معتبر</i>\n\n`;
  }

  if (today) {
    m += `📅 <b>امروز تا این لحظه</b>\n`;
    m += `   میانگین: <b>${faNum(today.avg)}</b> تومان\n`;
    m += `   کمترین: ${faNum(today.min)} · بیشترین: ${faNum(today.max)}\n`;
    m += `   تعداد نمونه: ${faNum(today.samples)}\n\n`;
  } else {
    m += `<i>هنوز نمونه‌ی کافی برای امروز ثبت نشده.</i>\n\n`;
  }

  if (yesterday) {
    const diff = today ? today.avg - yesterday.avg : 0;
    const pct = yesterday.avg ? (diff / yesterday.avg) * 100 : 0;
    const arrow = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➖';
    m += `📆 <b>دیروز</b>: ${faNum(yesterday.avg)} تومان\n`;
    if (today) m += `${arrow} تغییر نسبت به دیروز: <b>${faNum(Math.abs(diff))}</b> تومان (${faPct(pct)})\n`;
  }

  m += footer(snapshot);
  return m;
}

/** Multi-day history with a sparkline. */
export function chartMessage(days, snapshot) {
  if (!days.length) {
    return `📈 <b>تاریخچه</b>\n\n<i>هنوز داده‌ی روزانه‌ای ثبت نشده. چند روز که بگذرد نمودار اینجا ظاهر می‌شود.</i>`;
  }

  const avgs = days.map((d) => d.avg);
  let m = `📈 <b>روند ${toFaDigits(days.length)} روز اخیر</b>\n${RULE}\n`;
  m += `<code>${sparkline(avgs)}</code>\n\n`;

  for (const d of days) {
    const delta = d.close - d.open;
    const arrow = delta > 0 ? '🔺' : delta < 0 ? '🔻' : '➖';
    m += `${arrow} <b>${esc(d.jalali)}</b> — ${faNum(d.avg)} ت\n`;
    m += `      <i>کمترین ${faNum(d.min)} · بیشترین ${faNum(d.max)}</i>\n`;
  }

  const first = avgs[0];
  const last = avgs[avgs.length - 1];
  if (first) {
    const pct = ((last - first) / first) * 100;
    m += `${RULE}\n📌 تغییر کل دوره: <b>${faPct(pct)}</b>\n`;
  }
  if (snapshot) m += footer(snapshot);
  return m;
}

/** The scheduled daily report sent to subscribed chats. */
export function digestMessage(day, snapshot, previous, history) {
  let m = `🌙 <b>گزارش روزانه تتر</b>\n`;
  m += `🗓 ${esc(day.jalali)}\n${RULE}\n`;
  m += `⚖️ <b>میانگین روز:</b> ${faNum(day.avg)} تومان\n`;
  m += `📉 کمترین: ${faNum(day.min)} تومان\n`;
  m += `📈 بیشترین: ${faNum(day.max)} تومان\n`;
  m += `🚪 ابتدای روز: ${faNum(day.open)} · پایان روز: ${faNum(day.close)}\n`;

  const delta = day.close - day.open;
  const pct = day.open ? (delta / day.open) * 100 : 0;
  const arrow = delta > 0 ? '🔺 صعودی' : delta < 0 ? '🔻 نزولی' : '➖ بدون تغییر';
  m += `${arrow} — <b>${faNum(Math.abs(delta))}</b> تومان (${faPct(pct)})\n`;

  if (previous) {
    const d2 = day.avg - previous.avg;
    const p2 = previous.avg ? (d2 / previous.avg) * 100 : 0;
    m += `\n📆 نسبت به دیروز (${faNum(previous.avg)}): <b>${faPct(p2)}</b>\n`;
  }

  if (history && history.length > 2) {
    m += `\n📊 روند اخیر: <code>${sparkline(history.map((d) => d.avg))}</code>\n`;
  }

  m += `\n<i>محاسبه بر پایه ${faNum(day.samples)} نمونه از صرافی‌های معتبر — قیمت‌های خطادار حذف شده‌اند.</i>\n`;
  if (snapshot) m += footer(snapshot);
  m += `\n${BRAND}`;
  return m;
}

/**
 * The hourly channel post. Deliberately more compact than the private-chat card:
 * a channel feed is skimmed, not read, and one of these lands every hour.
 */
export function channelPost(snapshot, today, market = null) {
  const s = snapshot.stats;
  const t = snapshot.tehranNow;

  let m = `📊 <b>تابلوی لحظه‌ای بازارهای مالی تتریفای</b>\n`;
  m += `🗓 ${esc(t.jalaliLong)} · ساعت ${t.clock}\n${RULE}\n`;
  m += `🟢 <b>تتر (ارزان‌ترین خرید):</b> <b>${faNum(s.bestBuy)}</b> تومان (${esc(s.bestBuyName)})\n`;
  m += `🔴 <b>تتر (بهترین فروش):</b> <b>${faNum(s.bestSell)}</b> تومان (${esc(s.bestSellName)})\n`;
  m += `⚖️ <b>میانه بازار تتر:</b> <b>${faNum(s.median)}</b> تومان`;

  if (today && today.samples > 1) {
    const diff = s.avg - today.open;
    const pct = today.open ? (diff / today.open) * 100 : 0;
    const arrow = diff > 0 ? ' 🔺' : diff < 0 ? ' 🔻' : ' ➖';
    m += ` (${arrow}${faPct(pct)})`;
  }
  m += `\n${RULE}\n`;

  if (market) {
    const usd = (market.fiat || []).find((f) => f.key.includes('usd'));
    const g18 = (market.gold || []).find((g) => g.key === 'geram18');
    const sek = (market.gold || []).find((g) => g.key === 'sekee');
    const btc = (market.crypto || []).find((c) => c.symbol === 'BTC');

    if (usd) m += `💵 <b>دلار آزاد:</b> <b>${faNum(usd.price)}</b> تومان\n`;
    if (g18) m += `🪙 <b>طلای ۱۸ عیار:</b> <b>${faNum(g18.price)}</b> تومان\n`;
    if (sek) m += `🟡 <b>سکه امامی:</b> <b>${faNum(sek.price)}</b> تومان\n`;
    if (btc) m += `₿ <b>بیت‌کوین:</b> $<b>${faNum(Math.round(btc.usdPrice))}</b> (${faNum(Math.round(btc.tomanPrice))} ت)\n`;
    m += `${RULE}\n`;
  }

  m += `✅ پالایش بین <b>${faNum(s.count)}</b> صرافی مجاز`;
  if (s.rejectedCount) m += ` · 🧹 <b>${faNum(s.rejectedCount)}</b> نرخ مشکوک حذف شد`;
  m += `\n\n🤖 تابلوی تعاملی و ماشین‌حساب: @${BOT_USERNAME}\n📣 عضویت در کانال: ${CHANNEL_ID}`;
  return m;
}

export function startMessage(name) {
  return `✨ سلام ${esc(name || '')}!\n\n` +
    `به <b>${BRAND}</b> خوش آمدید — تابلوی هوشمند بازارهای مالی، کریپتو، طلا، سکه، دلار و تتر.\n\n` +
    `از دکمه‌های زیر برای دسترسی فوری به نرخ‌ها، کپی آسان و تنظیم خودکار هشدارها استفاده کنید:`;
}

export function helpMessage(isAdminUser) {
  let m = `📖 <b>راهنمای جامع ${BRAND}</b>\n${RULE}\n`;
  m += `<b>بازارهای مالی</b>\n`;
  m += `/market — تابلوی جامع تمام بازارها (خلاصه ۴ بازار)\n`;
  m += `/crypto — ارزهای دیجیتال (BTC, ETH, TON, SOL, USDT, DOGE و...)\n`;
  m += `/gold — طلا، مثقال، انس، سکه امامی، نیم، ربع و گرمی\n`;
  m += `/currency — دلار آمریکا، یورو، درهم، پوند، لیر و کانادا (میانبر: /dollar)\n`;
  m += `/calc 150 usdt — ماشین حساب و تبدیل نرخ\n\n`;
  m += `<b>تتر و صرافی‌های ایرانی</b>\n`;
  m += `/price — خلاصه‌ی بازار تتر (میانبر: /p)\n`;
  m += `/list — فهرست صرافی‌های معتبر\n`;
  m += `/top — پنج صرافی برتر خرید و فروش\n`;
  m += `/avg — میانگین روزانه تتر\n`;
  m += `/chart — روند هفت روز اخیر تتر\n`;
  m += `/excluded — قیمت‌های خطادار کنار گذاشته شده\n\n`;
  m += `<b>هشدار قیمت</b>\n`;
  m += `/alert 230000 — ثبت هشدار نوسان قیمت\n`;
  m += `/alerts — فهرست هشدارهای فعال شما\n`;
  m += `/delalert 3 — حذف یک هشدار\n\n`;
  m += `<b>حالت inline</b>\n`;
  m += `در هر چت یا گروهی بنویسید <code>@${BOT_USERNAME}</code> تا تابلوی تعاملی و نرخ‌ها را ارسال کنید.\n`;

  if (isAdminUser) {
    m += `\n${RULE}\n🛠 <b>دستورهای مدیر</b>\n`;
    m += `/stats — آمار کاربران و چت‌ها\n`;
    m += `/health — وضعیت منبع و کش\n`;
    m += `/raw — گزارش کامل کیفیت داده\n`;
    m += `/digest — ارسال دستی گزارش روزانه\n`;
    m += `/channel — ارسال فوری پست کانال (<code>/channel dry</code> برای پیش‌نمایش)\n`;
    m += `/setchannel @نام — تعیین کانال پست خودکار\n`;
    m += `/forcejoin on|off — عضویت اجباری کانال برای پیوی\n`;
    m += `/refresh — تازه‌سازی اجباری کش\n`;
    m += `/broadcast متن — ارسال پیام به همه‌ی مشترکان\n`;
    m += `/set کلید مقدار — تغییر تنظیمات (مثلاً devTolerancePct)\n`;
    m += `/config — نمایش تنظیمات فعلی\n`;
    m += `/block نام — کنار گذاشتن یک صرافی\n`;
    m += `/unblock نام — بازگرداندن آن\n`;
    m += `/ban شناسه · /unban شناسه\n`;
  }
  return m;
}

export function aboutMessage() {
  return `ℹ️ <b>درباره ${BRAND}</b>\n${RULE}\n` +
    `داده‌ها از <b>${SOURCE_NAME}</b> گرفته می‌شود که نرخ حدود ۹۰ صرافی ایرانی را جمع می‌کند.\n\n` +
    `<b>چرا بعضی قیمت‌ها حذف می‌شوند؟</b>\n` +
    `چون همه‌ی آن نرخ‌ها واقعی نیستند. چهار خطای رایج را تشخیص می‌دهم و کنار می‌گذارم:\n\n` +
    `🔧 <b>خطای واحد</b> — صرافی ریال را جای تومان زده و عدد دقیقاً ده برابر یا یک‌دهم است. این یکی را اصلاح می‌کنم.\n` +
    `⏳ <b>نرخ کهنه</b> — صرافی روزها یا هفته‌هاست قیمتش را به‌روز نکرده.\n` +
    `↔️ <b>نرخ فروش خراب</b> — قیمت خرید طبیعی است ولی فروش نصف آن؛ این خطای داده است نه اختلاف قیمت.\n` +
    `⚠️ <b>پرت</b> — هر چیزی که فاصله‌ی غیرمنطقی با میانه‌ی بازار دارد.\n\n` +
    `میانه و انحراف مطلق از میانه (MAD) معیار سنجش‌اند، چون برخلاف میانگین، چند عدد پرت نمی‌تواند آن‌ها را جابه‌جا کند.\n\n` +
    `<b>هیچ‌کدام از موارد حذف‌شده در کمترین، بیشترین یا میانگین شمرده نمی‌شوند.</b> ` +
    `برای دیدن فهرستشان: /excluded\n\n` +
    `<i>این ربات صرفاً گزارشگر قیمت است و توصیه‌ی مالی نمی‌کند.</i>`;
}

export function alertsMessage(list) {
  if (!list.length) {
    return `🔔 <b>هشدارهای شما</b>\n\nهیچ هشدار فعالی ندارید.\n\n` +
      `برای ساختن یکی: <code>/alert 230000</code>\n` +
      `<i>جهت هشدار خودکار تشخیص داده می‌شود: عدد بالاتر از قیمت فعلی یعنی هشدار صعودی.</i>`;
  }
  let m = `🔔 <b>هشدارهای فعال شما</b>\n${RULE}\n`;
  for (const a of list) {
    const arrow = a.direction === 'above' ? '📈 بالاتر از' : '📉 پایین‌تر از';
    m += `<code>${toFaDigits(a.id)}</code> — ${arrow} <b>${faNum(a.price)}</b> تومان\n`;
  }
  m += `${RULE}\n<i>حذف یکی: </i><code>/delalert ${toFaDigits(list[0].id)}</code>\n<i>حذف همه: </i><code>/delalert all</code>`;
  return m;
}
