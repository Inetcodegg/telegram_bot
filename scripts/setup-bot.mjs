/**
 * Botning "menu button"ini Mini App'ga ulaydi.
 *
 *   node scripts/setup-bot.mjs <BOT_TOKEN> <HTTPS_URL>
 *
 * Masalan:
 *   node scripts/setup-bot.mjs 123:ABC https://quiz.example.com
 *
 * URL albatta HTTPS bo'lishi shart — Telegram HTTP'ni qabul qilmaydi.
 * Lokal sinash uchun `npx localtunnel --port 3000` yoki ngrok ishlating.
 */

const [token, url] = process.argv.slice(2)

if (!token || !url) {
  console.error('Foydalanish: node scripts/setup-bot.mjs <BOT_TOKEN> <HTTPS_URL>')
  process.exit(1)
}

if (!url.startsWith('https://')) {
  console.error("Xato: URL 'https://' bilan boshlanishi kerak.")
  process.exit(1)
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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
  commands: [{ command: 'start', description: 'Testlarni ochish' }],
})
console.log('✓ /start buyrug\'i qo\'shildi')

console.log(`\nEndi @${me.username} ni oching va pastdagi "Testlar" tugmasini bosing.`)
