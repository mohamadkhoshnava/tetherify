// lib/keyboard.js — inline keyboards. Callback payloads are kept terse because
// Telegram caps callback_data at 64 bytes.

import { CB } from 'lib/config';
import { toFaDigits } from 'lib/fa';

/** Bottom persistent Reply Keyboard buttons for private chat (PV). */
export const BTN = {
  MARKET: '📊 تابلوی بازار',
  CRYPTO: '💎 ارزهای دیجیتال',
  GOLD: '🪙 طلا و سکه',
  FIAT: '💵 دلار و ارزها',
  TETHER: '🔄 تتر صرافی‌ها',
  CALC: '🧮 ماشین‌حساب',
  TOP: '🏆 صرافی‌های برتر',
  CHART: '📈 روند هفته',
  ALERT: '🔔 تنظیم هشدار',
  HELP: 'ℹ️ راهنما',
};

export function pvReplyKeyboard() {
  return {
    keyboard: [
      [{ text: BTN.MARKET }, { text: BTN.CRYPTO }],
      [{ text: BTN.GOLD }, { text: BTN.FIAT }],
      [{ text: BTN.TETHER }, { text: BTN.CALC }],
      [{ text: BTN.TOP }, { text: BTN.CHART }],
      [{ text: BTN.ALERT }, { text: BTN.HELP }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 تابلوی جامع بازار', callback_data: CB.MARKET },
      ],
      [
        { text: '💎 ارزهای دیجیتال', callback_data: CB.CRYPTO },
        { text: '🪙 طلا و سکه', callback_data: CB.GOLD },
      ],
      [
        { text: '💵 ارز و اسکناس', callback_data: CB.FIAT },
        { text: '🔄 تتر صرافی‌ها', callback_data: CB.REFRESH },
      ],
      [
        { text: '📋 صرافی‌ها', callback_data: `${CB.LIST}:0` },
        { text: '🏆 بهترین‌ها', callback_data: CB.TOP },
      ],
      [
        { text: '📈 روند هفته', callback_data: CB.CHART },
        { text: 'ℹ️ راهنما', callback_data: CB.HELP },
      ],
    ],
  };
}

export function marketKeyboard(active = 'main') {
  return {
    inline_keyboard: [
      [
        { text: '📊 تابلوی بازار', callback_data: CB.MARKET },
        { text: '🔄 تازه‌سازی', callback_data: active === 'crypto' ? CB.CRYPTO : active === 'gold' ? CB.GOLD : active === 'fiat' ? CB.FIAT : CB.REFRESH },
      ],
      [
        { text: active === 'crypto' ? '• 💎 کریپتو •' : '💎 کریپتو', callback_data: CB.CRYPTO },
        { text: active === 'gold' ? '• 🪙 طلا و سکه •' : '🪙 طلا و سکه', callback_data: CB.GOLD },
      ],
      [
        { text: active === 'fiat' ? '• 💵 ارز •' : '💵 ارز', callback_data: CB.FIAT },
        { text: active === 'tether' ? '• ₮ تتر •' : '₮ تتر', callback_data: CB.REFRESH },
      ],
      [
        { text: '🏠 منوی اصلی', callback_data: CB.HOME },
      ],
    ],
  };
}

export function listKeyboard(page, pages) {
  const nav = [];
  if (page > 0) nav.push({ text: '◀️ قبلی', callback_data: `${CB.LIST}:${page - 1}` });
  nav.push({ text: `${toFaDigits(page + 1)}/${toFaDigits(pages)}`, callback_data: 'noop' });
  if (page < pages - 1) nav.push({ text: 'بعدی ▶️', callback_data: `${CB.LIST}:${page + 1}` });

  return {
    inline_keyboard: [
      nav,
      [
        { text: '🔄 تازه‌سازی', callback_data: `${CB.LIST}:${page}` },
        { text: '🏠 خانه', callback_data: CB.HOME },
      ],
    ],
  };
}

export function backKeyboard() {
  return {
    inline_keyboard: [[
      { text: '🔄 تازه‌سازی', callback_data: CB.REFRESH },
      { text: '🏠 خانه', callback_data: CB.HOME },
    ]],
  };
}

export function subscribeKeyboard(subscribed) {
  return {
    inline_keyboard: [[
      subscribed
        ? { text: '🔕 لغو گزارش روزانه', callback_data: `${CB.SUB}:0` }
        : { text: '🔔 فعال‌سازی گزارش روزانه', callback_data: `${CB.SUB}:1` },
    ]],
  };
}
