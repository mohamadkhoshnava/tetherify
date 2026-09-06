// lib/fa.js — Persian text, number and calendar helpers.
//
// The runtime has no Intl-heavy formatting guarantees and no npm packages, so
// everything here is written from scratch and dependency-free.

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const AR_TO_EN = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

const div = (a, b) => Math.floor(a / b);
const mod = (a, b) => a - Math.floor(a / b) * b;

/** Persian/Arabic-Indic digits -> ASCII, so the string can be parsed as a number. */
export function toEnDigits(s) {
  if (s == null) return '';
  return String(s).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => AR_TO_EN[d] ?? d);
}

/** ASCII digits -> Persian, for display. */
export function toFaDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}

/** 225897.4 -> "۲۲۵,۸۹۷" (rounded, grouped, Persian digits). */
export function faNum(n, decimals = 0) {
  if (n == null || !isFinite(n)) return '—';
  const fixed = Number(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const grouped = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toFaDigits(sign + grouped + (frac ? '.' + frac : ''));
}

/** Signed percentage, e.g. "+۰٫۳۲٪". */
export function faPct(n, decimals = 2) {
  if (n == null || !isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return sign + toFaDigits(Math.abs(n).toFixed(decimals)) + '٪';
}

/** Escape text before putting it inside a parse_mode:"HTML" message. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Calendar. Jalali <-> Gregorian via Julian Day Number (Birashk 2820-year cycle,
// exact across every year this bot will ever see).
// ---------------------------------------------------------------------------

/** Gregorian date -> Julian Day Number. */
export function g2d(gy, gm, gd) {
  const a = div(14 - gm, 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  return gd + div(153 * m + 2, 5) + 365 * y + div(y, 4) - div(y, 100) + div(y, 400) - 32045;
}

/** Julian Day Number -> Gregorian date. */
export function d2g(jdn) {
  let j = jdn + 32044;
  const g = div(j, 146097); const dg = mod(j, 146097);
  const c = Math.min(div(dg, 36524), 3); const dc = dg - c * 36524;
  const b = div(dc, 1461); const db = mod(dc, 1461);
  const a = Math.min(div(db, 365), 3); const da = db - a * 365;
  const y = g * 400 + c * 100 + b * 4 + a;
  const m = div(da * 5 + 308, 153) - 2;
  const d = da - div((m + 4) * 153, 5) + 122;
  return { gy: y - 4800 + div(m + 2, 12), gm: mod(m + 2, 12) + 1, gd: d + 1 };
}

/** Jalali date -> Julian Day Number. */
export function j2d(jy, jm, jd) {
  const epbase = jy - (jy >= 0 ? 474 : 473);
  const epyear = 474 + mod(epbase, 2820);
  return jd
    + (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6)
    + div(epyear * 682 - 110, 2816)
    + (epyear - 1) * 365
    + div(epbase, 2820) * 1029983
    + 1948320;
}

/** Julian Day Number -> Jalali date. */
export function d2j(jdn) {
  const depoch = jdn - j2d(475, 1, 1);
  const cycle = div(depoch, 1029983);
  const cyear = mod(depoch, 1029983);
  let ycycle;
  if (cyear === 1029982) {
    ycycle = 2820;
  } else {
    const aux1 = div(cyear, 366);
    const aux2 = mod(cyear, 366);
    ycycle = div(2134 * aux1 + 2816 * aux2 + 2815, 1028522) + aux1 + 1;
  }
  let jy = ycycle + 2820 * cycle + 474;
  if (jy <= 0) jy -= 1;
  const yday = jdn - j2d(jy, 1, 1) + 1;
  const jm = yday <= 186 ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
  const jd = jdn - j2d(jy, jm, 1) + 1;
  return { jy, jm, jd };
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];
export const JALALI_WEEKDAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

/**
 * Wall-clock time in Tehran for a given instant.
 * Iran dropped DST in 2022, so the offset is a constant +03:30.
 */
export function tehran(date = new Date(), offsetMinutes = 210) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const gy = shifted.getUTCFullYear();
  const gm = shifted.getUTCMonth() + 1;
  const gd = shifted.getUTCDate();
  const jdn = g2d(gy, gm, gd);
  const { jy, jm, jd } = d2j(jdn);
  // Persian week starts on Saturday: Sat->0 ... Fri->6.
  const weekdayIdx = (shifted.getUTCDay() + 1) % 7;
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    gy, gm, gd, jy, jm, jd, hour, minute,
    // Gregorian day key, used as the primary key of the `daily` table.
    day: `${gy}-${pad(gm)}-${pad(gd)}`,
    jalali: toFaDigits(`${jy}/${pad(jm)}/${pad(jd)}`),
    jalaliLong: `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`,
    weekday: JALALI_WEEKDAYS[weekdayIdx],
    clock: toFaDigits(`${pad(hour)}:${pad(minute)}`),
  };
}

/**
 * Day number for a Jalali date — used to diff two quote timestamps without
 * bouncing through Gregorian.
 */
export function jalaliDayNumber(jy, jm, jd) {
  return j2d(jy, jm, jd);
}

/** Human-friendly "چند وقت پیش" for a minute count. */
export function faAgo(minutes) {
  if (minutes == null || !isFinite(minutes)) return 'نامعلوم';
  if (minutes < 1) return 'همین الان';
  if (minutes < 60) return `${toFaDigits(Math.round(minutes))} دقیقه پیش`;
  const hours = minutes / 60;
  if (hours < 24) return `${toFaDigits(Math.round(hours))} ساعت پیش`;
  const days = hours / 24;
  if (days < 30) return `${toFaDigits(Math.round(days))} روز پیش`;
  return `${toFaDigits(Math.round(days / 30))} ماه پیش`;
}
