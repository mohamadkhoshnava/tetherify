// lib/quality.js — separate real quotes from broken ones.
//
// The upstream aggregator republishes whatever each exchange advertises, and a
// meaningful slice of that is wrong. Four failure modes show up in practice:
//
//   1. Unit errors    — the exchange publishes rials where tomans are expected
//                       (or the reverse), so the number is exactly 10x off.
//   2. Stale quotes   — the exchange stopped updating days or weeks ago; the
//                       price is "real" but describes a market that is gone.
//   3. Broken bids    — an ask near the market with a bid at half of it. That is
//                       a data error, not a spread.
//   4. Plain outliers — everything else that sits implausibly far from the market.
//
// Only quotes that survive all four checks feed the statistics. Rejected ones are
// kept, labelled with a reason, and reported separately — never silently dropped,
// and never allowed into a minimum, maximum or average.

import { DEFAULTS } from 'lib/config';
import { jalaliDayNumber } from 'lib/fa';

export const FLAG = {
  OK: 'ok',
  UNIT: 'unit',
  STALE: 'stale',
  OUTLIER: 'outlier',
  NO_QUOTE: 'no_quote',
  BLOCKED: 'blocked',
  BAD_BID: 'bad_bid',
  DELAYED: 'delayed',
};

/** Human-readable reason per flag, for /excluded and the admin report. */
export const FLAG_LABEL = {
  [FLAG.UNIT]: 'واحد اشتباه (ریال/تومان) — اصلاح شد',
  [FLAG.STALE]: 'قیمت قدیمی و به‌روز نشده',
  [FLAG.OUTLIER]: 'قیمت غیرواقعی و پرت',
  [FLAG.NO_QUOTE]: 'قیمتی اعلام نکرده',
  [FLAG.BLOCKED]: 'در فهرست مسدود',
  [FLAG.BAD_BID]: 'اختلاف خرید/فروش غیرمنطقی',
  [FLAG.DELAYED]: 'با تأخیر به‌روز شده',
};

export const FLAG_ICON = {
  [FLAG.OK]: '▫️',
  [FLAG.UNIT]: '🔧',
  [FLAG.STALE]: '⏳',
  [FLAG.OUTLIER]: '⚠️',
  [FLAG.NO_QUOTE]: '➖',
  [FLAG.BLOCKED]: '🚫',
  [FLAG.BAD_BID]: '↔️',
  [FLAG.DELAYED]: '🕒',
};

export function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation — a spread measure that outliers cannot drag around. */
export function mad(values, center) {
  if (!values.length) return 0;
  const c = center ?? median(values);
  return median(values.map((v) => Math.abs(v - c)));
}

/** Minutes since the Jalali epoch — lets two quote timestamps be compared directly. */
function stampMinutes(stamp) {
  if (!stamp) return null;
  return jalaliDayNumber(stamp.jy, stamp.jm, stamp.jd) * 1440 + stamp.hour * 60 + stamp.minute;
}

/**
 * A quote 10x above or below the market is a unit mistake, not a price. Detect it
 * against a rough reference and rescale, rather than throwing the exchange away.
 */
function unitFactor(ask, reference) {
  if (!reference || !ask) return 1;
  const ratio = ask / reference;
  if (ratio >= 5 && ratio <= 20) return 0.1;    // published in rials
  if (ratio >= 0.05 && ratio <= 0.2) return 10; // published in a 10x-smaller unit
  return 1;
}

/**
 * Classify every quote and compute statistics from the trusted subset.
 *
 * @param {Array} raw            rows from lib/source
 * @param {object} opts          overrides for DEFAULTS + { blocklist: string[] }
 * @returns {{rows, trusted, rejected, stats, meta}}
 */
