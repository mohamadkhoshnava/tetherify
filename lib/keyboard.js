// lib/keyboard.js — inline & reply keyboards with native Bot API 10.4 custom emojis & styles.
// Long button labels are kept 1-per-row to avoid text truncation.

import { CB, CHANNEL_ID } from 'lib/config';
import { toFaDigits, faNum } from 'lib/fa';
import { EMOJI_ID } from 'lib/emoji';

/** Bottom persistent Reply Keyboard button labels for private chat (PV). */
export const BTN = {
  TOUCH_CHART: 'تابلوی زنده بازار',
  CRYPTO: 'کریپتو',
  GOLD: 'طلا و سکه',
  FIAT: 'دلار و ارز',
  CALC: 'ماشین‌حساب',
  SHARE: 'ارسال به گروه ↗️',
  SETTINGS: 'تنظیمات',
  HOME: 'خانه',
  BACK: 'بازگشت',
  HELP: 'راهنما',
  ALERT: 'تنظیم هشدار',
};

export function pvReplyKeyboard(currentPrice = 255000) {
  const p = Math.round(currentPrice || 255000);
  const nextTarget = Math.ceil((p + 500) / 1000) * 1000;

  return {
    keyboard: [
      [{ text: `کپی ${faNum(p)} تومان`, icon_custom_emoji_id: EMOJI_ID.DOLLAR }],
      [{ text: `رد شد از ${faNum(nextTarget)} خبرم کن`, icon_custom_emoji_id: EMOJI_ID.WATCH, style: 'primary' }],
      [{ text: BTN.TOUCH_CHART, icon_custom_emoji_id: EMOJI_ID.BAR_CHART }],
      [
        { text: BTN.CRYPTO, icon_custom_emoji_id: EMOJI_ID.DIAMOND },
        { text: BTN.GOLD, icon_custom_emoji_id: EMOJI_ID.COIN },
      ],
      [
        { text: BTN.FIAT, icon_custom_emoji_id: EMOJI_ID.DOLLAR },
        { text: BTN.CALC, icon_custom_emoji_id: EMOJI_ID.CALC },
      ],
      [{ text: BTN.SHARE, icon_custom_emoji_id: EMOJI_ID.ROCKET }],
      [
        { text: BTN.SETTINGS, icon_custom_emoji_id: EMOJI_ID.SHIELD },
        { text: BTN.HELP, icon_custom_emoji_id: EMOJI_ID.STAR },
        { text: BTN.HOME, icon_custom_emoji_id: EMOJI_ID.BAG },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Inline keyboard under forwardable RichMessage cards (mirrors Dollar Chande UX + touch board launch). */
export function richCardKeyboard(market, activeTab = 'market') {
  const p = Math.round(market?.usdtMedian || market?.tether?.stats?.median || 255000);
  const nextTarget = Math.ceil((p + 500) / 1000) * 1000;
  const channelUrl = `https://t.me/${CHANNEL_ID.replace('@', '')}`;

  return {
    inline_keyboard: [
      [
        {
          text: `کپی ${faNum(p)} تومان`,
          copy_text: { text: String(p) },
          icon_custom_emoji_id: EMOJI_ID.DOLLAR,
        },
      ],
      [
        {
          text: `رد شد از ${faNum(nextTarget)} خبرم کن`,
          callback_data: `${CB.ALERT_SET}:${nextTarget}`,
          icon_custom_emoji_id: EMOJI_ID.WATCH,
          style: 'primary',
        },
      ],
      [
        {
          text: 'تابلوی لمسی',
          callback_data: CB.TOUCH,
          icon_custom_emoji_id: EMOJI_ID.BAR_CHART,
        },
        {
          text: 'ارسال به گروه ↗️',
          switch_inline_query: '',
          icon_custom_emoji_id: EMOJI_ID.ROCKET,
        },
      ],
      [
        {
          text: 'ماشین‌حساب',
          callback_data: CB.CALC,
          icon_custom_emoji_id: EMOJI_ID.CALC,
        },
        {
          text: 'هشدار قیمت',
          callback_data: CB.ALERT_MENU,
          icon_custom_emoji_id: EMOJI_ID.TARGET,
        },
      ],
      [
        activeTab === 'market'
          ? { text: 'صرافی‌ها', callback_data: `${CB.LIST}:0`, icon_custom_emoji_id: EMOJI_ID.BANK }
          : { text: 'تابلوی بازار', callback_data: CB.MARKET, icon_custom_emoji_id: EMOJI_ID.STAR },
        {
          text: 'کانال تتریفای ↗️',
          url: channelUrl,
          icon_custom_emoji_id: EMOJI_ID.CHANNEL,
        },
      ],
    ],
  };
}

/** Inline keyboard under the live Mini-Widget with active primary state & custom emojis. */
export function widgetKeyboard(activeTab = 'market') {
  return {
    inline_keyboard: [
      [
        {
          text: 'تابلوی بازار',
          callback_data: CB.MARKET,
          icon_custom_emoji_id: EMOJI_ID.BAR_CHART,
          ...(activeTab === 'market' ? { style: 'primary' } : {}),
        },
        {
          text: 'کریپتو',
          callback_data: CB.CRYPTO,
          icon_custom_emoji_id: EMOJI_ID.DIAMOND,
          ...(activeTab === 'crypto' ? { style: 'primary' } : {}),
        },
      ],
      [
        {
          text: 'طلا و سکه',
          callback_data: CB.GOLD,
          icon_custom_emoji_id: EMOJI_ID.COIN,
          ...(activeTab === 'gold' ? { style: 'primary' } : {}),
        },
        {
          text: 'دلار و ارز',
          callback_data: CB.FIAT,
          icon_custom_emoji_id: EMOJI_ID.DOLLAR,
          ...(activeTab === 'fiat' ? { style: 'primary' } : {}),
        },
      ],
      [
        {
          text: 'تتر صرافی‌ها',
          callback_data: CB.REFRESH,
          icon_custom_emoji_id: EMOJI_ID.EXCHANGE,
          ...(activeTab === 'tether' ? { style: 'primary' } : {}),
        },
        {
          text: 'ماشین‌حساب',
          callback_data: CB.CALC,
          icon_custom_emoji_id: EMOJI_ID.CALC,
          ...(activeTab === 'calc' ? { style: 'primary' } : {}),
        },
      ],
      [
        {
          text: 'تنظیم هشدار هوشمند قیمت',
          callback_data: CB.ALERT_MENU,
          icon_custom_emoji_id: EMOJI_ID.WATCH,
        },
      ],
      [
        {
          text: 'ارسال به گروه ↗️',
          switch_inline_query: '',
          icon_custom_emoji_id: EMOJI_ID.ROCKET,
        },
        {
          text: 'کانال تتریفای ↗️',
          url: `https://t.me/${CHANNEL_ID.replace('@', '')}`,
          icon_custom_emoji_id: EMOJI_ID.CHANNEL,
        },
      ],
    ],
  };
}

/** Price inline keyboard. */
export function priceKeyboard(snapshot, { activeTimeframe = '24h' } = {}) {
  return {
    inline_keyboard: [
      [
        {
          text: '۲۴ ساعته',
          callback_data: CB.TF_24H,
          icon_custom_emoji_id: EMOJI_ID.WATCH,
          ...(activeTimeframe === '24h' ? { style: 'primary' } : {}),
        },
        {
          text: '۷ روزه',
          callback_data: CB.TF_7D,
          icon_custom_emoji_id: EMOJI_ID.CHART_UP,
          ...(activeTimeframe === '7d' ? { style: 'primary' } : {}),
        },
      ],
      [
        {
          text: 'تابلوی زنده بازارهای مالی',
          callback_data: CB.WIDGET,
          icon_custom_emoji_id: EMOJI_ID.BAR_CHART,
          style: 'primary',
        },
      ],
      [
        { text: 'صرافی‌ها', callback_data: `${CB.LIST}:0`, icon_custom_emoji_id: EMOJI_ID.BANK },
        { text: 'تنظیم هشدار', callback_data: CB.ALERT_MENU, icon_custom_emoji_id: EMOJI_ID.TARGET },
      ],
      [
        {
          text: 'کانال تتریفای ↗️',
          url: `https://t.me/${CHANNEL_ID.replace('@', '')}`,
          icon_custom_emoji_id: EMOJI_ID.CHANNEL,
        },
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
      { text: `+۱٪ (${faNum(up1)})`, callback_data: `${CB.ALERT_SET}:${up1}`, icon_custom_emoji_id: EMOJI_ID.CHART_UP, style: 'success' },
      { text: `+۲٪ (${faNum(up2)})`, callback_data: `${CB.ALERT_SET}:${up2}`, icon_custom_emoji_id: EMOJI_ID.CHART_UP, style: 'success' },
    ],
    [
      { text: `+۵٪ (${faNum(up5)})`, callback_data: `${CB.ALERT_SET}:${up5}`, icon_custom_emoji_id: EMOJI_ID.ROCKET, style: 'success' },
      { text: `-۱٪ (${faNum(dn1)})`, callback_data: `${CB.ALERT_SET}:${dn1}`, icon_custom_emoji_id: EMOJI_ID.CHART_DOWN, style: 'danger' },
    ],
    [
      { text: `-۲٪ (${faNum(dn2)})`, callback_data: `${CB.ALERT_SET}:${dn2}`, icon_custom_emoji_id: EMOJI_ID.CHART_DOWN, style: 'danger' },
      { text: `-۵٪ (${faNum(dn5)})`, callback_data: `${CB.ALERT_SET}:${dn5}`, icon_custom_emoji_id: EMOJI_ID.CHART_DOWN, style: 'danger' },
    ],
    [
      { text: `هدف ${faNum(r1)}`, callback_data: `${CB.ALERT_SET}:${r1}`, icon_custom_emoji_id: EMOJI_ID.TARGET },
      { text: `هدف ${faNum(r2)}`, callback_data: `${CB.ALERT_SET}:${r2}`, icon_custom_emoji_id: EMOJI_ID.TARGET },
    ],
    [
      { text: `هدف ${faNum(r3)}`, callback_data: `${CB.ALERT_SET}:${r3}`, icon_custom_emoji_id: EMOJI_ID.TARGET },
    ],
  ];

  if (alerts && alerts.length > 0) {
    rows.push([
      { text: `هشدارهای من (${toFaDigits(alerts.length)})`, callback_data: CB.ALERT_DEL, icon_custom_emoji_id: EMOJI_ID.BAR_CHART },
      { text: 'حذف همه', callback_data: CB.ALERT_CLEAR, style: 'danger' },
    ]);
  }

  rows.push([
    { text: 'بازگشت به تابلوی زنده', callback_data: CB.WIDGET, icon_custom_emoji_id: EMOJI_ID.BAG, style: 'primary' },
  ]);

  return { inline_keyboard: rows };
}

/** Alert management keyboard with per-item delete button. */
export function alertListKeyboard(alerts = []) {
  const rows = alerts.slice(0, 8).map((a) => {
    const dir = a.direction === 'above' ? EMOJI_ID.CHART_UP : EMOJI_ID.CHART_DOWN;
    return [
      { text: `${faNum(a.price)} تومان`, callback_data: 'noop', icon_custom_emoji_id: dir },
      { text: 'حذف', callback_data: `${CB.ALERT_DEL}:${a.id}`, style: 'danger' },
    ];
  });

  rows.push([
    { text: 'افزودن هشدار جدید', callback_data: CB.ALERT_MENU, icon_custom_emoji_id: EMOJI_ID.WATCH, style: 'primary' },
  ]);
  rows.push([
    { text: 'بازگشت به تابلوی زنده', callback_data: CB.WIDGET, icon_custom_emoji_id: EMOJI_ID.BAG },
  ]);

  return { inline_keyboard: rows };
}

/** Settings Keyboard. */
export function settingsKeyboard(subscribed) {
  return {
    inline_keyboard: [
      [
        subscribed
          ? { text: 'خاموش کردن گزارش روزانه', callback_data: `${CB.SUB}:0`, style: 'danger' }
          : { text: 'روشن کردن گزارش روزانه', callback_data: `${CB.SUB}:1`, icon_custom_emoji_id: EMOJI_ID.CHECK, style: 'success' },
      ],
      [
        { text: 'مدیریت هشدارهای قیمت', callback_data: CB.ALERT_MENU, icon_custom_emoji_id: EMOJI_ID.WATCH },
      ],
      [
        { text: 'بازگشت به تابلوی زنده', callback_data: CB.WIDGET, icon_custom_emoji_id: EMOJI_ID.BAR_CHART, style: 'primary' },
      ],
    ],
  };
}

export function marketKeyboard(active = 'market') {
  return widgetKeyboard(active);
}

export function backKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'بازگشت به تابلوی زنده', callback_data: CB.WIDGET, icon_custom_emoji_id: EMOJI_ID.BAR_CHART, style: 'primary' }],
    ],
  };
}

