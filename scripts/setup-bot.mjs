/**
 * Botning "menu button"ini Mini App'ga ulaydi.
 *
 * Eng oson (token .env.local dan o'qiladi — faqat URL yozasiz):
 *   node --env-file=.env.local scripts/setup-bot.mjs https://loyiha.vercel.app
 *
 * Yoki tokenni qo'lda berish:
 *   node scripts/setup-bot.mjs <BOT_TOKEN> https://loyiha.vercel.app
 *
 * URL albatta HTTPS bo'lishi shart — Telegram HTTP'ni qabul qilmaydi.
 */

import crypto from 'node:crypto'

// Manba: lib/telegram.js → webhookSecret(). Ikkalasi bir xil bo'lishi shart.
const webhookSecret = (t) => crypto.createHash('sha256').update(`webhook:${t}`).digest('hex')

const args = process.argv.slice(2)

// Argumentlardan URL'ni (https bilan boshlanadigan) va tokenni ajratamiz.
const url = args.find((a) => a.startsWith('https://'))
const tokenArg = args.find((a) => !a.startsWith('https://'))
const token = tokenArg || process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.error(
    'Token topilmadi. Yo argument sifatida bering, yoki .env.local bilan ishga tushiring:\n' +
      '  node --env-file=.env.local scripts/setup-bot.mjs https://loyiha.vercel.app'
  )
  process.exit(1)
}

if (!url) {
  console.error('Foydalanish: node scripts/setup-bot.mjs <HTTPS_URL>  (masalan https://loyiha.vercel.app)')
  process.exit(1)
}

const API_BASE = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'

async function call(method, body) {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`${method}: ${data.description}`)
  return data.result
}

const me = await call('getMe', {})
console.log(`Bot: @${me.username}`)

await call('setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'Testlar', web_app: { url } },
})
console.log(`✓ Menu button "${url}" ga ulandi`)

await call('setMyCommands', {
  commands: [{ command: 'start', description: 'Botni ishga tushirish' }],
})
console.log('✓ /start buyrug\'i qo\'shildi')

// Webhook: /start va tugma bosishlar shu manzilga keladi.
await call('setWebhook', {
  url: `${url}/api/bot`,
  secret_token: webhookSecret(token),
  allowed_updates: ['message', 'callback_query'],
})
console.log(`✓ Webhook ulandi: ${url}/api/bot`)

console.log(`\nTayyor! @${me.username} da /start bosing — inline tugmalar chiqadi.`)
console.log("Eslatma: Vercel'da APP_URL kerak emas (avtomatik), lekin TELEGRAM_BOT_TOKEN o'rnatilgan bo'lsin.")
