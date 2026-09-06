// lib/keyboard.js — inline keyboards. Callback payloads are kept terse because
// Telegram caps callback_data at 64 bytes.

import { CB } from 'lib/config';
import { toFaDigits } from 'lib/fa';

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔄 تازه‌سازی', callback_data: CB.REFRESH },
        { text: '📋 فهرست صرافی‌ها', callback_data: `${CB.LIST}:0` },
      ],
      [
        { text: '🏆 بهترین‌ها', callback_data: CB.TOP },
        { text: '📊 میانگین', callback_data: CB.AVG },
      ],
      [
        { text: '📈 روند هفته', callback_data: CB.CHART },
        { text: '🧹 حذف‌شده‌ها', callback_data: CB.EXCLUDED },
      ],
      [{ text: 'ℹ️ راهنما', callback_data: CB.HELP }],
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