export function analyze(raw, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const blocklist = (opts.blocklist || []).map((s) => String(s).trim()).filter(Boolean);

  const rows = raw
    .filter((r) => r && r.name)
    .map((r) => ({ ...r, flags: [], askOk: false, bidOk: false, devPct: null, staleMin: null, factor: 1 }));

  // --- pass 1: a rough reference from the raw asks. The majority of exchanges
  // quote correctly, so the median is already close to the truth even before any
  // cleaning — which is exactly what makes it safe to detect unit errors with.
  const rawAsks = rows.map((r) => r.ask).filter((v) => v > 0);
  const roughRef = median(rawAsks);

  // --- pass 2: rescale unit errors, then recompute the reference from the
  // corrected values so the band below is centred on the real market.
  for (const r of rows) {
    const f = unitFactor(r.ask, roughRef);
    if (f !== 1) {
      r.factor = f;
      r.ask *= f;
      r.bid *= f;
      r.high *= f;
      r.low *= f;
      r.flags.push(FLAG.UNIT);
    }
  }

  const asks = rows.map((r) => r.ask).filter((v) => v > 0);
  const ref = median(asks);
  const madAbs = mad(asks, ref);
  const madPct = ref ? (madAbs / ref) * 100 : 0;

  // The tolerance band widens in a genuinely volatile market (MAD-driven) but
  // never narrows below the configured floor, so a calm market stays strict.
  const band = Math.max(cfg.devTolerancePct, 3.5 * madPct);

  // --- pass 3: freshness is measured against the freshest quote on the page,
  // not against wall-clock time, so the source lagging as a whole never marks
  // every exchange stale at once.
  const stamps = rows.map((r) => stampMinutes(r.stamp)).filter((v) => v != null);
  const newest = stamps.length ? Math.max(...stamps) : null;

  for (const r of rows) {
    const mins = stampMinutes(r.stamp);
    r.staleMin = newest != null && mins != null ? newest - mins : null;

    if (blocklist.some((b) => r.name.includes(b))) {
      r.flags.push(FLAG.BLOCKED);
      continue;
    }

    if (!(r.ask > 0)) {
      r.flags.push(FLAG.NO_QUOTE);
      continue;
    }

    r.devPct = ref ? ((r.ask - ref) / ref) * 100 : 0;

    if (r.staleMin != null && r.staleMin > cfg.maxStaleMinutes) {
      r.flags.push(FLAG.STALE);
      continue;
    }

    if (Math.abs(r.devPct) > band) {
      r.flags.push(FLAG.OUTLIER);
      continue;
    }

    if (r.staleMin != null && r.staleMin > cfg.staleWarnMinutes) r.flags.push(FLAG.DELAYED);

    r.askOk = true;

    // The bid side is judged independently: a sound ask does not vouch for it.
    if (r.bid > 0) {
      const spreadPct = ((r.ask - r.bid) / r.ask) * 100;
      r.spreadPct = spreadPct;
      const bidDev = ref ? Math.abs((r.bid - ref) / ref) * 100 : 0;
      if (spreadPct < -cfg.maxSpreadPct || spreadPct > cfg.maxSpreadPct || bidDev > band) {
        r.flags.push(FLAG.BAD_BID);
      } else {
        r.bidOk = true;
      }
    }
  }

  const trusted = rows.filter((r) => r.askOk);
  const rejected = rows.filter((r) => !r.askOk);
  const okAsks = trusted.map((r) => r.ask);
  const okBids = rows.filter((r) => r.bidOk).map((r) => r.bid);

  const cheapest = trusted.reduce((a, b) => (a && a.ask <= b.ask ? a : b), null);
  const priciest = trusted.reduce((a, b) => (a && a.ask >= b.ask ? a : b), null);
  const bestSeller = rows.filter((r) => r.bidOk).reduce((a, b) => (a && a.bid >= b.bid ? a : b), null);

  const avg = okAsks.length ? okAsks.reduce((s, v) => s + v, 0) / okAsks.length : 0;

  const stats = {
    ok: okAsks.length >= cfg.minTrusted,
    count: okAsks.length,
    rejectedCount: rejected.length,
    total: rows.length,
    avg,
    median: median(okAsks),
    minAsk: okAsks.length ? Math.min(...okAsks) : 0,
    maxAsk: okAsks.length ? Math.max(...okAsks) : 0,
    bestBuy: cheapest ? cheapest.ask : 0,
    bestBuyName: cheapest ? cheapest.name : null,
    worstBuy: priciest ? priciest.ask : 0,
    worstBuyName: priciest ? priciest.name : null,
    bestSell: bestSeller ? bestSeller.bid : 0,
    bestSellName: bestSeller ? bestSeller.name : null,
    // Range across trusted exchanges — how much shopping around is worth.
    spreadPct: cheapest && priciest && cheapest.ask ? ((priciest.ask - cheapest.ask) / cheapest.ask) * 100 : 0,
  };

  return {
    rows,
    trusted,
    rejected,
    stats,
    meta: { ref, band, madPct, roughRef, newest, cfg },
  };
}

/** Group rejected quotes by reason — the payload behind /excluded. */
export function rejectionReport(result) {
  const groups = new Map();
  for (const r of result.rejected) {
    const reason = r.flags.find((f) => f !== FLAG.UNIT && f !== FLAG.DELAYED) || FLAG.OUTLIER;
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(r);
  }
  // Bad bids are not rejections of the exchange, but they are worth surfacing.
  const badBids = result.rows.filter((r) => r.askOk && r.flags.includes(FLAG.BAD_BID));
  if (badBids.length) groups.set(FLAG.BAD_BID, badBids);
  return groups;
}
