# Kontent Zavod — admin panel

Videolarni ijtimoiy tarmoqlarga joylab boradigan kontent zavodining boshqaruv paneli.
G'oyadan joylashgacha bo'lgan butun liniya, joylash navbati, natijalar, prognoz va tavsiyalar bitta joyda.

**Jonli demo:** GitHub Pages'da (repo sahifasidagi *Environments → github-pages* havolasi). Demo ma'lumotlar brauzeringizda saqlanadi.

## Nimalar bor

| Bo'lim | Nima ko'rsatadi |
|---|---|
| **Boshqaruv** | Keyingi video va sanoq (soat:daqiqa:soniya), tayyorlik konveyeri (8 bosqich), har platforma uchun prognoz: ko'rishlar va yangi obunachilar oralig'i, ishonch darajasi. Ogohlantirishlar, KPI (ko'rishlar, obunachilar, joylashlar, ER), kunlik ko'rishlar grafigi, platformalar ulushi, yaqin 7 kun, oxirgi joylanganlar, oylik maqsadlar, faoliyat jurnali |
| **Videolar** | Har bir video: qaysi platformaga, qaysi kuni, soat nechida joylangan, ko'rishlar, ER, tomosha foizi, yangi obunachilar. Qidiruv, filtrlar, saralash, CSV eksport. Video kartasida o'sish grafigi, platformalar kesimi, rejalashtirish, ssenariy, izohlar |
| **Reja va kalendar** | Oylik kalendar: tayyor / tayyor emas / joylangan / xato. Haftalik maqsad, har platforma uchun eng yaxshi vaqtlar |
| **Ssenariylar** | Kanban: G'oya → Ssenariy → Suratga olish → Montaj → Tayyor → Rejalashtirilgan → Joylandi (sudrab o'tkaziladi). Ssenariy muharriri: hook, asosiy qism, CTA, so'z soni, taxminiy davomiylik, 4 ta shablon |
| **Tahlil** | Avtomatik tavsiyalar, kun×soat issiqlik xaritasi, mavzular reytingi, obunachiga aylanish, qisqa va uzun video taqqoslash, obunachilar o'sishi, eng yaxshi 10 post |
| **Platformalar** | YouTube, Instagram, TikTok, Telegram, Facebook: obunachilar, 30 kunlik o'sish, token holati, ulash/uzish |
| **Konveyer va API** | Ishlab chiqarish liniyasi, joylash navbati (tayyorlik, prognoz), worker uchun API |
| **Sozlamalar** | Maqsadlar, JSON/CSV eksport-import, demo ma'lumotlarni tiklash, mavzu (qorong'i/yorug') |

Siz aytmagan, lekin kerak bo'ladigan narsalar ham qo'shildi:

- **Tayyor emaslik xavfi.** Joylashga 72 soatdan kam vaqt qolgan va to'liq tayyor bo'lmagan video ogohlantirish beradi, nima yetishmasligini ham yozadi.
- **Token muddati.** Platforma tokeni tugashidan 7 kun oldin ogohlantiradi, chunki token tugasa avtomatik joylash to'xtaydi.
- **Bo'sh kunlar.** Keyingi 7 kunda hech narsa rejalashtirilmagan kunlarni ko'rsatadi.
- **Xato va qayta urinish.** Platforma xato qaytarsa post "Xato" bo'ladi, bitta tugma bilan qayta urinish mumkin.
- **Trend signali.** Post odatdagidan 2.5 baravar tez o'sayotgan bo'lsa xabar beradi, davomini tezroq tayyorlash uchun.
- **Maqsad sur'ati.** Hozirgi tezlikda oy oxirida qancha bo'lishini hisoblaydi.
- Buyruqlar palitrasi (<kbd>Ctrl K</kbd>), <kbd>N</kbd> bilan yangi video, mobil ko'rinish, qorong'i va yorug' mavzu.

## Ishga tushirish

Faqat Node.js 20+ kerak, bog'liqliklar yo'q.

```bash
npm start
```

Brauzerda: http://localhost:4310

Ma'lumotlar `data/db.json` faylida saqlanadi. Birinchi ishga tushirishda 90 kunlik namunaviy ma'lumot yaratiladi. Sozlamalar → *Demo ma'lumotlarni tiklash* bilan qayta boshlash mumkin.

Serverni internetga chiqarsangiz `ADMIN_TOKEN` o'rnating (`.env.example` dan `.env` nusxa oling). Shunda barcha yozish amallari token so'raydi.

## Prognoz qanday hisoblanadi

Har bir rejalashtirilgan post uchun shu platformadagi (va shu formatdagi) kamida 3 kunlik o'tmish postlar olinadi:

- **asos:** oxirgi 45 kundagi ko'rishlar medianasi;
- **omillar:** soat bloki (2 soatlik), hafta kuni va mavzu. Har biri shu guruh medianasining umumiy medianaga nisbati. Kichik guruhlar 1 ga yaqinlashtiriladi, shunda 2-3 ta post natijani buzib yubormaydi;
- **oraliq:** tarixiy 25 va 80 persentil;
- **obunachilar:** medianaviy "obunachi / ko'rish" nisbati.

Ishonch darajasi: 20+ o'xshash post bo'lsa *yuqori*, 8+ bo'lsa *o'rta*, undan kam bo'lsa *past*.

## Avtomatlashtirish (worker va API)

Panelda ikki xil rejim bor:

1. **Simulyatsiya** (standart). Server vaqti kelgan tayyor postlarni o'zi "joylangan" deb belgilaydi va statistikani modeldan hisoblaydi. Panelni sinab ko'rish uchun.
2. **Worker rejimi.** *Konveyer va API* sahifasida simulyatsiyani o'chiring va workerni ishga tushiring:

```bash
npm run worker
```

Worker har daqiqada `/api/queue` ni o'qiydi, vaqti kelgan postni platformaga yuklaydi va natijani panelga yuboradi. Video fayllar `media/<videoId>.mp4` dan olinadi. Telegram adapteri tayyor (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`). YouTube, Instagram, TikTok va Facebook adapterlarining skeleti [tools/worker.mjs](tools/worker.mjs) ichida: kalitlar `.env` ga yoziladi, yuklash chaqiruvi shu funksiyalarga yoziladi.

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/api/queue` | Joylash navbati: tayyorlik foizi, tavsif va hashtaglar bilan |
| GET | `/api/queue/next` | Keyingi tayyor post |
| POST | `/api/posts/:id/published` | `{url, publishedAt}`: joylandi |
| POST | `/api/posts/:id/failed` | `{error}`: xato, panelda ogohlantirish chiqadi |
| POST | `/api/posts/:id/stats` | `{stats:{views,likes,comments,shares,saves,subs,retention}}` |
| POST | `/api/videos` | `{title, topic, format}`: yangi video, masalan `render.mjs` dan |
| GET | `/api/export.csv` | Barcha postlar CSV |
| GET | `/api/state` | To'liq holat (panel uchun) |

## Tuzilishi

```
server.mjs            HTTP server, JSON baza, API (bog'liqliksiz)
public/js/core.js     ma'lumot modeli, amallar, analitika, prognoz (server va brauzer uchun umumiy)
public/js/app.js      interfeys
public/js/charts.js   SVG grafiklar
public/css/app.css    dizayn
tools/worker.mjs      joylash workeri
tests/                node --test
```

GitHub Pages'da `public/` papkasi statik demo sifatida chiqadi: API bo'lmagani uchun panel o'zi demo rejimga o'tadi.

```bash
npm test
```
