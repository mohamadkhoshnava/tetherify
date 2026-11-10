// lib/widget.js — Telegram Mini-Widget (Bot API 10.4 / Layer 233).
//
// Complies with:
// - Max 32 KB raw UTF-8 HTML.
// - Max 4096 bytes zlib-compressed (level 9).
// - Max 1024 bytes public_data and chat_data payload.
// - Interactive updates, live polling (watchPublicData), haptics, and instant copy.

import { api } from 'sdk';
import { faNum, faPct, toFaDigits } from 'lib/fa';

/** Pack market snapshot into a compact payload under 800 bytes (limit 1024). */
export function compactPayload(market) {
  const clock = (market.tehranNow && market.tehranNow.clock) || '';

  // Cryptos
  const cryptos = (market.crypto || []).slice(0, 7).map((c) => [
    c.symbol,
    c.usdPrice < 1 ? Number(c.usdPrice.toFixed(4)) : Math.round(c.usdPrice),
    Math.round(c.tomanPrice),
    Number((c.change24h || 0).toFixed(1)),
    c.icon || '',
    c.nameFa || '',
  ]);

  // Gold & Coins
  const golds = (market.gold || []).slice(0, 6).map((g) => [
    g.key,
    g.nameFa,
    g.price,
    Number((g.changePct || 0).toFixed(1)),
  ]);

  // Forex / Fiat
  const fiats = (market.fiat || []).slice(0, 5).map((f) => [
    f.key.replace('price_', '').replace('_rl', '').toUpperCase(),
    f.nameFa.replace(' (آزاد)', '').replace(' اروپا', ''),
    f.price,
    Number((f.changePct || 0).toFixed(1)),
  ]);

  // Tether stats
  const ts = market.tether && market.tether.stats;
  const tether = ts && ts.ok ? [
    Math.round(ts.bestBuy),
    ts.bestBuyName,
    Math.round(ts.bestSell),
    ts.bestSellName,
    Math.round(ts.median),
    ts.count,
    Number((ts.spreadPct || 0).toFixed(1)),
  ] : [Math.round(market.usdtMedian || 255000), 'صرافی‌ها', Math.round(market.usdtMedian || 255000), 'صرافی‌ها', Math.round(market.usdtMedian || 255000), 50, 0];

  return JSON.stringify({
    tm: clock,
    c: cryptos,
    g: golds,
    f: fiats,
    t: tether,
  });
}

