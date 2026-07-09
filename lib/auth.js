import crypto from 'node:crypto'
import { INIT_DATA_HEADER } from './constants'

/**
 * Telegram WebApp initData imzosini tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Imzo to'g'ri bo'lsa user obyektini, aks holda null qaytaradi.
 */
export function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(computed, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  // 24 soatdan eski initData qabul qilinmaydi (replay himoyasi).
  const authDate = Number(params.get('auth_date') || 0)
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) return null

  try {
    return JSON.parse(params.get('user'))
  } catch {
    return null
  }
}

export { INIT_DATA_HEADER }

/**
 * Request'dan autentifikatsiya qilingan foydalanuvchini oladi.
 * DEV_ALLOW_UNSAFE=1 bo'lganda imzosiz ochish mumkin (faqat lokal).
 */
export function getUser(request) {
  const initData = request.headers.get(INIT_DATA_HEADER) || ''
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (token) {
    const user = validateInitData(initData, token)
    if (user?.id) return user
  }

  if (process.env.DEV_ALLOW_UNSAFE === '1') {
    try {
      const user = JSON.parse(new URLSearchParams(initData).get('user'))
      if (user?.id) return user
    } catch {}
    return { id: 0, first_name: 'Dev', username: 'dev', is_dev: true }
  }

  return null
}

export function isAdmin(user) {
  if (!user) return false
  const ids = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0 && process.env.DEV_ALLOW_UNSAFE === '1') return true
  return ids.includes(String(user.id))
}

/** API route'lar uchun qisqa yordamchi: [user, errorResponse] */
export function requireUser(request) {
  const user = getUser(request)
  if (!user) {
    return [null, Response.json({ error: 'unauthorized' }, { status: 401 })]
  }
  return [user, null]
}

export function requireAdmin(request) {
  const [user, err] = requireUser(request)
  if (err) return [null, err]
  if (!isAdmin(user)) {
    return [null, Response.json({ error: 'forbidden' }, { status: 403 })]
  }
  return [user, null]
}
