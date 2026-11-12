# Kontent Zavod — admin panel

Videolarni ijtimoiy tarmoqlarga joylab boradigan kontent zavodining boshqaruv paneli: g'oyadan joylashgacha bo'lgan butun liniya, joylash navbati, natijalar, prognoz va tavsiyalar.

Panelda alohida **Narxtop** bo'limi ham bor: ish beruvchi (NARXTOP) yuboradigan video vazifalari, to'lovlar, Excel hisobot va Telegram bot ([pastda batafsil](#narxtop-bolimi)).

**Ishlab turgan panel:** https://kontent-zavod-8y6n.onrender.com — login va parol bilan kiriladi.
**Jonli demo:** https://sardorziyodullayev.github.io/kontent-zavod/ — demo ma'lumotlar brauzeringizda saqlanadi (Narxtop bo'limi demoda yopiq).

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
| Excel hisobot | **ExcelJS** |
| Testlar | **Vitest** |

Prognoz, tahlil va ogohlantirishlar mantig'i `src/core/` da yozilgan va umumiy: uni brauzer, server va worker bir xil ishlatadi.

## Bo'limlar

| Bo'lim | Nima ko'rsatadi |
|---|---|
| **Narxtop** | Ish beruvchi vazifalari: oylar, holatlar, uslub va yo'nalish, to'lovlar, Excel hisobot. Ish beruvchi faqat shu bo'limni ko'radi |
| **Boshqaruv** | Keyingi video va soniyalab sanoq. Tayyorlik konveyeri (8 bosqich, bosib belgilanadi). Har platforma uchun ko'rishlar va obunachilar prognozi, ishonch darajasi bilan. Ogohlantirishlar, KPI, kunlik ko'rishlar grafigi, platformalar ulushi, yaqin 7 kun, oxirgi joylanganlar, oylik maqsadlar, faoliyat jurnali |
| **Videolar** | Qaysi platformaga, qaysi kuni, soat nechida joylangan; ko'rishlar, ER, tomosha foizi, yangi obunachilar. Qidiruv, filtrlar va saralash URL'da saqlanadi (havolani ulashsa bo'ladi), CSV eksport |
| **Reja va kalendar** | Oylik kalendar (tayyor / tayyor emas / joylangan / xato), haftalik maqsad, platformalar bo'yicha eng yaxshi soatlar |
| **Ssenariylar** | Kanban: G'oya → Ssenariy → Suratga olish → Montaj → Tayyor → Rejalashtirilgan → Joylandi. Ssenariy muharriri: hook, CTA, so'z soni, taxminiy davomiylik, 4 ta shablon |
| **Tahlil** | Avtomatik tavsiyalar, kun×soat issiqlik xaritasi, mavzular reytingi, obunachiga aylanish, qisqa va uzun video taqqoslash, obunachilar o'sishi, eng yaxshi 10 post |
| **Platformalar** | YouTube, Instagram, TikTok, Telegram, Facebook: obunachilar, 30 kunlik o'sish, token holati, ulash/uzish |
| **Konveyer va API** | Ishlab chiqarish liniyasi, joylash navbati (tayyorlik, prognoz), worker uchun API |
| **Sozlamalar** | Mening profilim (parol, Telegram, til), foydalanuvchilar (faqat admin), maqsadlar, JSON/CSV eksport-import, qorong'i/yorug' mavzu |

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

### Kirish: login va parol

Panelga **login va parol** bilan kiriladi. Foydalanuvchilar *Sozlamalar → Foydalanuvchilar* da yaratiladi (faqat admin):

| Rol | Nimani ko'radi |
|---|---|
| **Admin** | Butun panel |
| **Mijoz** | Faqat Narxtop bo'limi (server ham boshqa API'larni yopadi) |

- Parol scrypt bilan saqlanadi (kamida 8 belgi); sessiya — imzolangan token (60 kun). Parol o'zgarsa, eski sessiyalar bekor bo'ladi.
- Admin bergan parol **vaqtinchalik**: foydalanuvchi birinchi kirishda o'z parolini qo'yadi.
- 15 daqiqada 10 ta xato urinishdan keyin kirish vaqtincha yopiladi — IP bo'yicha ham, login bo'yicha ham (IP almashtirib taxmin qilish ham to'xtaydi).
- Xavfsizlik sarlavhalari: CSP, HSTS, nosniff ([server/index.ts](server/index.ts)). Sahifani faqat o'zimiz va Telegram ichiga joylash mumkin.
- `ADMIN_TOKEN` avtomatlashtirish (worker, skriptlar) uchun ishlashda davom etadi; kirish oynasida *Token bilan kirish* havolasi zaxira yo'l sifatida bor. Birinchi admin loginini shu token bilan kirib yaratasiz.
- Mahalliy rejimda (`ADMIN_TOKEN` ham, foydalanuvchi ham yo'q) panel kirishsiz ochiladi. `NODE_ENV=production` da token kamida 16 belgi bo'lmasa server ishga tushmaydi.

## Serverga chiqarish

[Dockerfile](Dockerfile) panel, API, joylash workeri va Telegram botni bitta konteynerda ishga tushiradi.

### Render (ishlab turgan panel)

Panel **Render**'ning tekin web xizmatida: `kontent-zavod`, https://kontent-zavod-8y6n.onrender.com. Sozlamalar [render.yaml](render.yaml) da.

- **Deploy:** `main` ga push qilinsa, Render o'zi yig'ib chiqaradi (3–5 daqiqa). Bazadagi migratsiyalar server ishga tushganda avtomatik qo'llanadi.
- **Baza — Turso** (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`). Render free diski doimiy emas, shuning uchun media va worker fayllari ham bazada saqlanadi va server yonganda tiklanadi ([server/files.ts](server/files.ts)); holati `/api/health` da.
- **Uxlab qolmaslik:** server o'z manziliga har 10 daqiqada so'rov yuboradi, GitHub Actions ham har 5 daqiqada uyg'otadi.
- Muhit o'zgaruvchilari Render → Environment da; mahalliy nusxasi gitignore qilingan `.env.render` faylida (hech qayerga yuklanmaydi).

| O'zgaruvchi | Qiymat |
|---|---|
| `ADMIN_TOKEN` | uzun tasodifiy satr: worker, skriptlar va zaxira kirish uchun |
| `SESSION_SECRET` | ixtiyoriy: sessiya imzosi kaliti (bo'lmasa `ADMIN_TOKEN` dan olinadi) |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Turso bazasi (`libsql://…`) |
| `TELEGRAM_BOT_TOKEN` | bot (@PostchiAI_bot): kanalga joylash, Narxtop bot, xabarlar |
| `TELEGRAM_CHANNEL` | joylanadigan Telegram kanal |
| `TELEGRAM_OWNER_ID` | Sardorning Telegram ID si: tasdiqlar va Narxtop xabarlari |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | YouTube'ga yuklash va statistika |
| `WORKER` | `1` (standart): worker va bot server ichida ishlaydi. Alohida worker ishlatsangiz `0`, aks holda post ikki marta joylanadi |
| `PUBLIC_URL` | ixtiyoriy: bot xabarlaridagi panel havolasi (bo'lmasa `RENDER_EXTERNAL_URL`) |
| `DIGEST_AUTO` | `1` bo'lsa, ertalabki hisobot har kuni avtomatik yuboriladi (standart: o'chiq) |
| `SEED` | `empty`: bo'sh bazada namunaviy ma'lumot yaratilmaydi |

Tekshiruv manzili: `GET /api/health` (kirish so'ramaydi).

**Muhim:** workerni (va botni) mahalliy kompyuterda production tokeni bilan ishga tushirmang — u production botning xabarlarini tortib oladi.

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

### YouTube'ni ulash

1. [Google Cloud Console](https://console.cloud.google.com/) da loyiha yarating va **YouTube Data API v3** ni yoqing.
2. *Google Auth Platform → Audience*: turi **External**, holati **In production** (Testing holatida token 7 kunda eskiradi). "Tasdiqlanmagan ilova" ogohlantirishida *Advanced → davom etish* ni bosasiz, bu o'zingiz uchun yetarli.
3. *Clients → Create client → Desktop app*, JSON faylini yuklab, loyiha papkasiga `client_secret_….json` nomi bilan qo'ying (GitHub'ga yuklanmaydi).
4. `npm run youtube:auth`: brauzer ochiladi, kanalni tanlab ruxsat berasiz, kalitlar `.env` ga yoziladi.
5. Serverga: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` ni Render o'zgaruvchilariga qo'shing.

Worker har 30 daqiqada kanal obunachilarini va joylangan YouTube videolarining ko'rish, layk, izohlarini oladi (qo'lda joylab, *Joyladim* tugmasi bilan havolasini kiritgan videolar ham). Yuklash uchun video kartasidagi **Video fayl** bo'limidan MP4 yuklang.

**Cheklov:** audit qilinmagan API loyihasi yuklagan videolarni YouTube **yopiq (private)** qoldiradi. Ochiq joylash uchun Google'ning [YouTube API audit](https://support.google.com/youtube/contact/yt_api_form) formasini to'ldiring. Statistika o'qish auditsiz ishlaydi.

Worker har daqiqada `/api/queue` ni o'qiydi, vaqti kelgan postni platformaga yuklaydi va natijani panelga yuboradi. Video fayllar `media/<videoId>.mp4` dan olinadi. Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`) va YouTube adapterlari tayyor. Instagram, TikTok va Facebook adapterlarining skeleti [tools/worker.ts](tools/worker.ts) ichida.

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

## Narxtop bo'limi

Sardor NARXTOP uchun AI videolar tayyorlaydi. Ish beruvchi ssenariylarni yuboradi va ishni boshliqlarga hisobot qiladi. Ilgari bu Google jadvalda (`AI Videos | NARXTOP`) yuritilardi; endi panelda va Telegram botda. Bo'lim asosan **ish beruvchi uchun** qulay qilib qurilgan.

### Kim nima qiladi

| | Ish beruvchi (mijoz) | Sardor (admin) |
|---|---|---|
| Kiradi | login/parol → faqat Narxtop sahifasi | butun panel, menyuda birinchi bo'lim |
| Vazifa | saytda yoki botga ssenariy yuboradi | ishlaydi, video havolasini qo'yadi, holatni o'zgartiradi |
| To'lov | bergan summasini yozadi (⏳ tasdiq kutadi) | "✅ Oldim" bilan tasdiqlaydi yoki o'zi yozadi (darhol tasdiqlangan) |
| Hisobot | Excel yuklab oladi (sayt yoki bot) | xuddi shunday |

### Saytda (`/#/narxtop`)

- **Oylar** — shartnoma oylari ("1-oy", "2-oy"…). Yangi oy ochilsa, oldingisi o'zi **yakunlanadi** (✓); *Oyni yakunlash* / *Qayta ochish* tugmalari bor. **Barcha oylar** tabi — har oy natijasi va to'lovi bir jadvalda.
- **Vazifalar** — holat: *Yangi → Ishlanmoqda → Tekshiruvda → Tuzatish → Tayyor*. Ro'yxatda holatni bir bosishda o'zgartirish mumkin. Vazifa kartasida: yo'nalish, **uslub** (Motion / 2D animatsiya / Realistik), video havolasi, muddat, ssenariy, Telegram'dan kelgan fayllar, izohlar va o'zgarishlar tarixi.
- **Yo'nalishlar bo'yicha** — sonlar avtomatik (jadvaldagi qo'lda sanash o'rniga). Yo'nalish nomlari bir xil yoziladi ("Аавтосалоны"/"Автосалон" → Avtosalonlar).
- **To'lovlar** — oy summasi, to'langan, qoldiq, progress; har to'lovda kim yozgani va tasdiq holati. Tezkor summa: "Butun qoldiq", "Yarmi".
- **Arxiv** — vazifa o'chirilmaydi, arxivga olinadi va istalgan payt tiklanadi (*Arxiv* filtri). Butunlay o'chirish faqat adminda.
- **Zaxira nusxa** — *Sozlamalar → Narxtop zaxira nusxasi*: oylar, vazifalar (arxiv bilan) va to'lovlar bitta JSON faylda; shu fayldan tiklash ham shu yerda (faqat admin).
- **Til** — UZ | RU (sarlavhada, kirish oynasida, profilda). Mijozlar uchun standart — rus tili. Tanlov profilga yoziladi: bot va Telegram xabarlari ham shu tilda.
- Telefon uchun moslangan; qorong'i va yorug' mavzu.

### Excel hisobot

Ish beruvchining Google jadvali ko'rinishida ([server/narxtop.ts](server/narxtop.ts) → `buildReport`): har oy alohida blok, teal sarlavhalar, har qator o'z yo'nalishining rangida, yashil "Готово", o'ngda yig'ma (yo'nalish/uslub soni, "28 видео из 29", to'lov). 2-varaq — to'lovlar ro'yxati (kim yozdi, tasdiq). Hisobot **saytda tanlangan tilda** tuziladi; bir oy yoki barcha oylar uchun.

### Telegram bot (@PostchiAI_bot)

Ulash: saytda *Telegram'ni ulash* → botda *Start* (bir martalik havola, 30 daqiqa). Shundan keyin pastda doimiy tugmalar chiqadi:

| Tugma | Vazifasi |
|---|---|
| 📝 Vazifa qo'shish | ssenariy matn yoki fayl (.docx, .pdf) bo'lib yuboriladi; keyin yo'nalish va uslub tugmalar bilan tanlanadi |
| 📋 Vazifalar | bajarilmaganlar tugma bo'lib chiqadi; vazifa kartasidan holatni o'zgartirish |
| 💰 To'lovlar | to'langan, qoldiq, "To'lov qo'shish" (`1 000 000`, `1.5 млн аванс`, `500 тыс` kabi yozuvlarni tushunadi) |
| 📊 Oylik hisobot | oy tanlanadi → Excel fayl |
| 🌐 Til | o'zbekcha / ruscha |
| ℹ️ Yordam | qisqa yo'riqnoma va panel havolasi |

Mijoz botga ssenariyga o'xshagan xabar (fayl, bir necha qator yoki 40+ belgi) yozsa, darhol vazifa bo'ladi; qisqa xabardan ("ok", "rahmat") va Sardorning xabaridan keyin bot "Vazifa qilib qo'shaymi?" deb so'raydi. Bot long polling bilan ishlaydi (javob darhol keladi). Xabarlar: yangi vazifa, "Tekshiring", "Tayyor", "Tuzatish kerak", to'lov yozildi / tasdiqlandi — har kimga o'z tilida.

### Ma'lumotlar va API

Jadvallar ([server/schema.ts](server/schema.ts)): `users` (login, rol, til, Telegram), `periods` (oylar, summa, yakunlangan vaqt), `orders` (vazifalar, tarix, fayllar), `payments` (to'lovlar, kim yozdi, tasdiq).

| Metod | Yo'l | Vazifasi |
|---|---|---|
| POST | `/api/auth/login` | `{login, password}` → sessiya tokeni |
| GET | `/api/me` | kim kirgan (rol, til, Telegram) |
| POST | `/api/me/lang`, `/api/me/password`, `/api/me/telegram` | til, parol, Telegram havolasi |
| GET/POST/PATCH/DELETE | `/api/users…` | foydalanuvchilar (admin) |
| GET | `/api/narxtop` | oylar, vazifalar, to'lovlar, yo'nalish va uslublar |
| POST/PATCH/DELETE | `/api/narxtop/orders…`, `/periods…`, `/payments…` | vazifa, oy, to'lov |
| POST | `/api/narxtop/payments/:id/confirm` | to'lovni tasdiqlash (admin) |
| DELETE / POST | `/api/narxtop/orders/:id`, `/orders/:id/restore` | arxivga olish (`?hard=1` — butunlay, admin) va tiklash |
| GET / POST | `/api/narxtop/backup.json`, `/api/narxtop/restore` | zaxira nusxa va undan tiklash (admin) |
| GET | `/api/narxtop/report.xlsx?period=<id\|all>&lang=<uz\|ru>` | Excel hisobot |
| POST | `/api/narxtop/tg/…`, `/api/users/tg-…` | bot uchun (ADMIN_TOKEN bilan, Telegram foydalanuvchisi nomidan) |

Mantiq va matnlar [src/core/narxtop.ts](src/core/narxtop.ts) da (holatlar, rus tilidagi nomlar, hisob, summa o'qish, bot matnlari), testlari [tests/narxtop.test.ts](tests/narxtop.test.ts).

### Bir martalik skriptlar (production'da bajarilgan — qayta ishga tushirmang)

| Skript | Nima qilgan |
|---|---|
| [tools/import-narxtop.ts](tools/import-narxtop.ts) | Google jadvaldan 1-oy (35) va 2-oy (29) vazifalari, summalar va to'lovlar (2026-11-10). Qayta ishga tushirilsa, hammasi ikki marta yoziladi |
| [tools/fill-styles.ts](tools/fill-styles.ts) | uslubi yo'q vazifalarga nomidan uslub qo'ygan ("Моушн видео…" → Motion, seriallar → 2D animatsiya). Qayta ishlatish xavfsiz, `--dry` bilan tekshiring |

## Tuzilishi

```
src/
  core/          ma'lumot modeli, amallar, analitika, prognoz; narxtop.ts — Narxtop mantiqi va bot matnlari
  components/    qobiq, kirish, profil, video kartasi, dialoglar, grafiklar, ui/ (Button, Card, Dialog…)
  pages/         9 ta sahifa (narxtop.tsx — Narxtop bo'limi)
  lib/           TanStack Query ma'lumot qatlami, UI holati, lang.ts — UZ/RU
server/
  index.ts       Hono API, statik panel
  auth.ts        login/parol, sessiya, rollar, foydalanuvchilar, Telegram xabarlari
  narxtop.ts     Narxtop API va Excel hisobot
  schema.ts      Drizzle sxemasi
  files.ts       media va worker fayllarini bazada saqlash (Render free)
drizzle/         SQL migratsiyalar (server yonganda qo'llanadi)
tools/
  worker.ts      joylash workeri va Telegram bot (Narxtop tugmalari ham)
  import-narxtop.ts, fill-styles.ts   bir martalik skriptlar
tests/           Vitest
```

GitHub Pages'da `dist/` statik demo sifatida chiqadi: API bo'lmagani uchun panel o'zi demo rejimga o'tadi.
