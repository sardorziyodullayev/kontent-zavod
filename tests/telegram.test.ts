// Telegram Mini App initData imzosi: soxta bot tokeni bilan yasab tekshiramiz (haqiqiy token ishlatilmaydi).
import { describe, expect, it } from 'vitest';
import { checkWebAppInit, signWebAppInit } from '../server/telegram';

const BOT = '123456:TEST-fake-token';
const now = Date.UTC(2026, 10, 13, 2, 0, 0);
const sec = Math.floor(now / 1000);
const user = JSON.stringify({ id: 777001, first_name: 'Ish', username: 'ish_beruvchi', language_code: 'ru' });

describe('checkWebAppInit', () => {
  it('to‘g‘ri imzo — foydalanuvchi qaytadi', () => {
    const init = signWebAppInit({ auth_date: String(sec - 60), query_id: 'AAH', user }, BOT);
    const r = checkWebAppInit(init, BOT, now);
    expect(r?.user.id).toBe(777001);
    expect(r?.authDate).toBe(sec - 60);
  });

  it('boshqa bot tokeni bilan imzolangan — rad', () => {
    const init = signWebAppInit({ auth_date: String(sec), user }, '999:other');
    expect(checkWebAppInit(init, BOT, now)).toBeNull();
  });

  it('maydon o‘zgartirilsa (boshqa user.id) — rad', () => {
    const init = signWebAppInit({ auth_date: String(sec), user }, BOT).replace('777001', '777002');
    expect(checkWebAppInit(init, BOT, now)).toBeNull();
  });

  it('hash yo‘q yoki buzilgan — rad', () => {
    expect(checkWebAppInit(`auth_date=${sec}&user=${encodeURIComponent(user)}`, BOT, now)).toBeNull();
    expect(checkWebAppInit(`auth_date=${sec}&hash=zz`, BOT, now)).toBeNull();
    expect(checkWebAppInit('', BOT, now)).toBeNull();
    expect(checkWebAppInit(signWebAppInit({ auth_date: String(sec), user }, BOT), '', now)).toBeNull();
  });

  it('auth_date 24 soatdan eski — rad, 23 soatlik — qabul', () => {
    expect(checkWebAppInit(signWebAppInit({ auth_date: String(sec - 86_400 - 5), user }, BOT), BOT, now)).toBeNull();
    expect(checkWebAppInit(signWebAppInit({ auth_date: String(sec - 23 * 3600), user }, BOT), BOT, now)).not.toBeNull();
  });

  it('user maydoni yo‘q — rad', () => {
    expect(checkWebAppInit(signWebAppInit({ auth_date: String(sec) }, BOT), BOT, now)).toBeNull();
  });

  it('maydonlar tartibi ahamiyatsiz (saralanadi)', () => {
    const init = signWebAppInit({ user, auth_date: String(sec), chat_type: 'private', chat_instance: '-42' }, BOT);
    const shuffled = new URLSearchParams(init);
    const reordered = new URLSearchParams([...shuffled.entries()].reverse()).toString();
    expect(checkWebAppInit(reordered, BOT, now)?.user.id).toBe(777001);
  });
});
