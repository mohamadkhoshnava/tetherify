// lib/market.js — comprehensive market aggregator for Crypto, Gold, Coins, and Currencies.
//
// Combines:
// 1. Iranian USDT quotes across ~90 exchanges (with MAD outlier filtering).
// 2. Gold, Coins, and Currencies from TGJU API (rial -> toman).
// 3. Major cryptocurrencies from Binance 24h ticker ($ and converted to Toman via USDT median).

import { fetch } from 'sdk';
import { getSnapshot } from 'lib/prices';
import { cacheGet, cacheSet, nowSec } from 'lib/store';
import { tehran, toEnDigits } from 'lib/fa';

const TGJU_API_URL = 'https://call.tgju.org/ajax.json';
const BINANCE_API_URL =
  'https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22TONUSDT%22,%22SOLUSDT%22,%22DOGEUSDT%22,%22TRXUSDT%22,%22BNBUSDT%22,%22XRPUSDT%22,%22ADAUSDT%22%5D';

const CACHE_KEY_MARKET = 'market:overview';
const CACHE_KEY_FALLBACK = 'market:fallback';
const CACHE_TTL_SEC = 90;

const CRYPTO_METADATA = {
  BTCUSDT: { symbol: 'BTC', name: 'Bitcoin', nameFa: 'بیت‌کوین', icon: '₿' },
  ETHUSDT: { symbol: 'ETH', name: 'Ethereum', nameFa: 'اتریوم', icon: 'Ξ' },
  TONUSDT: { symbol: 'TON', name: 'Toncoin', nameFa: 'تون‌کوین', icon: '💎' },
  SOLUSDT: { symbol: 'SOL', name: 'Solana', nameFa: 'سولانا', icon: '☀️' },
  DOGEUSDT: { symbol: 'DOGE', name: 'Dogecoin', nameFa: 'دوج‌کوین', icon: '🐕' },
  TRXUSDT: { symbol: 'TRX', name: 'TRON', nameFa: 'ترون', icon: '🔴' },
  BNBUSDT: { symbol: 'BNB', name: 'BNB', nameFa: 'بایننس‌کوین', icon: '🟡' },
  XRPUSDT: { symbol: 'XRP', name: 'XRP', nameFa: 'ریپل', icon: '✕' },
  ADAUSDT: { symbol: 'ADA', name: 'Cardano', nameFa: 'کاردانو', icon: '₳' },
};

/** Convert TGJU rial strings to Tomans. */
function toToman(val) {
  if (val == null) return 0;
  const num = Number(toEnDigits(String(val)).replace(/,/g, ''));
  if (!isFinite(num) || num <= 0) return 0;
  return Math.round(num / 10);
}

/** Parse numeric value with decimals. */
function toNum(val) {
  if (val == null) return 0;
  const num = Number(toEnDigits(String(val)).replace(/,/g, ''));
  return isFinite(num) ? num : 0;
}

/** Fetch TGJU gold, coins, and currencies. */
async function fetchTgju() {
  const res = await fetch(TGJU_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`TGJU error (HTTP ${res.status})`);
  const data = await res.json();
  return data.current || {};
}

