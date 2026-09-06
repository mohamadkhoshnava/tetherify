// lib/format.js — every user-facing message. Telegram HTML parse mode.
//
// Telegram caps a message at 4096 characters, so anything list-shaped paginates.

import { faNum, faPct, faAgo, esc, toFaDigits } from 'lib/fa';
import { FLAG, FLAG_ICON, FLAG_LABEL, rejectionReport } from 'lib/quality';
import { BRAND, SOURCE_NAME, BOT_USERNAME } from 'lib/config';

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

/** The main price card. */
export function priceCard(snapshot) {
  const s = snapshot.stats;
  if (!s.ok) return notEnoughData(snapshot);

  let m = `💵 <b>قیمت تتر (USDT)</b>\n`;
  m += `🗓 ${esc(stamp(snapshot))}\n`;
  m += `${RULE}\n`;
  m += `🟢 <b>ارزان‌ترین خرید</b>\n`;
  m += `    <b>${faNum(s.bestBuy)}</b> تومان — ${esc(s.bestBuyName)}\n\n`;
  m += `🔴 <b>بهترین فروش</b>\n`;
  m += `    <b>${faNum(s.bestSell)}</b> تومان — ${esc(s.bestSellName)}\n\n`;
  m += `⚖️ میانگین بازار: <b>${faNum(s.avg)}</b> تومان\n`;
  m += `📊 میانه: <b>${faNum(s.median)}</b> تومان\n`;
  m += `📐 بازه: ${faNum(s.minAsk)} تا ${faNum(s.maxAsk)}\n`;
  m += `↔️ اختلاف ارزان‌ترین تا گران‌ترین: <b>${faPct(s.spreadPct)}</b>\n`;
  m += `${RULE}\n`;
  m += `✅ <b>${faNum(s.count)}</b> صرافی معتبر`;
  if (s.rejectedCount) m += ` · ⚠️ <b>${faNum(s.rejectedCount)}</b> مورد کنار گذاشته شد`;
  m += `\n`;

  // Cross-exchange arbitrage: someone is bidding above someone else's ask.
  if (s.bestSell > s.bestBuy) {
    const gain = s.bestSell - s.bestBuy;
    const pct = (gain / s.bestBuy) * 100;
    m += `\n💡 <b>فرصت اختلاف قیمت:</b> خرید از «${esc(s.bestBuyName)}» و فروش به «${esc(s.bestSellName)}» ` +
         `اختلاف <b>${faNum(gain)}</b> تومان (${faPct(pct)}) دارد.\n`;
  }

  m += footer(snapshot);
  return m;
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

export function startMessage(name) {
  return `👋 سلام ${esc(name || '')}!\n\n` +
    `من <b>${BRAND}</b> هستم — قیمت تتر را از حدود ۹۰ صرافی ایرانی می‌گیرم، ` +
    `قیمت‌های خطادار و قدیمی را کنار می‌گذارم و خلاصه‌ی تمیزش را می‌دهم.\n\n` +
    `<b>چه کارهایی بلدم؟</b>\n` +
    `• /price — قیمت لحظه‌ای و خلاصه‌ی بازار\n` +
    `• /list — فهرست کامل صرافی‌ها\n` +
    `• /top — بهترین‌ها برای خرید و فروش\n` +
    `• /avg — میانگین امروز و مقایسه با دیروز\n` +
    `• /chart — روند روزهای اخیر\n` +
    `• /excluded — چه قیمت‌هایی حذف شدند و چرا\n` +
    `• /alert 230000 — هشدار وقتی قیمت به عددی رسید\n` +
    `• /subscribe — گزارش روزانه خودکار\n\n` +
    `در گروه‌ها هم کار می‌کنم، و می‌توانید با نوشتن <code>@${BOT_USERNAME}</code> ` +
    `در هر چتی قیمت را به‌صورت inline بفرستید.\n\n` +
    `برای دیدن همه‌ی دستورها: /help`;
}

export function helpMessage(isAdminUser) {
  let m = `📖 <b>راهنمای ${BRAND}</b>\n${RULE}\n`;
  m += `<b>قیمت و بازار</b>\n`;
  m += `/price — خلاصه‌ی بازار (میانبر: /p)\n`;
  m += `/list — فهرست صرافی‌های معتبر\n`;
  m += `/top — پنج صرافی برتر خرید و فروش\n`;
  m += `/excluded — قیمت‌های حذف‌شده و دلیلشان\n\n`;
  m += `<b>آمار و تاریخچه</b>\n`;
  m += `/avg — میانگین امروز و مقایسه با دیروز\n`;
  m += `/chart — روند هفت روز اخیر\n\n`;
  m += `<b>هشدار قیمت</b>\n`;
  m += `/alert 230000 — وقتی قیمت از این عدد رد شد خبر بده\n`;
  m += `/alerts — فهرست هشدارهای فعال\n`;
  m += `/delalert 3 — حذف یک هشدار\n\n`;
  m += `<b>گزارش روزانه</b>\n`;
  m += `/subscribe — فعال کردن گزارش روزانه در این چت\n`;
  m += `/unsubscribe — غیرفعال کردن\n\n`;
  m += `<b>حالت inline</b>\n`;
  m += `در هر چتی بنویسید <code>@${BOT_USERNAME}</code> و بدون خروج از آن گفتگو قیمت را بفرستید.\n\n`;
  m += `<b>متفرقه</b>\n`;
  m += `/about — درباره‌ی ربات و روش محاسبه\n`;
  m += `/id — شناسه‌ی عددی این چت\n`;

  if (isAdminUser) {
    m += `\n${RULE}\n🛠 <b>دستورهای مدیر</b>\n`;
    m += `/stats — آمار کاربران و چت‌ها\n`;
    m += `/health — وضعیت منبع و کش\n`;
    m += `/raw — گزارش کامل کیفیت داده\n`;
    m += `/digest — ارسال دستی گزارش روزانه\n`;
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
