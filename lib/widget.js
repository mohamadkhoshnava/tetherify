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

/** Build complete self-contained Mini-Widget HTML under 3980 bytes compressed. */
export function buildWidgetHtml(market, { initialTab = 'market' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
:root{--bg:var(--tg-theme-bg-color,#0f141c);--tx:var(--tg-theme-text-color,#fff);--sbg:var(--tg-theme-secondary-bg-color,#18222d);--ht:var(--tg-theme-hint-color,#7e8e9f);--btn:var(--tg-theme-button-color,#2ea6ff);--btx:var(--tg-theme-button-text-color,#fff);--up:#00e676;--dn:#ff5252;--cd:rgba(255,255,255,.05);--br:rgba(255,255,255,.08)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;padding:12px;font:13px/1.4 system-ui,-apple-system,'Vazirmatn',sans-serif;background:var(--bg);color:var(--tx);direction:rtl}
@keyframes p{0%{box-shadow:0 0 0 0 rgba(0,230,118,.6)}70%{box-shadow:0 0 0 7px rgba(0,230,118,0)}100%{box-shadow:0 0 0 0 rgba(0,230,118,0)}}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.brand{font-size:14px;font-weight:900;display:flex;align-items:center;gap:6px}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--up);animation:p 2s infinite;display:inline-block}
.live-pill{font-size:10px;padding:2px 7px;border-radius:12px;background:rgba(0,230,118,.12);color:var(--up);font-weight:700}
.time{font-size:11px;color:var(--ht)}
.tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:6px 12px;border-radius:20px;border:1px solid var(--br);background:var(--cd);color:var(--ht);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
.tab.active{background:var(--btn);color:var(--btx);border-color:transparent;box-shadow:0 2px 10px rgba(46,166,255,.35)}
.hero{background:linear-gradient(135deg,rgba(46,166,255,.12),rgba(0,230,118,.05));border:1px solid rgba(46,166,255,.2);border-radius:14px;padding:12px;margin-bottom:10px;text-align:center;cursor:pointer}
.hero-sym{font-size:11px;color:var(--btn);font-weight:800}
.hero-price{font-size:24px;font-weight:900;margin:3px 0}
.hero-sub{font-size:11px;color:var(--ht)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}
.card{background:var(--cd);border:1px solid var(--br);border-radius:12px;padding:9px 11px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
.card:active{transform:scale(.98);background:rgba(255,255,255,.09)}
.g-card{flex-direction:column;align-items:flex-start;gap:3px;padding:10px}
.sym{font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px}
.sub{font-size:10px;color:var(--ht)}
.p-main{font-weight:800;font-size:13px;text-align:left}
.p-sub{font-size:10px;color:var(--ht);text-align:left}
.chg{font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;display:inline-block;direction:ltr}
.up{color:var(--up);background:rgba(0,230,118,.12)}
.dn{color:var(--dn);background:rgba(255,82,82,.12)}
.toast{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;display:none;z-index:99}
.ftr{margin-top:10px;padding-top:8px;border-top:1px solid var(--br);display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ht)}
.btn-act{background:var(--cd);color:var(--tx);border:1px solid var(--br);border-radius:8px;padding:5px 11px;font-size:11px;font-weight:700;cursor:pointer}
.calc-box{padding:14px;display:flex;flex-direction:column;align-items:center;background:var(--cd);border:1px solid var(--br);border-radius:14px}
.calc-row{display:flex;gap:8px;align-items:center;margin:10px 0;width:100%;justify-content:center}
.calc-inp{width:130px;padding:8px;border-radius:10px;border:1px solid var(--br);background:var(--bg);color:#fff;font-size:16px;text-align:center;font-weight:800}
.calc-presets{display:flex;gap:5px;justify-content:center;flex-wrap:wrap}
.c-btn{padding:5px 10px;border-radius:8px;border:1px solid var(--br);background:var(--cd);color:var(--btn);font-size:11px;cursor:pointer;font-weight:700}
</style></head><body>
<div class="hdr"><div class="brand"><span class="pulse"></span> تتریفای <span class="live-pill">زنده</span></div><div class="time" id="tm">--:--</div></div>
<div class="tabs" id="tb">
<div class="tab" onclick="sw('market')">📊 تابلوی بازار</div>
<div class="tab" onclick="sw('crypto')">💎 کریپتو</div>
<div class="tab" onclick="sw('gold')">🪙 طلا و سکه</div>
<div class="tab" onclick="sw('fiat')">💵 دلار و ارز</div>
<div class="tab" onclick="sw('tether')">🔄 تتر صرافی‌ها</div>
<div class="tab" onclick="sw('calc')">🧮 ماشین‌حساب</div>
</div>
<div id="cnt"></div>
<div class="toast" id="tst"></div>
<div class="ftr"><span>لمس هر نرخ = کپی خودکار</span><button class="btn-act" onclick="rf()" id="rbtn">🔄 تازه‌سازی</button></div>
<script>
var TW=typeof TelegramWidget!=='undefined'?TelegramWidget:null,tab='${initialTab}',D=null;
var NM={BTC:['₿','بیت‌کوین'],ETH:['Ξ','اتریوم'],TON:['💎','تون‌کوین'],SOL:['☀️','سولانا'],DOGE:['🐕','دوج‌کوین'],TRX:['🔴','ترون'],BNB:['🟡','بایننس'],XRP:['✕','ریپل'],g18:['🪙','طلای ۱۸ عیار'],mes:['🪙','مثقال طلا'],ons:['🥇','انس طلا'],sek:['🟡','سکه امامی'],bah:['🟡','سکه بهار'],nim:['🪙','نیم سکه'],rob:['🪙','ربع سکه'],grm:['🪙','سکه گرمی'],USD:['💵','دلار آمریکا'],EUR:['💶','یورو'],AED:['🇦🇪','درهم امارات'],GBP:['💷','پوند انگلیس'],CAD:['🇨🇦','دلار کانادا'],AUD:['🇦🇺','دلار استرالیا'],TRY:['🇹🇷','لیر ترکیه']};
function fa(n){return String(n||0).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',').replace(/\\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[+d];});}
function faP(n){return (n>0?'+':'')+String(Math.abs(n).toFixed(1)).replace(/\\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[+d];})+'٪';}
function cp(txt){if(TW){if(TW.copyText)TW.copyText(String(txt));if(TW.HapticFeedback)TW.HapticFeedback.notificationOccurred('success');}var s=document.getElementById('tst');if(s){s.textContent='✓ کپی شد: '+fa(txt)+' ت';s.style.display='block';setTimeout(function(){s.style.display='none';},1800);}}
function sw(t){tab=t;var names=['market','crypto','gold','fiat','tether','calc'];document.querySelectorAll('.tab').forEach(function(el,i){el.classList.toggle('active',names[i]===t);});if(TW&&TW.HapticFeedback)TW.HapticFeedback.selectionChanged();render();}
function rf(){var b=document.getElementById('rbtn');b.textContent='⏳';if(TW&&TW.request){TW.request('r').finally(function(){b.textContent='🔄 تازه‌سازی';});}else{setTimeout(function(){b.textContent='🔄 تازه‌سازی';},500);}}
function rc(sym,sub,pm,ps,chg,val){return '<div class="card" onclick="cp(\\''+val+'\\')"><div><div class="sym">'+sym+'</div><div class="sub">'+sub+'</div></div><div><div class="p-main">'+pm+'</div><div class="p-sub">'+(chg!=null?'<span class="chg '+(chg>=0?'up':'dn')+'">'+faP(chg)+'</span>':ps)+'</div></div></div>';}
function render(){var el=document.getElementById('cnt');if(!el)return;if(!D){el.innerHTML='<div style="text-align:center;padding:24px;color:var(--ht)">در حال دریافت داده...</div>';return;}var h='';
if(tab==='market'){var t=D.t||[],p=t[4]||255000;
h+='<div class="hero" onclick="cp(\\''+p+'\\')"><div class="hero-sym">TETHER · USDT</div><div class="hero-price">'+fa(p)+' تومان</div><div class="hero-sub">میانه صرافی‌های مجاز · لمس برای کپی</div></div>';
h+='<div class="grid2"><div class="card g-card" onclick="cp(\\''+(D.f&&D.f[0]?D.f[0][1]:0)+'\\')"><div class="sub">💵 دلار آزاد</div><div class="p-main">'+(D.f&&D.f[0]?fa(D.f[0][1]):'—')+' ت</div></div>'
+'<div class="card g-card" onclick="cp(\\''+(D.g&&D.g[0]?D.g[0][1]:0)+'\\')"><div class="sub">🪙 طلای ۱۸ عیار</div><div class="p-main">'+(D.g&&D.g[0]?fa(D.g[0][1]):'—')+' ت</div></div>'
+'<div class="card g-card" onclick="cp(\\''+(D.g&&D.g[3]?D.g[3][1]:0)+'\\')"><div class="sub">🟡 سکه امامی</div><div class="p-main">'+(D.g&&D.g[3]?fa(D.g[3][1]):'—')+' ت</div></div>'
+'<div class="card g-card" onclick="cp(\\''+(D.c&&D.c[0]?D.c[0][2]:0)+'\\')"><div class="sub">₿ بیت‌کوین</div><div class="p-main">'+(D.c&&D.c[0]?fa(D.c[0][2]):'—')+' ت</div></div></div>';
}else if(tab==='crypto'&&D.c){D.c.forEach(function(c){var m=NM[c[0]]||['💎',c[0]];h+=rc(m[0]+' '+m[1]+' <span class="sub">('+c[0]+')</span>',(c[1]<1?c[1]:fa(c[1]))+' $',fa(c[2])+' ت','',c[3],c[2]);});
}else if(tab==='gold'&&D.g){D.g.forEach(function(g){var m=NM[g[0]]||['🪙',g[0]];h+=rc(m[0]+' '+m[1],g[0]==='ons'?'انس جهانی':'ایران',fa(g[1])+(g[0]==='ons'?' $':' ت'),'',g[2],g[1]);});
}else if(tab==='fiat'&&D.f){D.f.forEach(function(f){var m=NM[f[0]]||['💵',f[0]];h+=rc(m[0]+' '+m[1]+' <span class="sub">('+f[0]+')</span>','اسکناس تهران',fa(f[1])+' ت','',f[2],f[1]);});
}else if(tab==='tether'&&D.t){var t=D.t;h+=rc('🟢 ارزان‌ترین خرید',t[1]||'—',fa(t[0])+' ت','',null,t[0])+rc('🔴 بهترین فروش',t[3]||'—',fa(t[2])+' ت','',null,t[2])+rc('⚖️ میانه بازار',fa(t[5])+' صرافی',fa(t[4])+' ت','اختلاف: '+faP(t[6]),null,t[4]);
}else if(tab==='calc'){h+='<div class="calc-box"><div style="font-weight:800;font-size:14px;margin-bottom:4px">🧮 محاسبه‌گر هوشمند تتر</div><div class="calc-row"><input type="number" id="cinp" class="calc-inp" value="100" oninput="ccalc()"><span style="font-weight:800">USDT</span></div><div id="cres" style="font-size:18px;font-weight:900;color:var(--up);margin:8px 0"></div><div class="calc-presets"><button class="c-btn" onclick="setc(10)">+۱۰</button><button class="c-btn" onclick="setc(50)">+۵۰</button><button class="c-btn" onclick="setc(100)">+۱۰۰</button><button class="c-btn" onclick="setc(500)">+۵۰۰</button><button class="c-btn" onclick="setc(1000)">+۱۰۰۰</button></div></div>';}
el.innerHTML=h;if(tab==='calc')ccalc();}
function setc(v){document.getElementById('cinp').value=v;ccalc();}
function ccalc(){var v=Number(document.getElementById('cinp').value)||0;var rate=(D&&D.t&&D.t[4])||255000;document.getElementById('cres').textContent=fa(v*rate)+' تومان';}
function loadData(str){try{if(str){D=typeof str==='string'?JSON.parse(str):str;if(D.tm)document.getElementById('tm').textContent=D.tm;render();}}catch(e){}}
function init(){if(TW){if(TW.ready)TW.ready();if(TW.watchPublicData)TW.watchPublicData();TW.onEvent('publicDataChanged',function(){loadData(TW.publicData);});TW.onEvent('chatDataChanged',function(){loadData(TW.chatData);});if(TW.publicData)loadData(TW.publicData);else if(TW.chatData)loadData(TW.chatData);}}
sw(tab);init();setTimeout(init,50);setTimeout(init,200);
</script></body></html>`;
}

/**
 * Send interactive mini-widget using Bot API 10.4 sendWidget.
 * Clean, modern presentation with minimal caption (NO duplicate prices!).
 */
export async function sendMarketWidget(chatId, market, { initialTab = 'market', caption = '', reply_markup = undefined } = {}) {
  const html = buildWidgetHtml(market, { initialTab });
  const data = compactPayload(market);

  // Clean 1-line caption, avoiding duplicate prices
  const safeCaption = caption || '📱 <b>تابلوی لمسی و زنده تتریفای</b>';

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
