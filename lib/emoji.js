// lib/emoji.js — Verified Premium Telegram Custom Emojis from user packs.
// Supports both HTML (<tg-emoji>) and button icon_custom_emoji_id.

export const EMOJI_ID = {
  // FinanceEmoji pack
  STAR: '5267500801240092311',
  DOLLAR: '5197434882321567830',
  EURO: '5197369495739455200',
  POUND: '5377775044342599336',
  CHART_UP: '5197503331215361533',
  CHART_DOWN: '5429518319243775957',
  BAR_CHART: '5190806721286657692',
  SCALE: '5400250414929041085',
  CALC: '5303214794336125778',
  BANK: '5332455502917949981',
  BAG: '5287231198098117669',
  ROCKET: '5195033767969839232',
  SHIELD: '5197288647275071607',
  EXCHANGE: '5312441427764989435',

  // TONEmoji pack
  COIN: '5382164415019768638',
  DIAMOND: '5462902520215002477',
  TARGET: '5461009483314517035',
  TROPHY: '5188344996356448758',
  CHANNEL: '5298609030321691620',

  // Emoji_Watcj pack
  WATCH: '5368295871131695793',
  STOPWATCH: '5372891262800115176',
  CHECK: '5368605164611581252',

  // iranNewz pack (avoiding 5938447634304867032 as requested)
  BULLET: '5938304994145998707',
  FLAG_IR: '5839091511601403230',
  GLOBE: '5998861151096544852',
};

export const EMOJI = {
  DOLLAR: `<tg-emoji emoji-id="${EMOJI_ID.DOLLAR}">💵</tg-emoji>`,
  EURO: `<tg-emoji emoji-id="${EMOJI_ID.EURO}">💶</tg-emoji>`,
  POUND: `<tg-emoji emoji-id="${EMOJI_ID.POUND}">💷</tg-emoji>`,
  CHART_UP: `<tg-emoji emoji-id="${EMOJI_ID.CHART_UP}">📈</tg-emoji>`,
  CHART_DOWN: `<tg-emoji emoji-id="${EMOJI_ID.CHART_DOWN}">📉</tg-emoji>`,
  BAR_CHART: `<tg-emoji emoji-id="${EMOJI_ID.BAR_CHART}">📊</tg-emoji>`,
  SCALE: `<tg-emoji emoji-id="${EMOJI_ID.SCALE}">⚖️</tg-emoji>`,
  CALC: `<tg-emoji emoji-id="${EMOJI_ID.CALC}">🧮</tg-emoji>`,
  BANK: `<tg-emoji emoji-id="${EMOJI_ID.BANK}">🏦</tg-emoji>`,
  BAG: `<tg-emoji emoji-id="${EMOJI_ID.BAG}">💰</tg-emoji>`,
  STAR: `<tg-emoji emoji-id="${EMOJI_ID.STAR}">⭐</tg-emoji>`,
  ROCKET: `<tg-emoji emoji-id="${EMOJI_ID.ROCKET}">🚀</tg-emoji>`,
  SHIELD: `<tg-emoji emoji-id="${EMOJI_ID.SHIELD}">🛡</tg-emoji>`,
  EXCHANGE: `<tg-emoji emoji-id="${EMOJI_ID.EXCHANGE}">💱</tg-emoji>`,
  COIN: `<tg-emoji emoji-id="${EMOJI_ID.COIN}">🪙</tg-emoji>`,
  DIAMOND: `<tg-emoji emoji-id="${EMOJI_ID.DIAMOND}">💎</tg-emoji>`,
  TARGET: `<tg-emoji emoji-id="${EMOJI_ID.TARGET}">🎯</tg-emoji>`,
  TROPHY: `<tg-emoji emoji-id="${EMOJI_ID.TROPHY}">🏆</tg-emoji>`,
  ALERT: `<tg-emoji emoji-id="${EMOJI_ID.WATCH}">⏰</tg-emoji>`,
  WATCH: `<tg-emoji emoji-id="${EMOJI_ID.WATCH}">⏰</tg-emoji>`,
  STOPWATCH: `<tg-emoji emoji-id="${EMOJI_ID.STOPWATCH}">⏱</tg-emoji>`,
  CHECK: `<tg-emoji emoji-id="${EMOJI_ID.CHECK}">✅</tg-emoji>`,
  BULLET: `<tg-emoji emoji-id="${EMOJI_ID.BULLET}">🔸</tg-emoji>`,
  FLAG_IR: `<tg-emoji emoji-id="${EMOJI_ID.FLAG_IR}">🇮🇷</tg-emoji>`,
  GLOBE: `<tg-emoji emoji-id="${EMOJI_ID.GLOBE}">🌐</tg-emoji>`,
  SPARKLE: `<tg-emoji emoji-id="${EMOJI_ID.STAR}">⭐</tg-emoji>`,
};
