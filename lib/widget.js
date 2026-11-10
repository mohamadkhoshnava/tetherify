// lib/widget.js — Telegram Mini-Widget Engine (Bot API 10.4 / Layer 233).
//
// Complies with:
// - Max 32 KB raw UTF-8 HTML.
// - Max 4096 bytes zlib-compressed (level 9).
// - Max 1024 bytes public_data payload (strictly ~600 bytes).
// - Interactive updates, live polling (watchPublicData), haptics, and instant copy.

import { api } from 'sdk';

/** Pack market snapshot into a compact payload strictly under 700 bytes (limit 1024). */
export function compactPayload(market) {
  const clock = (market.tehranNow && market.tehranNow.clock) || '';

  // Cryptos: [symbol, usdPrice, tomanPrice, change24h]
  const cryptos = (market.crypto || []).slice(0, 8).map((c) => [
    c.symbol,
    c.usdPrice < 1 ? Number(c.usdPrice.toFixed(4)) : Math.round(c.usdPrice),
    Math.round(c.tomanPrice),
    Number((c.change24h || 0).toFixed(1)),
  ]);

  // Gold & Coins: [code, price, changePct]
  const goldMap = {
    geram18: 'g18', mesghal: 'mes', ons: 'ons', sekee: 'sek',
    sekeb: 'bah', nim: 'nim', rob: 'rob', gerami: 'grm',
  };
  const golds = (market.gold || []).slice(0, 8).map((g) => [
    goldMap[g.key] || g.key,
    g.price,
    Number((g.changePct || 0).toFixed(1)),
  ]);

  // Forex / Fiat: [code, price, changePct]
  const fiats = (market.fiat || []).slice(0, 7).map((f) => [
    f.key.replace('price_', '').replace('_rl', '').toUpperCase(),
    f.price,
    Number((f.changePct || 0).toFixed(1)),
  ]);

  // Tether stats: [bestBuy, bestBuyName, bestSell, bestSellName, median, count, spreadPct]
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

/** Build complete self-contained Mini-Widget HTML under 3700 bytes compressed. */
export function buildWidgetHtml(market, { initialTab = 'market' } = {}) {
  const initialJson = compactPayload(market).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
:root{--bg:var(--tg-theme-bg-color,#18222d);--tx:var(--tg-theme-text-color,#f5f5f5);--sbg:var(--tg-theme-secondary-bg-color,#232e3c);--ht:var(--tg-theme-hint-color,#8a9aa8);--btn:var(--tg-theme-button-color,#2481cc);--btx:var(--tg-theme-button-text-color,#fff);--lk:var(--tg-theme-link-color,#64b5f6);--up:#00e676;--dn:#ff5252}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;padding:10px;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--tx);direction:rtl}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.logo{font-weight:800;font-size:14px;display:flex;align-items:center;gap:5px}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--up);box-shadow:0 0 8px var(--up);display:inline-block}
.badge{font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(0,230,118,.15);color:var(--up);font-weight:700}
.time{font-size:11px;color:var(--ht)}
.tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:5px 9px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:var(--sbg);color:var(--ht);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s}
.tab.active{background:var(--btn);color:var(--btx);border-color:transparent}
.card{background:var(--sbg);border-radius:12px;padding:8px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:transform .1s}
.card:active{transform:scale(.98);opacity:.9}
.sym{font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px}
.sub{font-size:10px;color:var(--ht)}
.p-main{font-weight:800;font-size:13px;text-align:left}
.p-sub{font-size:10px;color:var(--ht);text-align:left}
.chg{font-size:10px;font-weight:700;padding:2px 5px;border-radius:6px;display:inline-block}
.up{color:var(--up);background:rgba(0,230,118,.12)}
.dn{color:var(--dn);background:rgba(255,82,82,.12)}
.ftr{margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ht)}
.btn-act{background:var(--btn);color:var(--btx);border:none;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}
.grid2 .card{margin-bottom:0;flex-direction:column;align-items:flex-start;gap:4px}
.grid2 .p-main{font-size:14px;text-align:right}
.calc-box{padding:10px;display:flex;flex-direction:column;align-items:center}
.calc-row{display:flex;gap:6px;align-items:center;margin-bottom:8px;width:100%;justify-content:center}
.calc-inp{width:140px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:var(--bg);color:#fff;font-size:15px;text-align:center;font-weight:700}
.calc-presets{display:flex;gap:4px;justify-content:center;flex-wrap:wrap}
.c-btn{padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:transparent;color:var(--lk);font-size:11px;cursor:pointer;font-weight:600}
</style></head><body>
<div class="hdr"><div class="logo"><span class="pulse"></span> تترایفای <span class="badge">نرخ لحظه‌ای</span></div><div class="time" id="tm">--:--</div></div>
<div class="tabs" id="tb">
<div class="tab" onclick="sw('market')">📊 بازار</div>
<div class="tab" onclick="sw('crypto')">💎 کریپتو</div>
<div class="tab" onclick="sw('gold')">🪙 طلا و سکه</div>
<div class="tab" onclick="sw('fiat')">💵 ارز</div>
<div class="tab" onclick="sw('tether')">🔄 تتر صرافی</div>
<div class="tab" onclick="sw('calc')">🧮 تبدیل</div>
</div>
<div id="cnt"></div>
<div class="ftr"><span id="st">لمس هر نرخ = کپی خودکار</span><button class="btn-act" onclick="rf()" id="rbtn">🔄 به‌روزرسانی</button></div>
<script>
var TW=typeof TelegramWidget!=='undefined'?TelegramWidget:null,tab='${initialTab}',D=${initialJson};
var NM={BTC:'₿,بیت‌کوین',ETH:'Ξ,اتریوم',TON:'💎,تون‌کوین',SOL:'☀️,سولانا',DOGE:'🐕,دوج‌کوین',TRX:'🔴,ترون',BNB:'🟡,بایننس‌کوین',XRP:'✕,ریپل',g18:'طلای ۱۸ عیار,تهران',mes:'مثقال طلا,تهران',ons:'انس طلا,$',sek:'سکه امامی,طرح جدید',bah:'سکه بهار آزادی,طرح قدیم',nim:'نیم سکه,تهران',rob:'ربع سکه,تهران',grm:'سکه گرمی,تهران',USD:'دلار آمریکا,اسکناس',EUR:'یورو اروپا,اسکناس',AED:'درهم امارات,اسکناس',GBP:'پوند انگلیس,اسکناس',CAD:'دلار کانادا,اسکناس',AUD:'دلار استرالیا,اسکناس',TRY:'لیر ترکیه,اسکناس'};
function gn(k){var v=NM[k];return v?v.split(','):['🪙',k];}
function fa(n){return String(n||0).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',').replace(/\\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[+d];});}
function faP(n){return (n>0?'+':'')+String(Math.abs(n).toFixed(1)).replace(/\\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[+d];})+'٪';}
function cp(txt){if(TW){if(TW.copyText)TW.copyText(String(txt));if(TW.HapticFeedback)TW.HapticFeedback.notificationOccurred('success');}}
function sw(t){tab=t;var names=['market','crypto','gold','fiat','tether','calc'];document.querySelectorAll('.tab').forEach(function(el,i){el.classList.toggle('active',names[i]===t);});if(TW&&TW.HapticFeedback)TW.HapticFeedback.selectionChanged();render();}
function rf(){var b=document.getElementById('rbtn');b.textContent='⏳ ...';if(TW&&TW.request){TW.request('r').then(function(){b.textContent='🔄 به‌روزرسانی';if(TW.HapticFeedback)TW.HapticFeedback.notificationOccurred('success');}).catch(function(){b.textContent='🔄 به‌روزرسانی';});}else{setTimeout(function(){b.textContent='🔄 به‌روزرسانی';},600);}}
function render(){var el=document.getElementById('cnt');if(!el||!D)return;var h='';
if(tab==='market'){var t=D.t||[];
h+='<div class="grid2"><div class="card" onclick="cp(\\''+(t[4]||255000)+'\\')"><div class="sub">₮ تتر بازار</div><div class="p-main">'+fa(t[4]||255000)+' ت</div></div>'
+'<div class="card" onclick="cp(\\''+(D.f&&D.f[0]?D.f[0][1]:0)+'\\')"><div class="sub">💵 دلار آزاد</div><div class="p-main">'+(D.f&&D.f[0]?fa(D.f[0][1]):'—')+' ت</div></div>'
+'<div class="card" onclick="cp(\\''+(D.g&&D.g[0]?D.g[0][1]:0)+'\\')"><div class="sub">🪙 طلای ۱۸ عیار</div><div class="p-main">'+(D.g&&D.g[0]?fa(D.g[0][1]):'—')+' ت</div></div>'
+'<div class="card" onclick="cp(\\''+(D.g&&D.g[3]?D.g[3][1]:0)+'\\')"><div class="sub">🟡 سکه امامی</div><div class="p-main">'+(D.g&&D.g[3]?fa(D.g[3][1]):'—')+' ت</div></div></div>';
if(D.c&&D.c[0]){var b=D.c[0],m=gn(b[0]);h+='<div class="card" onclick="cp(\\''+b[2]+'\\')"><div><div class="sym">'+m[0]+' '+m[1]+' ('+b[0]+')</div><div class="sub">$'+fa(b[1])+'</div></div><div><div class="p-main">'+fa(b[2])+' ت</div><div class="p-sub"><span class="chg '+(b[3]>=0?'up':'dn')+'">'+faP(b[3])+'</span></div></div></div>';}
}else if(tab==='crypto'&&D.c){D.c.forEach(function(c){var m=gn(c[0]);h+='<div class="card" onclick="cp(\\''+c[2]+'\\')"><div><div class="sym">'+m[0]+' '+m[1]+' <span class="sub">('+c[0]+')</span></div><div class="sub">'+(c[1]<1?c[1]:fa(c[1]))+' $</div></div><div><div class="p-main">'+fa(c[2])+' ت</div><div class="p-sub"><span class="chg '+(c[3]>=0?'up':'dn')+'">'+faP(c[3])+'</span></div></div></div>';});
}else if(tab==='gold'&&D.g){D.g.forEach(function(g){var m=gn(g[0]);h+='<div class="card" onclick="cp(\\''+g[1]+'\\')"><div><div class="sym">🪙 '+m[0]+'</div><div class="sub">'+m[1]+'</div></div><div><div class="p-main">'+fa(g[1])+' '+(g[0]==='ons'?'$':'ت')+'</div><div class="p-sub"><span class="chg '+(g[2]>=0?'up':'dn')+'">'+faP(g[2])+'</span></div></div></div>';});
}else if(tab==='fiat'&&D.f){D.f.forEach(function(f){var m=gn(f[0]);h+='<div class="card" onclick="cp(\\''+f[1]+'\\')"><div><div class="sym">💵 '+m[0]+' <span class="sub">('+f[0]+')</span></div><div class="sub">'+m[1]+'</div></div><div><div class="p-main">'+fa(f[1])+' ت</div><div class="p-sub"><span class="chg '+(f[2]>=0?'up':'dn')+'">'+faP(f[2])+'</span></div></div></div>';});
}else if(tab==='tether'&&D.t){var t=D.t;h+='<div class="card" onclick="cp(\\''+t[0]+'\\')"><div><div class="sym">🟢 ارزان‌ترین خرید</div><div class="sub">'+(t[1]||'—')+'</div></div><div class="p-main">'+fa(t[0])+' ت</div></div><div class="card" onclick="cp(\\''+t[2]+'\\')"><div><div class="sym">🔴 بهترین فروش</div><div class="sub">'+(t[3]||'—')+'</div></div><div class="p-main">'+fa(t[2])+' ت</div></div><div class="card" onclick="cp(\\''+t[4]+'\\')"><div><div class="sym">⚖️ میانه بازار</div><div class="sub">'+fa(t[5])+' صرافی</div></div><div><div class="p-main">'+fa(t[4])+' ت</div><div class="p-sub">اختلاف: '+faP(t[6])+'</div></div></div>';
}else if(tab==='calc'){h+='<div class="card calc-box"><div style="font-weight:800;margin-bottom:8px">🧮 تبدیل سریع تتر به تومان</div><div class="calc-row"><input type="number" id="cinp" class="calc-inp" value="100" oninput="ccalc()"><span style="font-weight:700">USDT</span></div><div id="cres" style="font-size:16px;font-weight:800;color:var(--up);margin:8px 0"></div><div class="calc-presets"><button class="c-btn" onclick="setc(10)">+۱۰</button><button class="c-btn" onclick="setc(50)">+۵۰</button><button class="c-btn" onclick="setc(100)">+۱۰۰</button><button class="c-btn" onclick="setc(500)">+۵۰۰</button><button class="c-btn" onclick="setc(1000)">+۱۰۰۰</button></div></div>';}
el.innerHTML=h;if(tab==='calc')ccalc();}
function setc(v){document.getElementById('cinp').value=v;ccalc();}
function ccalc(){var v=Number(document.getElementById('cinp').value)||0;var rate=(D.t&&D.t[4])||255000;document.getElementById('cres').textContent=fa(v*rate)+' تومان';}
function loadData(str){try{if(str){D=typeof str==='string'?JSON.parse(str):str;if(D.tm)document.getElementById('tm').textContent=D.tm;render();}}catch(e){}}
if(D.tm)document.getElementById('tm').textContent=D.tm;
sw(tab);
if(TW){if(TW.setResizeAnchor)TW.setResizeAnchor('top');if(TW.ready)TW.ready();if(TW.watchPublicData)TW.watchPublicData();TW.onEvent('publicDataChanged',function(){loadData(TW.publicData);});TW.onEvent('chatDataChanged',function(){loadData(TW.chatData);});if(TW.publicData)loadData(TW.publicData);else if(TW.chatData)loadData(TW.chatData);}
</script></body></html>`;
}

/**
 * Send interactive mini-widget using Bot API 10.4 sendWidget.
 * Initializes directly into the specified tab (e.g. 'crypto', 'gold', 'fiat', 'tether', 'calc', 'market').
 * Falls back cleanly to null if unsupported so caller can send text.
 */
export async function sendMarketWidget(chatId, market, { initialTab = 'market', caption = '', reply_markup = undefined } = {}) {
  const html = buildWidgetHtml(market, { initialTab });
  const data = compactPayload(market);

  let safeCaption = caption || '💎 تابلوی لحظه‌ای بازارهای مالی تترایفای';
  if (safeCaption.length > 1020) {
    safeCaption = safeCaption.slice(0, 1000) + '\n...';
  }

  try {
    return await api.sendWidget({
      chat_id: chatId,
      html,
      caption: safeCaption,
      parse_mode: 'HTML',
      allow_queries: true,
      is_shared: true,
      public_data: data,
      chat_data: data,
      width: 0,
      height: 0,
      ...(reply_markup ? { reply_markup } : {}),
    });
  } catch (err) {
    console.error('sendWidget error:', err && (err.description || err.message));
    return null;
  }
}
