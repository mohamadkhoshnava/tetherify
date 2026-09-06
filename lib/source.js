// lib/source.js — fetch and parse the upstream exchange table.
//
// The runtime has no DOM and no npm packages, so the page is parsed with
// targeted regular expressions over the one table we care about. Everything is
// defensive: a layout change should yield fewer rows, never a thrown handler.

import { fetch } from 'sdk';
import { SOURCE_URL } from 'lib/config';
import { toEnDigits } from 'lib/fa';

const TABLE_RE = /<table[^>]*id=["']assets1["'][\s\S]*?<\/table>/i;
const ROW_RE = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
const CELL_RE = /<td[^>]*>[\s\S]*?<\/td>/gi;
const FULL_NAME_RE = /class=["']full-name["'][^>]*>([\s\S]*?)<\/a>/i;
const HREF_RE = /href=["'](crypto\/exchanges\/local\/[^"']+)["']/i;
const TIME_RE = /(\d{4})\/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2}):(\d{2})/;
const PCT_RE = /\(\s*([-+]?[\d.]+)\s*%\s*\)/;

/** Strip tags and collapse whitespace. */
function text(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Upstream quotes rials; the bot speaks tomans. Returns 0 when the cell is
 * empty or holds a dash, which the quality layer treats as "no quote".
 */
function toToman(html) {
  const digits = toEnDigits(text(html)).replace(/[^\d]/g, '');
  if (!digits) return 0;
  const rial = Number(digits);
  if (!isFinite(rial) || rial <= 0) return 0;
  return rial / 10;
}

/** "۱۴۰۵/۰۶/۱۵ - ۰۲:۳۵" -> structured Jalali stamp, or null. */
export function parseStamp(html) {
  const m = TIME_RE.exec(toEnDigits(text(html)));
  if (!m) return null;
  const [, jy, jm, jd, hh, mi] = m.map(Number);
  if (!jy || jm < 1 || jm > 12 || jd < 1 || jd > 31 || hh > 23 || mi > 59) return null;
  return { jy, jm, jd, hour: hh, minute: mi };
}

/**
 * Parse the exchange table out of a page of HTML.
 * @returns {Array<{name,url,ask,bid,high,low,changePct,stamp}>}
 */
export function parseExchanges(html) {
  const table = TABLE_RE.exec(html);
  if (!table) return [];

  const rows = table[0].match(ROW_RE) || [];
  const out = [];

  for (const row of rows) {
    const cells = row.match(CELL_RE) || [];
    // Header rows have <th> only; data rows carry name + 2 prices + change + hi/lo + time.
    if (cells.length < 7) continue;

    const nameCell = cells[0];
    const nameMatch = FULL_NAME_RE.exec(nameCell);
    const name = text(nameMatch ? nameMatch[1] : nameCell);
    if (!name) continue;

    const href = HREF_RE.exec(nameCell);
    const pct = PCT_RE.exec(toEnDigits(text(cells[3])));

    out.push({
      name,
      url: href ? `https://www.tgju.org/${href[1]}` : SOURCE_URL,
      // Column order on the source page is "فروش صرافی" then "خرید صرافی":
      // what the exchange sells at is what the user BUYS at, and vice versa.
      ask: toToman(cells[1]),
      bid: toToman(cells[2]),
      high: toToman(cells[4]),
      low: toToman(cells[5]),
      changePct: pct ? Number(pct[1]) : null,
      stamp: parseStamp(cells[6]),
    });
  }

  return out;
}

/** Fetch the upstream page and parse it. Throws with a readable message. */
export async function fetchExchanges() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
    },
  });

  if (!res.ok) throw new Error(`منبع قیمت پاسخ نداد (HTTP ${res.status})`);

  const html = await res.text();
  const rows = parseExchanges(html);
  if (!rows.length) throw new Error('ساختار صفحه منبع تغییر کرده — هیچ صرافی‌ای استخراج نشد.');
  return rows;
}