/** Fetch Binance crypto ticker prices. */
async function fetchBinance() {
  const res = await fetch(BINANCE_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Binance error (HTTP ${res.status})`);
  return res.json();
}

/**
 * Returns complete market snapshot with all asset classes.
 * @param {{ force?: boolean }} opts
 */
export async function getMarketOverview({ force = false } = {}) {
  let cached = force ? null : await cacheGet(CACHE_KEY_MARKET);
  if (cached) return cached;

  let tetherSnapshot;
  try {
    tetherSnapshot = await getSnapshot({ force });
  } catch (e) {
    console.error('Tether snapshot fetch error:', e && e.message);
  }

  const usdtMedian = (tetherSnapshot && tetherSnapshot.stats && tetherSnapshot.stats.median) || 255000;

  let tgjuCurrent = {};
  try {
    tgjuCurrent = await fetchTgju();
  } catch (e) {
    console.error('TGJU fetch error:', e && e.message);
  }

  let binanceData = [];
  try {
    binanceData = await fetchBinance();
  } catch (e) {
    console.error('Binance fetch error:', e && e.message);
  }

  // If both upstream endpoints failed, serve long-term cached fallback
  if (Object.keys(tgjuCurrent).length === 0 && binanceData.length === 0) {
    const fallback = await cacheGet(CACHE_KEY_FALLBACK);
    if (fallback) return fallback;
  }

  // Parse TGJU items helper
  const item = (key, nameFa, isToman = true) => {
    const raw = tgjuCurrent[key] || {};
    const price = isToman ? toToman(raw.p) : toNum(raw.p);
    const change = isToman ? toToman(raw.d) : toNum(raw.d);
    const pct = toNum(raw.dp);
    const dir = raw.dt === 'high' ? 1 : raw.dt === 'low' ? -1 : 0;
    return {
      key,
      nameFa,
      price,
      changePct: dir !== 0 ? pct * dir : pct,
      changeVal: dir !== 0 ? change * dir : change,
      time: raw.t || '',
    };
  };

  // Gold & Coins
  const gold = [
    item('geram18', 'طلای ۱۸ عیار'),
    item('mesghal', 'مثقال طلا'),
    item('ons', 'انس طلا (جهانی)', false),
    item('sekee', 'سکه امامی'),
    item('sekeb', 'سکه بهار آزادی'),
    item('nim', 'نیم سکه'),
    item('rob', 'ربع سکه'),
    item('gerami', 'سکه گرمی'),
  ];

  // Currencies / Forex
  const fiat = [
    item('price_dollar_rl', 'دلار آمریکا (آزاد)'),
    item('price_eur', 'یورو اروپا'),
    item('price_aed', 'درهم امارات'),
    item('price_gbp', 'پوند انگلیس'),
    item('price_cad', 'دلار کانادا'),
    item('price_aud', 'دلار استرالیا'),
    item('price_try', 'لیر ترکیه'),
  ];

  // Cryptos
  const crypto = [];

  // Tether entry first
  if (tetherSnapshot && tetherSnapshot.stats && tetherSnapshot.stats.ok) {
    const s = tetherSnapshot.stats;
    crypto.push({
      symbol: 'USDT',
      name: 'Tether',
      nameFa: 'تتر (صرافی‌های ایرانی)',
      icon: '₮',
      usdPrice: 1.0,
      tomanPrice: Math.round(s.median),
      bestBuy: Math.round(s.bestBuy),
      bestSell: Math.round(s.bestSell),
      bestBuyName: s.bestBuyName,
      bestSellName: s.bestSellName,
      change24h: 0,
      count: s.count,
    });
  }

  // Add Binance cryptos
  if (Array.isArray(binanceData)) {
    for (const b of binanceData) {
      const meta = CRYPTO_METADATA[b.symbol];
      if (!meta) continue;
      const usdPrice = toNum(b.lastPrice);
      const change24h = toNum(b.priceChangePercent);
      const highUsd = toNum(b.highPrice);
      const lowUsd = toNum(b.lowPrice);
      const tomanPrice = Math.round(usdPrice * usdtMedian);

      crypto.push({
        symbol: meta.symbol,
        name: meta.name,
        nameFa: meta.nameFa,
        icon: meta.icon,
        usdPrice,
        tomanPrice,
        change24h,
        highUsd,
        lowUsd,
      });
    }
  }

  const result = {
    tether: tetherSnapshot,
    gold,
    fiat,
    crypto,
    usdtMedian,
    tehranNow: tehran(),
    fetchedAt: nowSec(),
    ageSec: 0,
  };

  // Cache result
  await cacheSet(CACHE_KEY_MARKET, result, CACHE_TTL_SEC);
  await cacheSet(CACHE_KEY_FALLBACK, result, 6 * 3600);

  return result;
}
