// lib/gate.js — forced channel membership for private chats.
//
// Private-chat users must be members of the channel before the bot answers
// them. Groups are untouched: a group is already a shared space, and gating it
// would punish every member for one person's membership.
//
// TWO DELIBERATE CHOICES HERE
//
// 1. It fails OPEN. If getChatMember errors — the bot lost its admin right in
//    the channel, the channel was renamed, Telegram hiccuped — every user would
//    otherwise be locked out of a working bot by a configuration problem. A
//    membership gate is a growth feature, not a security boundary, so the safe
//    failure is to let people through and log it.
//
// 2. Confirmed memberships are cached. Without that, an active conversation
//    would call getChatMember on every message. Negatives are cached only
//    briefly, so someone who has just joined is not left waiting.

import { api } from 'sdk';
import { CHANNEL_ID, ADMIN_IDS } from 'lib/config';
import { esc } from 'lib/fa';
import { effectiveConfig, getSetting, cacheGet, cacheSet, cacheClear } from 'lib/store';

const MEMBER_STATUSES = ['creator', 'administrator', 'member'];
const NEGATIVE_TTL_SEC = 15;

const key = (userId) => `member:${userId}`;

/** The channel membership is checked against. */
export async function gateTarget() {
  return getSetting('channelId', CHANNEL_ID);
}

export async function gateEnabled() {
  const cfg = await effectiveConfig();
  return Number(cfg.forceJoin) === 1;
}

/** A joinable link, when the target is a public @username. */
export function channelLink(target) {
  if (!target || typeof target !== 'string') return null;
  if (target.startsWith('@')) return `https://t.me/${target.slice(1)}`;
  if (target.startsWith('https://t.me/')) return target;
  return null; // numeric -100... id: no public link to offer
}

/**
 * Is this user a member of the gate channel?
 * @param {{fresh?: boolean}} opts  fresh skips the cache (used by the recheck button)
 */
export async function isMember(userId, opts = {}) {
  if (!userId) return true;
  if (ADMIN_IDS.includes(Number(userId))) return true;

  const cfg = await effectiveConfig();

  if (!opts.fresh) {
    const cached = await cacheGet(key(userId));
    if (cached === true) return true;
    if (cached === false) return false;
  }

  const target = await gateTarget();
  if (!target) return true;

  try {
    const member = await api.getChatMember({ chat_id: target, user_id: userId });
    const status = member && member.status;
    // A "restricted" member is still in the channel — until is_member says otherwise.
    const ok = MEMBER_STATUSES.includes(status)
      || (status === 'restricted' && member.is_member === true);

    await cacheSet(key(userId), ok, ok ? (cfg.memberCacheMin || 10) * 60 : NEGATIVE_TTL_SEC);
    return ok;
  } catch (err) {
    // Fail open — see the note at the top of this file.
    console.warn('membership check failed, allowing through:', err && (err.description || err.message));
    return true;
  }
}

/** Drop a cached membership result, so the next check hits the API. */
export async function forgetMembership(userId) {
  await cacheClear(key(userId));
}

/** The "please join first" card, with a join link and a recheck button. */
export async function gatePrompt(target) {
  const link = channelLink(target);
  const rows = [];
  if (link) rows.push([{ text: '📣 عضویت در کانال', url: link }]);
  rows.push([{ text: '✅ عضو شدم، بررسی کن', callback_data: 'j' }]);

  const text =
    `🔒 <b>برای استفاده از ربات، اول عضو کانال شوید</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `این ربات قیمت لحظه‌ای تتر را از حدود ۹۰ صرافی ایرانی می‌دهد و نرخ‌های خطادار را حذف می‌کند.\n\n` +
    `برای استفاده کافی است عضو ${esc(target)} شوید و بعد دکمه‌ی زیر را بزنید.\n\n` +
    `<i>اگر همین الان عضو شدید و باز این پیام را دیدید، چند لحظه بعد دوباره دکمه را بزنید.</i>`;

  return { text, reply_markup: { inline_keyboard: rows } };
}

/**
 * Gate a private chat. Returns true when the user may proceed.
 * Sends the join prompt itself when they may not.
 */
export async function ensureMember(chat, userId) {
  if (!chat || chat.type !== 'private') return true;
  if (!(await gateEnabled())) return true;
  if (await isMember(userId)) return true;

  const target = await gateTarget();
  const prompt = await gatePrompt(target);
  try {
    await api.sendMessage({
      chat_id: chat.id,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...prompt,
    });
  } catch (err) {
    console.warn('gate prompt failed:', err && err.description);
  }
  return false;
}