export function mainKeyboard() {
  return widgetKeyboard('market');
}

export function listKeyboard(page, totalPages) {
  const row = [];
  if (page > 0) row.push({ text: 'قبلی', callback_data: `${CB.LIST}:${page - 1}` });
  row.push({ text: `${toFaDigits(page + 1)} / ${toFaDigits(totalPages)}`, callback_data: 'noop' });
  if (page < totalPages - 1) row.push({ text: 'بعدی', callback_data: `${CB.LIST}:${page + 1}` });

  return {
    inline_keyboard: [
      row,
      [{ text: 'بازگشت به تابلوی زنده', callback_data: CB.WIDGET, icon_custom_emoji_id: EMOJI_ID.BAR_CHART, style: 'primary' }],
    ],
  };
}

export function subscribeKeyboard(subscribed) {
  return {
    inline_keyboard: [
      [
        subscribed
          ? { text: 'لغو اشتراک گزارش', callback_data: `${CB.SUB}:0`, style: 'danger' }
          : { text: 'فعال‌سازی گزارش روزانه', callback_data: `${CB.SUB}:1`, icon_custom_emoji_id: EMOJI_ID.CHECK, style: 'success' },
      ],
      [{ text: 'بازگشت به تابلوی زنده', callback_data: CB.WIDGET, icon_custom_emoji_id: EMOJI_ID.BAR_CHART, style: 'primary' }],
    ],
  };
}
