import { tgCall, webhookSecret, appUrl, escapeHtml, formatDuration } from '@/lib/telegram'
import { listTopicSlugs, readTopic, readSettings, listAttempts } from '@/lib/store'

export const dynamic = 'force-dynamic'

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'

/**
 * Telegram webhook'i. Bot yangilanishlarini (xabarlar, tugma bosishlar) qabul
 * qiladi. setup-bot.mjs bu manzilni (`/api/bot`) va maxfiy tokenni o'rnatadi.
 */
export async function POST(request) {
  // Faqat Telegram (to'g'ri maxfiy token bilan) so'rov yubora oladi.
  if (request.headers.get(SECRET_HEADER) !== webhookSecret()) {
    return new Response('forbidden', { status: 403 })
  }

  const update = await request.json().catch(() => null)
  if (!update) return Response.json({ ok: true })

  try {
    if (update.message) await onMessage(update.message)
    else if (update.callback_query) await onCallback(update.callback_query)
  } catch (e) {
    // Telegram xatoda so'rovni qayta yuboradi — biz doim 200 qaytaramiz.
    console.error('bot handler error:', e)
  }
  return Response.json({ ok: true })
}

/* ------------------------------------ Menyular ---------------------------- */

function mainMenu(name) {
  const hi = name ? `, ${escapeHtml(name)}` : ''
  return {
    text:
      `Assalomu alaykum${hi}! 👋\n\n` +
      `Bu — mavzular bo'yicha testlar ilovasi. Bilimingizni sinang va natijalaringizni kuzating.\n\n` +
      `Quyidagidan tanlang:`,
    reply_markup: {
      inline_keyboard: [
        [{ text: '📚 Testlar', callback_data: 'tests' }],
        [{ text: '📊 Natijalarim', callback_data: 'results' }],
      ],
    },
  }
}

async function onMessage(msg) {
  const text = msg.text || ''
  if (text.startsWith('/start')) {
    const m = mainMenu(msg.from?.first_name)
    await tgCall('sendMessage', { chat_id: msg.chat.id, parse_mode: 'HTML', ...m })
  }
}

async function onCallback(cq) {
  const chatId = cq.message?.chat?.id
  const messageId = cq.message?.message_id
  const edit = (patch) =>
    tgCall('editMessageText', { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', ...patch })

  try {
    if (cq.data === 'menu') await edit(mainMenu(cq.from?.first_name))
    else if (cq.data === 'tests') await edit(await testsMenu())
    else if (cq.data === 'results') await edit(await resultsMenu(cq.from?.id))
  } finally {
    // Tugmadagi "yuklanmoqda" aylanasini to'xtatadi.
    await tgCall('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {})
  }
}

/* -------------------------------- Testlar ro'yxati ------------------------ */

async function testsMenu() {
  const app = appUrl()
  const settings = await readSettings()
  const slugs = await listTopicSlugs()

  const rows = []
  for (const slug of slugs) {
    const t = await readTopic(slug)
    if (!t) continue
    const title = settings.topics?.[slug]?.title || t.title || slug
    const label = `${title} · ${t.questions.length} savol`
    // web_app tugmasi ilovani shu mavzuga to'g'ridan-to'g'ri ochadi.
    rows.push([{ text: label, web_app: { url: `${app}/quiz/${slug}` } }])
  }
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'menu' }])

  if (!app) {
    return {
      text: '⚠️ Ilova manzili sozlanmagan (APP_URL). Admin bilan bog\'laning.',
      reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'menu' }]] },
    }
  }
  return {
    text: slugs.length
      ? "📚 <b>Mavzular</b>\n\nTestni tanlang — ilova shu mavzuda ochiladi:"
      : "Hozircha mavzu yo'q. Admin panel orqali birinchi testni yuklang.",
    reply_markup: { inline_keyboard: rows },
  }
}

/* --------------------------------- Natijalar ----------------------------- */

async function resultsMenu(userId) {
  const app = appUrl()
  const attempts = userId ? await listAttempts(userId) : []

  let text
  if (!attempts.length) {
    text = "📊 <b>Natijalarim</b>\n\nSiz hali test yechmagansiz. «📚 Testlar»dan boshlang!"
  } else {
    const n = attempts.length
    const avg = Math.round(attempts.reduce((s, a) => s + (a.scorePercent || 0), 0) / n)
    const best = Math.max(...attempts.map((a) => a.scorePercent || 0))
    const totalSec = attempts.reduce((s, a) => s + (a.durationSeconds || 0), 0)
    const last = attempts[0]
    text =
      `📊 <b>Natijalarim</b>\n\n` +
      `• Yechilgan testlar: <b>${n} ta</b>\n` +
      `• O'rtacha natija: <b>${avg}%</b>\n` +
      `• Eng yaxshi: <b>${best}%</b>\n` +
      `• Sarflangan vaqt: <b>${formatDuration(totalSec)}</b>\n` +
      `• Oxirgi test: ${escapeHtml(last.topicTitle)} — <b>${last.scorePercent}%</b>`
  }

  const rows = []
  if (app) rows.push([{ text: "📈 Batafsil ko'rish", web_app: { url: `${app}/results` } }])
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'menu' }])
  return { text, reply_markup: { inline_keyboard: rows } }
}
