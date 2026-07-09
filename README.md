# Quiz — Telegram Mini App

Telegram bot ichida ochiladigan test ilovasi. **Ma'lumotlar bazasi yo'q** — mavzular va natijalar JSON fayllarda saqlanadi.

- Next.js (App Router, **JavaScript**), React 19
- Mobile-first, faqat telefon uchun mo'ljallangan qorong'i interfeys
- Telegram profil (ism, familiya, username, rasm, premium) ilovada ko'rinadi
- To'g'ri javobda yashil, xatoda qizil haptik titrash
- Admin: savol yuklash, savol qo'shish, savol turi va mavzu bo'yicha vaqt belgilash, foydalanuvchi natijalarini ko'rish

## Ishga tushirish

```bash
npm install
cp .env.example .env.local   # keyin qiymatlarni to'ldiring
npm run dev
```

`.env.local`:

| O'zgaruvchi | Izoh |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan token. `initData` imzosini tekshirish uchun **majburiy**. |
| `ADMIN_IDS` | Admin panelga kira oladigan Telegram ID'lar, vergul bilan: `123456,789012`. O'z ID'ingizni @userinfobot dan oling. |
| `DEV_ALLOW_UNSAFE` | `1` bo'lsa imzo tekshirilmaydi va brauzerda ochish mumkin. **Productionda 0 bo'lishi shart.** |

### Botga ulash

Ilova HTTPS manzilda turishi kerak (Telegram HTTP'ni qabul qilmaydi).

```bash
# Lokal sinash uchun tunnel
npx localtunnel --port 3000

# Menu button'ni ulash
node scripts/setup-bot.mjs <BOT_TOKEN> https://sizning-manzilingiz
```

Keyin botni oching va pastdagi **Testlar** tugmasini bosing.

## Fayl tuzilishi

```
quests/
  the-noun.json        <- mavzu. Fayl nomi = mavzu identifikatori (slug)
data/                  <- avtomatik yaratiladi, git'ga tushmaydi
  settings.json        <- vaqt sozlamalari
  users/<id>.json      <- Telegram profil nusxasi
  results/<id>.json    <- foydalanuvchining barcha urinishlari va tahlili
```

### Mavzu JSON formati

Fayl nomi mavzu nomiga aylanadi: `quests/the-noun.json` → **The Noun**.

```json
{
  "title": "The Noun",
  "questions": [
    {
      "number": 1,
      "difficulty": "easy",
      "category": "theory",
      "type": "true_false",
      "question": "Otlar gapda ega vazifasida keladi.",
      "answer": "True",
      "explanation": "Javobdan keyin ko'rsatiladigan izoh."
    },
    {
      "number": 2,
      "difficulty": "medium",
      "category": "theory",
      "type": "multiple_choice",
      "question": "Qaysi ot turi bosh harf bilan yoziladi?",
      "options": { "A": "Common", "B": "Proper", "C": "Abstract", "D": "Uncountable" },
      "answer": "B",
      "explanation": "Proper nouns har doim bosh harf bilan yoziladi.",
      "time_limit": 45
    }
  ]
}
```

- `type`: `true_false` yoki `multiple_choice`
- `difficulty`: `easy` | `medium` | `hard`
- `time_limit` (ixtiyoriy): shu savol uchun soniya

Yuklashda sxema serverda tekshiriladi — xato bo'lsa fayl saqlanmaydi va aniq xatolar ro'yxati qaytadi.

## Vaqt ustuvorligi

Har bir savolning vaqti shu tartibda aniqlanadi (birinchi topilgani ishlaydi):

1. Savoldagi `time_limit`
2. Mavzu + savol turi (admin panel → **Vaqt** → mavzu)
3. Mavzuning standart vaqti
4. Global savol turi (admin panel → **Vaqt** → global)
5. Global standart (30 soniya)

## Xavfsizlik

- Har bir API so'rovi Telegram `initData` HMAC imzosi bilan tekshiriladi; 24 soatdan eski `initData` rad etiladi.
- **To'g'ri javoblar clientga yuborilmaydi.** Savollar `answer` va `explanation`siz keladi; har bir javob `/api/quiz/check` orqali serverda tekshiriladi, yakuniy ball ham serverda hisoblanadi.
- Admin endpoint'lari `ADMIN_IDS` bo'yicha tekshiriladi (401/403).
- Mavzu slug'lari `[a-z0-9-_]` bilan cheklangan — path traversal mumkin emas.

## Joylashtirish (deploy)

Ilova `data/` papkasiga **yozadi**, shuning uchun doimiy diskka ega hosting kerak: VPS, Railway, Render, Fly.io yoki Docker volume.

> Vercel'ning serverless muhitida fayl tizimi vaqtinchalik — natijalar saqlanmaydi. Vercel'da ishlatish uchun `lib/store.js` ni tashqi saqlagichga (masalan S3 yoki Postgres) o'tkazish kerak bo'ladi.

```bash
npm run build
npm start          # 3000-portda
```
