// lib/keyboard.js — inline & reply keyboards. Callback payloads kept terse (<64 bytes).

import { CB, CHANNEL_ID } from 'lib/config';
import { toFaDigits, faNum } from 'lib/fa';

/** Bottom persistent Reply Keyboard buttons for private chat (PV). */
export const BTN = {
  CRYPTO: '💎 کریپتو',
  GOLD: '🪙 طلا و سکه',
  FIAT: '💵 دلار و ارز',
  TOUCH_CHART: '📱 تابلوی لمسی',
  SHARE: '👥 ارسال به گروه ↗️',
  SETTINGS: '⚙️ تنظیمات',
  HOME: '✨ خانه',
  BACK: '🔙 بازگشت',
  ALERT: '⏰ تنظیم هشدار',
};

export function pvReplyKeyboard(currentPrice = 255000) {
  const p = Math.round(currentPrice || 255000);
  const nextTarget = Math.ceil((p + 500) / 1000) * 1000;

  return {
    keyboard: [
      [{ text: `💸 کپی ${faNum(p)}` }],
      [{ text: `⏰ رد شد از ${faNum(nextTarget)} خبرم کن` }],
      [{ text: BTN.SHARE }, { text: BTN.TOUCH_CHART }],
      [{ text: BTN.CRYPTO }, { text: BTN.GOLD }, { text: BTN.FIAT }],
      [{ text: BTN.BACK }, { text: BTN.SETTINGS }, { text: BTN.HOME }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Clean aesthetic price inline keyboard inspired by Dollar Chande (2x2 + channel). */
export function priceKeyboard(snapshot, { activeTimeframe = '24h' } = {}) {
  const tf24Text = activeTimeframe === '24h' ? '• ⏰ ۲۴ ساعته •' : '⏰ ۲۴ ساعته';
  const tf7dText = activeTimeframe === '7d' ? '• 🥞 ۷ روزه •' : '🥞 ۷ روزه';

  return {
    inline_keyboard: [
      [
        { text: tf24Text, callback_data: CB.TF_24H },
        { text: tf7dText, callback_data: CB.TF_7D },
      ],
      [
        { text: '📋 صرافی‌ها', callback_data: `${CB.LIST}:0` },
        { text: '⏰ تنظیم هشدار', callback_data: CB.ALERT_MENU },
      ],
      [
        { text: '📣 کانال تتریفای ↗️', url: `https://t.me/${CHANNEL_ID.replace('@', '')}` },
      ],
    ],
  };
}

/** 1-Tap Interactive Alert Keyboard. */
export function alertInteractiveKeyboard(currentPrice, alerts = []) {
  const p = Math.round(currentPrice || 255000);
  const up1 = Math.round(p * 1.01);
  const up2 = Math.round(p * 1.02);
  const up5 = Math.round(p * 1.05);
  const dn1 = Math.round(p * 0.99);
  const dn2 = Math.round(p * 0.98);
  const dn5 = Math.round(p * 0.95);

  const baseRound = Math.floor(p / 5000) * 5000;
  const r1 = baseRound;
  const r2 = baseRound + 5000;
  const r3 = baseRound + 10000;

  const rows = [
    [
      { text: `🔺 +۱٪ (${faNum(up1)})`, callback_data: `${CB.ALERT_SET}:${up1}` },
      { text: `🔺 +۲٪ (${faNum(up2)})`, callback_data: `${CB.ALERT_SET}:${up2}` },
      { text: `🔺 +۵٪ (${faNum(up5)})`, callback_data: `${CB.ALERT_SET}:${up5}` },
    ],
    [
      { text: `🔻 -۱٪ (${faNum(dn1)})`, callback_data: `${CB.ALERT_SET}:${dn1}` },
      { text: `🔻 -۲٪ (${faNum(dn2)})`, callback_data: `${CB.ALERT_SET}:${dn2}` },
      { text: `🔻 -۵٪ (${faNum(dn5)})`, callback_data: `${CB.ALERT_SET}:${dn5}` },
    ],
    [
      { text: `🎯 ${faNum(r1)}`, callback_data: `${CB.ALERT_SET}:${r1}` },
      { text: `🎯 ${faNum(r2)}`, callback_data: `${CB.ALERT_SET}:${r2}` },
      { text: `🎯 ${faNum(r3)}`, callback_data: `${CB.ALERT_SET}:${r3}` },
    ],
  ];

  if (alerts && alerts.length > 0) {
    rows.push([
      { text: `📋 هشدارهای من (${toFaDigits(alerts.length)})`, callback_data: CB.ALERT_DEL },
      { text: '🗑 حذف همه', callback_data: CB.ALERT_CLEAR },
    ]);
  }

  rows.push([
    { text: '🔙 بازگشت به قیمت تتر', callback_data: CB.REFRESH },
  ]);

  return { inline_keyboard: rows };
}

/** Alert management keyboard with per-item delete button. */
export function alertListKeyboard(alerts = []) {
  const rows = alerts.slice(0, 8).map((a) => {
    const dir = a.direction === 'above' ? '🔺' : '🔻';
    return [
      { text: `${dir} ${faNum(a.price)} تومان`, callback_data: 'noop' },
      { text: '🗑 حذف', callback_data: `${CB.ALERT_DEL}:${a.id}` },
    ];
  });

  rows.push([
    { text: '➕ افزودن هشدار جدید', callback_data: CB.ALERT_MENU },
    { text: '🔙 بازگشت به قیمت تتر', callback_data: CB.REFRESH },
  ]);

  return { inline_keyboard: rows };
}

/** Settings Keyboard. */
export function settingsKeyboard(subscribed) {
  return {
    inline_keyboard: [
      [
        subscribed
          ? { text: '🔕 خاموش کردن گزارش روزانه', callback_data: `${CB.SUB}:0` }
          : { text: '🔔 روشن کردن گزارش روزانه', callback_data: `${CB.SUB}:1` },
      ],
      [
        { text: '⏰ مدیریت هشدارهای قیمت', callback_data: CB.ALERT_MENU },
      ],
      [
        { text: '🔙 بازگشت به قیمت تتر', callback_data: CB.REFRESH },
      ],
    ],
  };
}

export function marketKeyboard(active = 'market') {
  return {
    inline_keyboard: [
      [
        { text: active === 'crypto' ? '• 💎 کریپتو •' : '💎 کریپتو', callback_data: CB.CRYPTO },
        { text: active === 'gold' ? '• 🪙 طلا و سکه •' : '🪙 طلا و سکه', callback_data: CB.GOLD },
        { text: active === 'fiat' ? '• 💵 دلار و ارز •' : '💵 دلار و ارز', callback_data: CB.FIAT },
      ],
      [
        { text: '📱 تابلوی لمسی', callback_data: CB.WIDGET },
        { text: '🔙 بازگشت به تتر', callback_data: CB.REFRESH },
      ],
    ],
  };
}

export function backKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔙 بازگشت به قیمت تتر', callback_data: CB.REFRESH }],
    ],
  };
}

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⏰ ۲۴ ساعته', callback_data: CB.TF_24H },
        { text: '🥞 ۷ روزه', callback_data: CB.TF_7D },
      ],
      [
        { text: '📋 صرافی‌ها', callback_data: `${CB.LIST}:0` },
        { text: '⏰ هشدار', callback_data: CB.ALERT_MENU },
      ],
      [
        { text: '📣 کانال تتریفای ↗️', url: `https://t.me/${CHANNEL_ID.replace('@', '')}` },
      ],
    ],
  };
}

export function listKeyboard(page, totalPages) {
  const row = [];
  if (page > 0) row.push({ text: '◀️ قبلی', callback_data: `${CB.LIST}:${page - 1}` });
  row.push({ text: `${toFaDigits(page + 1)} / ${toFaDigits(totalPages)}`, callback_data: 'noop' });
  if (page < totalPages - 1) row.push({ text: 'بعدی ▶️', callback_data: `${CB.LIST}:${page + 1}` });

  return {
    inline_keyboard: [
      row,
      [{ text: '🔙 بازگشت به قیمت تتر', callback_data: CB.REFRESH }],
    ],
  };
}

export function subscribeKeyboard(subscribed) {
  return {
    inline_keyboard: [
      [
        subscribed
          ? { text: '🔕 لغو اشتراک', callback_data: `${CB.SUB}:0` }
          : { text: '🔔 فعال‌سازی گزارش روزانه', callback_data: `${CB.SUB}:1` },
      ],
      [{ text: '🔙 بازگشت به قیمت تتر', callback_data: CB.REFRESH }],
    ],
  };
}
