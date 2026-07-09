import crypto from 'node:crypto'

// Test uchun almashtiriladigan tayanch (mock Telegram API). Prod'da haqiqiy API.
const API_BASE = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'

export function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || ''
}

/**
 * Webhook uchun maxfiy token — bot tokenidan deterministik hosil qilinadi.
 * setup-bot.mjs va webhook route bir xil qiymatni oladi, alohida env kerak emas.
 * Telegram bu qiymatni har so'rovda `X-Telegram-Bot-Api-Secret-Token` da qaytaradi.
 */
export function webhookSecret(token = botToken()) {
  return crypto.createHash('sha256').update(`webhook:${token}`).digest('hex')
}

/**
 * Mini App'ning HTTPS manzili — web_app tugmalarini yasash uchun kerak.
 * Vercel `VERCEL_PROJECT_PRODUCTION_URL` ni avtomatik beradi, shuning uchun
 * odatda qo'lda sozlash shart emas. Lokalda APP_URL orqali beriladi.
 */
export function appUrl() {
  const explicit = process.env.APP_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`
  return null
}

export async function tgCall(method, body, token = botToken()) {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(`${method}: ${data?.description || `HTTP ${res.status}`}`)
  return data.result
}

/** HTML parse_mode uchun foydalanuvchi matnini xavfsizlantiradi. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Soniyani o'zbekcha "1 soat 5 daq" ko'rinishiga keltiradi. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (h) parts.push(`${h} soat`)
  if (m) parts.push(`${m} daq`)
  if (!h && sec) parts.push(`${sec} s`)
  return parts.join(' ') || '0 s'
}