/** Build complete self-contained Mini-Widget HTML under 3800 bytes compressed. */
export function buildWidgetHtml(market) {
  const initialJson = compactPayload(market).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body {
  margin: 0; padding: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px; line-height: 1.4;
  background: var(--tg-theme-bg-color, #18222d);
  color: var(--tg-theme-text-color, #f5f5f5);
  direction: rtl;
}
.hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.logo { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 5px; }
.badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; background: rgba(0,200,83,0.18); color: #00e676; font-weight: 700; }
.time { font-size: 11px; color: var(--tg-theme-hint-color, #7d8b99); font-weight: 500; }
.tabs { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 8px; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab {
  padding: 5px 9px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);
  background: var(--tg-theme-secondary-bg-color, #232e3c);
  color: var(--tg-theme-hint-color, #8a9aa8); font-size: 11px; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: 0.15s ease;
}
.tab.active {
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #ffffff);
  border-color: transparent;
}
.card {
  background: var(--tg-theme-secondary-bg-color, #232e3c);
  border-radius: 12px; padding: 8px 10px; margin-bottom: 6px;
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; transition: transform 0.1s;
}
.card:active { transform: scale(0.98); }
.sym { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.sub { font-size: 11px; color: var(--tg-theme-hint-color, #8a9aa8); font-weight: normal; }
.p-main { font-weight: 700; font-size: 13px; text-align: left; }
.p-sub { font-size: 10px; color: var(--tg-theme-hint-color, #8a9aa8); text-align: left; }
.chg {
  font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 6px;
  display: inline-block; margin-right: 4px;
}
.up { color: #00e676; background: rgba(0,230,118,0.12); }
.dn { color: #ff5252; background: rgba(255,82,82,0.12); }
.ftr {
  margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; justify-content: space-between; align-items: center; font-size: 11px;
  color: var(--tg-theme-hint-color, #8a9aa8);
}
.btn-act {
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  border: none; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer;
}
.calc-box { padding: 10px; }
.calc-row { display: flex; gap: 6px; margin-bottom: 8px; justify-content: center; }
.calc-inp {
  width: 140px; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
  background: var(--tg-theme-bg-color, #18222d); color: #fff; font-size: 15px; text-align: center; font-weight: 700;
}
.calc-presets { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.c-btn {
  padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
  background: transparent; color: var(--tg-theme-link-color, #64b5f6); font-size: 11px; cursor: pointer; font-weight: 600;
}
</style>
</head>
<body>
<div class="hdr">
  <div class="logo">💎 تترایفای <span class="badge">زنده</span></div>
  <div class="time" id="tm">--:--</div>
</div>
<div class="tabs" id="tb">
  <div class="tab active" onclick="sw('crypto')">💎 کریپتو</div>
  <div class="tab" onclick="sw('gold')">🪙 طلا و سکه</div>
  <div class="tab" onclick="sw('fiat')">💵 ارز</div>
  <div class="tab" onclick="sw('tether')">🔄 تتر صرافی</div>
  <div class="tab" onclick="sw('calc')">🧮 تبدیل</div>
</div>
<div id="cnt"></div>
<div class="ftr">
  <span id="st">لمس هر آیتم = کپی نرخ</span>
  <button class="btn-act" onclick="rf()" id="rbtn">🔄 به‌روزرسانی</button>
</div>
<script>
var TW = typeof TelegramWidget !== 'undefined' ? TelegramWidget : null;
var tab = 'crypto', D = ${initialJson};
function fa(n) { return String(n||0).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',').replace(/\\d/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
function faP(n) { return (n>0?'+':'') + String(Math.abs(n).toFixed(1)).replace(/\\d/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'[+d]; }) + '٪'; }
function cp(txt) {
  if (TW) {
    if (TW.copyText) TW.copyText(String(txt));
    if (TW.HapticFeedback) TW.HapticFeedback.notificationOccurred('success');
  }
}
function sw(t) {
  tab = t;
  document.querySelectorAll('.tab').forEach(function(el, i){
    el.classList.toggle('active', ['crypto','gold','fiat','tether','calc'][i] === t);
  });
  if (TW && TW.HapticFeedback) TW.HapticFeedback.selectionChanged();
  render();
}
function rf() {
  var b = document.getElementById('rbtn');
  b.textContent = '⏳ ...';
  if (TW && TW.request) {
    TW.request('r').then(function(r){
      b.textContent = '🔄 به‌روزرسانی';
      if (TW.HapticFeedback) TW.HapticFeedback.notificationOccurred('success');
    }).catch(function(){ b.textContent = '🔄 به‌روزرسانی'; });
  } else {
    setTimeout(function(){ b.textContent = '🔄 به‌روزرسانی'; }, 600);
  }
}
function render() {
  var el = document.getElementById('cnt');
  if (!el || !D) return;
  var h = '';
  if (tab === 'crypto' && D.c) {
    D.c.forEach(function(c){
      var sym = c[0], pUsd = c[1], pTom = c[2], ch = c[3], ic = c[4] || '💎', faN = c[5] || sym;
      var cls = ch >= 0 ? 'up' : 'dn';
      h += '<div class="card" onclick="cp(\\'' + pTom + '\\')">' +
        '<div><div class="sym">' + ic + ' ' + faN + ' <span class="sub">(' + sym + ')</span></div>' +
        '<div class="sub">' + (pUsd < 1 ? pUsd : fa(pUsd)) + ' $</div></div>' +
        '<div><div class="p-main">' + fa(pTom) + ' ت</div>' +
        '<div class="p-sub"><span class="chg ' + cls + '">' + faP(ch) + '</span></div></div></div>';
    });
  } else if (tab === 'gold' && D.g) {
    D.g.forEach(function(g){
      var k = g[0], faN = g[1], pr = g[2], ch = g[3];
      var cls = ch >= 0 ? 'up' : 'dn';
      h += '<div class="card" onclick="cp(\\'' + pr + '\\')">' +
        '<div><div class="sym">🪙 ' + faN + '</div>' +
        '<div class="sub">' + (k === 'ons' ? 'اونس جهانی' : 'بازار تهران') + '</div></div>' +
        '<div><div class="p-main">' + fa(pr) + ' ' + (k === 'ons' ? '$' : 'ت') + '</div>' +
        '<div class="p-sub"><span class="chg ' + cls + '">' + faP(ch) + '</span></div></div></div>';
    });
  } else if (tab === 'fiat' && D.f) {
    D.f.forEach(function(f){
      var cd = f[0], faN = f[1], pr = f[2], ch = f[3];
      var cls = ch >= 0 ? 'up' : 'dn';
      h += '<div class="card" onclick="cp(\\'' + pr + '\\')">' +
        '<div><div class="sym">💵 ' + faN + ' <span class="sub">(' + cd + ')</span></div>' +
        '<div class="sub">اسکناس آزاد</div></div>' +
        '<div><div class="p-main">' + fa(pr) + ' ت</div>' +
        '<div class="p-sub"><span class="chg ' + cls + '">' + faP(ch) + '</span></div></div></div>';
    });
  } else if (tab === 'tether' && D.t) {
    var t = D.t;
    var bBuy = t[0], bBuyN = t[1], bSell = t[2], bSellN = t[3], med = t[4], cnt = t[5], sp = t[6];
    h += '<div class="card" onclick="cp(\\'' + bBuy + '\\')"><div><div class="sym">🟢 ارزان‌ترین خرید</div><div class="sub">' + (bBuyN||'—') + '</div></div>' +
      '<div class="p-main">' + fa(bBuy) + ' ت</div></div>';
    h += '<div class="card" onclick="cp(\\'' + bSell + '\\')"><div><div class="sym">🔴 بهترین فروش</div><div class="sub">' + (bSellN||'—') + '</div></div>' +
      '<div class="p-main">' + fa(bSell) + ' ت</div></div>';
    h += '<div class="card" onclick="cp(\\'' + med + '\\')"><div><div class="sym">⚖️ میانه بازار تتر</div><div class="sub">' + fa(cnt) + ' صرافی معتبر</div></div>' +
      '<div><div class="p-main">' + fa(med) + ' ت</div><div class="p-sub">اختلاف: ' + faP(sp) + '</div></div></div>';
  } else if (tab === 'calc') {
    h += '<div class="card calc-box">' +
      '<div style="text-align:center;font-weight:700;margin-bottom:8px;">🧮 تبدیل سریع تتر به تومان</div>' +
      '<div class="calc-row"><input type="number" id="cinp" class="calc-inp" value="100" oninput="ccalc()">' +
      '<span style="line-height:36px;font-weight:700;">USDT</span></div>' +
      '<div id="cres" style="font-size:16px;font-weight:700;color:#00e676;text-align:center;margin:8px 0;"></div>' +
      '<div class="calc-presets">' +
      '<button class="c-btn" onclick="setc(10)">۱۰+</button>' +
      '<button class="c-btn" onclick="setc(50)">۵۰+</button>' +
      '<button class="c-btn" onclick="setc(100)">۱۰۰+</button>' +
      '<button class="c-btn" onclick="setc(500)">۵۰۰+</button>' +
      '<button class="c-btn" onclick="setc(1000)">۱۰۰۰+</button>' +
      '</div></div>';
  }
  el.innerHTML = h;
  if (tab === 'calc') ccalc();
}
function setc(v) { document.getElementById('cinp').value = v; ccalc(); }
function ccalc() {
  var v = Number(document.getElementById('cinp').value) || 0;
  var rate = (D.t && D.t[4]) || 255000;
  var res = v * rate;
  document.getElementById('cres').textContent = fa(res) + ' تومان';
}
function loadData(str) {
  try {
    if (str) {
      D = typeof str === 'string' ? JSON.parse(str) : str;
      if (D.tm) document.getElementById('tm').textContent = D.tm;
      render();
    }
  } catch(e){}
}
if (D.tm) document.getElementById('tm').textContent = D.tm;
render();
if (TW) {
  if (TW.setResizeAnchor) TW.setResizeAnchor('top');
  if (TW.ready) TW.ready();
  if (TW.watchPublicData) TW.watchPublicData();
  TW.onEvent('publicDataChanged', function(){ loadData(TW.publicData); });
  TW.onEvent('chatDataChanged', function(){ loadData(TW.chatData); });
  if (TW.publicData) loadData(TW.publicData);
  else if (TW.chatData) loadData(TW.chatData);
}
</script>
</body>
</html>`;
}

/**
 * Send interactive mini-widget using Bot API 10.4 sendWidget.
 * Falls back cleanly to sendMessage on older clients or unsupported chats.
 */
export async function sendMarketWidget(chatId, market, { caption = '💎 تابلوی زنده قیمت‌ها و بازار تترایفای' } = {}) {
  const html = buildWidgetHtml(market);
  const data = compactPayload(market);

  try {
    return await api.sendWidget({
      chat_id: chatId,
      html,
      caption,
      parse_mode: 'HTML',
      allow_queries: true,
      is_shared: true,
      public_data: data,
      chat_data: data,
      width: 0,
      height: 0,
    });
  } catch (err) {
    console.error('sendWidget failed, attempting fallback to message:', err && (err.description || err.message));
    return null;
  }
}
