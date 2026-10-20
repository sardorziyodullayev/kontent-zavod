# Kontent Zavod — admin panel

Videolarni ijtimoiy tarmoqlarga joylab boradigan kontent zavodining boshqaruv paneli: g'oyadan joylashgacha bo'lgan butun liniya, joylash navbati, natijalar, prognoz va tavsiyalar.

**Jonli demo:** https://sardorziyodullayev.github.io/kontent-zavod/ — demo ma'lumotlar brauzeringizda saqlanadi.

## Texnologiyalar

| Qatlam | Nima ishlatilgan |
|---|---|
| Interfeys | **React 19**, **TypeScript 7**, **Vite 8** |
| Dizayn | **Tailwind CSS 4**, shadcn/ui uslubidagi komponentlar (**Radix UI** dialog), **lucide-react** ikonlar |
| Ma'lumot va marshrutlar | **TanStack Query 5** (server holati, kesh, avtomatik yangilanish), **TanStack Router** (sahifalar, URL'dagi filtrlar) |
| Grafiklar | **Recharts 3** + qo'lda yozilgan SVG (sparkline, issiqlik xaritasi) |
| Kanban | **dnd-kit** (sudrab o'tkazish) |
| Buyruqlar palitrasi | **cmdk** (<kbd>Ctrl K</kbd>) |
| Server | **Hono 4** (Node.js) |
| Baza | **SQLite** (libSQL) + **Drizzle ORM**, migratsiyalar `drizzle/` papkasida |
| Testlar | **Vitest** |

Prognoz, tahlil va ogohlantirishlar mantig'i `src/core/` da yozilgan va umumiy: uni brauzer, server va worker bir xil ishlatadi.

## Bo'limlar

| Bo'lim | Nima ko'rsatadi |
|---|---|
| **Boshqaruv** | Keyingi video va soniyalab sanoq. Tayyorlik konveyeri (8 bosqich, bosib belgilanadi). Har platforma uchun ko'rishlar va obunachilar prognozi, ishonch darajasi bilan. Ogohlantirishlar, KPI, kunlik ko'rishlar grafigi, platformalar ulushi, yaqin 7 kun, oxirgi joylanganlar, oylik maqsadlar, faoliyat jurnali |
| **Videolar** | Qaysi platformaga, qaysi kuni, soat nechida joylangan; ko'rishlar, ER, tomosha foizi, yangi obunachilar. Qidiruv, filtrlar va saralash URL'da saqlanadi (havolani ulashsa bo'ladi), CSV eksport |
| **Reja va kalendar** | Oylik kalendar (tayyor / tayyor emas / joylangan / xato), haftalik maqsad, platformalar bo'yicha eng yaxshi soatlar |
| **Ssenariylar** | Kanban: G'oya → Ssenariy → Suratga olish → Montaj → Tayyor → Rejalashtirilgan → Joylandi. Ssenariy muharriri: hook, CTA, so'z soni, taxminiy davomiylik, 4 ta shablon |
| **Tahlil** | Avtomatik tavsiyalar, kun×soat issiqlik xaritasi, mavzular reytingi, obunachiga aylanish, qisqa va uzun video taqqoslash, obunachilar o'sishi, eng yaxshi 10 post |
| **Platformalar** | YouTube, Instagram, TikTok, Telegram, Facebook: obunachilar, 30 kunlik o'sish, token holati, ulash/uzish |
| **Konveyer va API** | Ishlab chiqarish liniyasi, joylash navbati (tayyorlik, prognoz), worker uchun API |
| **Sozlamalar** | Maqsadlar, JSON/CSV eksport-import, demo ma'lumotlarni tiklash, qorong'i/yorug' mavzu |

Qo'shimcha ravishda panel quyidagilarni kuzatadi:

- **Tayyor emaslik.** Joylashga 72 soatdan kam qolgan va to'liq tayyor bo'lmagan videoni ko'rsatadi, nima yetishmasligini ham yozadi.
- **Token muddati.** Platforma tokeni tugashidan 7 kun oldin eslatadi.
- **Bo'sh kunlar.** Keyingi 7 kundagi rejasiz kunlarni ko'rsatadi.
- **Xato va qayta urinish.** Joylash xato bersa bitta tugma bilan qayta urinish mumkin.
- **Trend signali.** Post odatdagidan 2.5 baravar tez o'sayotgan bo'lsa xabar beradi.
- **Maqsad sur'ati.** Hozirgi tezlikda oy oxirida qancha bo'lishini hisoblaydi.

## Ishga tushirish

Node.js 20.19+ kerak.

```bash
npm install
npm run dev
```

- Panel: http://localhost:5173 (Vite, o'zgarishlar darhol ko'rinadi)
- API: http://localhost:4310/api

Production rejimi (bitta port):

```bash
npm run build
npm start
```

Shunda panel ham, API ham http://localhost:4310 da ishlaydi. Ma'lumotlar `data/zavod.db` (SQLite) faylida saqlanadi. Birinchi ishga tushirishda 90 kunlik namunaviy ma'lumot yaratiladi. Sozlamalar → *Demo ma'lumotlarni tiklash* bilan qayta boshlash mumkin.

Serverni internetga chiqarsangiz `ADMIN_TOKEN` o'rnating (`.env.example` dan `.env` nusxa oling). Shunda butun API token so'raydi, panel esa kirish oynasini ko'rsatadi. `NODE_ENV=production` da token kamida 16 belgi bo'lmasa server ishga tushmaydi.

## Serverga chiqarish (Docker)

[Dockerfile](Dockerfile) panel, API va joylash workerini bitta konteynerda ishga tushiradi. Docker'ni qo'llaydigan har qanday hostingda ishlaydi (Railway, Fly.io, Render, Koyeb, VPS).

1. `/data` yo'liga doimiy disk (volume) ulang. Baza (`zavod.db`) va `media/` shu yerda saqlanadi.
2. Muhit o'zgaruvchilari:

| O'zgaruvchi | Qiymat |
|---|---|
| `ADMIN_TOKEN` | uzun tasodifiy satr, panelga kirish uchun |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL` | Telegram'ga joylash uchun |
| `WORKER` | `1` (standart): worker server ichida ishlaydi. Alohida worker ishlatsangiz `0` qiling, aks holda post ikki marta joylanadi |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | ixtiyoriy: diskli hosting bo'lmasa Turso (`libsql://…`) bazasi |

3. Tekshiruv manzili: `GET /api/health` (token so'ramaydi).

### Railway

Ishlab turgan panel Railway'da joylashgan: `kontent-zavod` loyihasi, `web` xizmati, `/data` diski. Xizmat GitHub reposiga ulangan, shuning uchun `main` ga qilingan har bir push avtomatik deploy qilinadi. Sozlamalar [railway.json](railway.json) faylida (healthcheck `/api/health`).

```bash
npm i -g @railway/cli
railway login
railway link            # kontent-zavod → web
railway logs            # server loglari
railway variable list   # o'zgaruvchilar
```

Haqiqiy joylash uchun panelda simulyatsiyani o'chiring (*Konveyer va API*). Simulyatsiya yoqilgan paytda worker hech narsa yubormaydi.

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Vite + API (o'zgarishda qayta yuklanadi) |
| `npm run build` | Tip tekshiruvi + production build (`dist/`) |
| `npm start` | API + tayyor panel |
| `npm test` | Vitest testlari |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run worker` | Joylash workeri |
| `npm run db:generate` | Sxema o'zgarganda yangi Drizzle migratsiyasi |

## Prognoz qanday hisoblanadi

Har bir rejalashtirilgan post uchun shu platformadagi (va shu formatdagi) kamida 3 kunlik o'tmish postlar olinadi:

- **asos:** oxirgi 45 kundagi ko'rishlar medianasi;
- **omillar:** soat bloki (2 soatlik), hafta kuni va mavzu. Har biri shu guruh medianasining umumiy medianaga nisbati. Kichik guruhlar 1 ga yaqinlashtiriladi, shunda 2-3 ta post natijani buzib yubormaydi;
- **oraliq:** tarixiy 25 va 80 persentil;
- **obunachilar:** medianaviy "obunachi / ko'rish" nisbati.

Ishonch darajasi: 20+ o'xshash post bo'lsa *yuqori*, 8+ bo'lsa *o'rta*, undan kam bo'lsa *past*.

## Avtomatlashtirish (worker va API)

1. **Simulyatsiya** (standart). Server vaqti kelgan tayyor postlarni o'zi "joylangan" deb belgilaydi va statistikani modeldan hisoblaydi. Panelni sinab ko'rish uchun.
2. **Worker rejimi.** *Konveyer va API* sahifasida simulyatsiyani o'chiring va `npm run worker` ni ishga tushiring.

Worker har daqiqada `/api/queue` ni o'qiydi, vaqti kelgan postni platformaga yuklaydi va natijani panelga yuboradi. Video fayllar `media/<videoId>.mp4` dan olinadi. Telegram adapteri tayyor (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`). YouTube, Instagram, TikTok va Facebook adapterlarining skeleti [tools/worker.ts](tools/worker.ts) ichida.

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/api/queue` | Joylash navbati: tayyorlik foizi, tavsif va hashtaglar bilan |
| GET | `/api/queue/next` | Keyingi tayyor post |
| POST | `/api/posts/:id/published` | `{url, publishedAt}`: joylandi |
| POST | `/api/posts/:id/failed` | `{error}`: xato, panelda ogohlantirish chiqadi |
| POST | `/api/posts/:id/stats` | `{stats:{views,likes,comments,shares,saves,subs,retention}}` |
| POST | `/api/videos` | `{title, topic, format}`: yangi video |
| POST | `/api/action` | Panelning barcha amallari (`{type, payload}`) |
| GET | `/api/export.csv` | Barcha postlar CSV |
| GET | `/api/state` | To'liq holat |

## Tuzilishi

```
src/
  core/          ma'lumot modeli, amallar, analitika, prognoz (brauzer + server + worker)
  components/    qobiq, video kartasi, dialoglar, grafiklar, ui/ (Button, Card, Dialog…)
  pages/         8 ta sahifa
  lib/           TanStack Query ma'lumot qatlami, UI holati
server/          Hono API, Drizzle sxemasi, SQLite
drizzle/         SQL migratsiyalar
tools/worker.ts  joylash workeri
tests/           Vitest
```

GitHub Pages'da `dist/` statik demo sifatida chiqadi: API bo'lmagani uchun panel o'zi demo rejimga o'tadi.
