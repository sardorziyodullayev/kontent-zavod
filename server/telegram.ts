// Telegram yordamchilari: Mini App (WebApp) initData imzosini tekshirish va bot orqali fayl yuborish.
// Bazaga bog'liq emas — testlarda to'g'ridan-to'g'ri ishlatiladi.
import crypto from 'node:crypto';

/** Bot API manzili. TELEGRAM_API_URL — faqat mahalliy sinov uchun (soxta Telegram serveri). */
export const tgUrl = (method: string, token = process.env.TELEGRAM_BOT_TOKEN ?? '') => `${process.env.TELEGRAM_API_URL || 'https://api.telegram.org'}/bot${token}/${method}`;

export type WebAppUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };

/**
 * Telegram Mini App initData tekshiruvi (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * secret = HMAC_SHA256(key="WebAppData", msg=bot_token); hash = HMAC_SHA256(secret, data_check_string),
 * data_check_string — hash dan boshqa maydonlar, kalit bo'yicha saralangan, "key=value" lar "\n" bilan.
 * auth_date `maxAgeSec` dan eski bo'lsa (standart 24 soat) — rad etiladi.
 */
export function checkWebAppInit(initData: string, botToken: string, now = Date.now(), maxAgeSec = 86_400): { user: WebAppUser; authDate: number } | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') ?? '';
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const want = crypto.createHmac('sha256', secret).update(dcs).digest();
  const got = Buffer.from(hash, 'hex');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const age = now / 1000 - authDate;
  if (age > maxAgeSec || age < -300) return null; // kelajakdagi sana ham shubhali (5 daqiqa soat farqiga ruxsat)
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as WebAppUser | null;
    if (!user || !Number.isSafeInteger(user.id)) return null;
    return { user, authDate };
  } catch { return null; }
}

/** Sinov uchun: berilgan bot tokeni bilan imzolangan initData yasash (testlar va mahalliy tekshiruv). */
export function signWebAppInit(fields: Record<string, string>, botToken: string): string {
  const dcs = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

/** Bot orqali faylni chatga yuborish (sendDocument). */
export async function tgSendDocument(chatId: string, buf: Buffer, name: string, caption: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Bot sozlanmagan');
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption.slice(0, 1024));
  form.append('document', new Blob([new Uint8Array(buf)]), name);
  const res = await (await fetch(tgUrl('sendDocument'), { method: 'POST', body: form })).json().catch(() => ({ ok: false, description: 'javob yo‘q' })) as { ok: boolean; description?: string };
  if (!res.ok) throw new Error('sendDocument: ' + (res.description ?? ''));
}
