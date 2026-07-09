import fs from 'node:fs/promises'
import path from 'node:path'
import { slugify } from './text'

/*
 * Ikki xil saqlash backend'i bitta interfeys ostida:
 *
 *  - LOKAL (dev):  KV env o'zgaruvchilari bo'lmasa — JSON fayllar (quests/, data/).
 *  - VERCEL (prod): Upstash Redis (Vercel Marketplace → "Upstash for Redis").
 *
 * Vercel'ning fayl tizimi vaqtinchalik va faqat o'qish uchun, shuning uchun u
 * yerda natijalar/foydalanuvchilar Redis'ga yoziladi. Kodning qolgan qismi
 * (API route'lar) o'zgarmaydi — hammasi shu fayldagi funksiyalar orqali o'tadi.
 */

const ROOT = process.cwd()
const QUESTS_DIR = path.join(ROOT, 'quests')
const DATA_DIR = path.join(ROOT, 'data')
const RESULTS_DIR = path.join(DATA_DIR, 'results')
const USERS_DIR = path.join(DATA_DIR, 'users')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

const SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/i
const MAX_ATTEMPTS = 200 // har bir foydalanuvchi uchun saqlanadigan urinishlar soni

/** Path traversal'ga qarshi: faqat toza slug'lar kalit/fayl nomiga aylanadi. */
export function safeSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return null
  return slug.toLowerCase()
}

export { slugify }

const DEFAULT_SETTINGS = {
  // Savol turi bo'yicha global standart vaqt (soniya).
  globalTimers: { true_false: 20, multiple_choice: 30 },
  defaultTimer: 30,
  // Mavzuga xos sozlamalar: { [slug]: { title, description, timers, defaultTimer, shuffle } }
  topics: {},
}

/** Saqlangan sozlamalarni standart qiymatlar bilan birlashtiradi. */
function mergeSettings(saved) {
  const s = saved || {}
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    globalTimers: { ...DEFAULT_SETTINGS.globalTimers, ...(s.globalTimers || {}) },
    topics: s.topics || {},
  }
}

/** Telegram profilini bir shaklga keltiradi (yangi kirishda yangilab boradi). */
function normalizeUser(user, prev = {}) {
  const now = new Date().toISOString()
  return {
    ...prev,
    id: user.id,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    username: user.username ?? null,
    language_code: user.language_code ?? null,
    is_premium: user.is_premium ?? false,
    photo_url: user.photo_url ?? prev.photo_url ?? null,
    first_seen_at: prev.first_seen_at || now,
    last_seen_at: now,
  }
}

/* ═══════════════════════════════ REDIS BACKEND (Vercel) ═══════════════════ */

// Upstash Vercel integratsiyasi bu env'larni beradi (KV_* yoki UPSTASH_*).
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const USE_KV = Boolean(KV_URL && KV_TOKEN)

// Redis kalitlari
const K_SETTINGS = 'settings'
const K_TOPICS = 'topics' // hash: slug -> JSON
const K_USERS = 'users' // hash: id -> JSON
const K_SEEDED = 'seeded:topics'
const kResults = (id) => `results:${id}` // list: har bir element JSON string

let _redis = null
function redis() {
  if (_redis) return _redis
  // require: KV ishlatilmasa paket umuman yuklanmaydi.
  const { Redis } = require('@upstash/redis')
  // automaticDeserialization=false — qiymatlar doim string, JSON'ni o'zimiz boshqaramiz.
  _redis = new Redis({ url: KV_URL, token: KV_TOKEN, automaticDeserialization: false })
  return _redis
}

/**
 * Birinchi ishga tushirishda repo'dagi quests/*.json mavzularini Redis'ga
 * ko'chiradi (masalan the-noun.json). Faqat bir marta bajariladi.
 */
let _seedPromise = null
function seedTopicsOnce() {
  if (_seedPromise) return _seedPromise
  _seedPromise = (async () => {
    const r = redis()
    // SET NX — parallel so'rovlar bir vaqtda ikki marta seed qilib yubormaydi.
    const won = await r.set(K_SEEDED, '1', { nx: true })
    if (!won) return
    try {
      const files = await fs.readdir(QUESTS_DIR)
      for (const f of files) {
        if (!f.endsWith('.json')) continue
        const slug = safeSlug(f.slice(0, -5))
        if (!slug) continue
        if (await r.hget(K_TOPICS, slug)) continue
        const raw = await fs.readFile(path.join(QUESTS_DIR, f), 'utf8')
        await r.hset(K_TOPICS, { [slug]: raw })
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
  })()
  return _seedPromise
}

const kv = {
  async listTopicSlugs() {
    await seedTopicsOnce()
    const keys = await redis().hkeys(K_TOPICS)
    return (keys || []).filter((s) => safeSlug(s)).sort()
  },
  async readTopic(slug) {
    const s = safeSlug(slug)
    if (!s) return null
    await seedTopicsOnce()
    const raw = await redis().hget(K_TOPICS, s)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.questions)) return null
    return { ...data, slug: s }
  },
  async writeTopic(slug, data) {
    const s = safeSlug(slug)
    if (!s) throw new Error('invalid slug')
    await redis().hset(K_TOPICS, { [s]: JSON.stringify(data) })
    return s
  },
  async deleteTopic(slug) {
    const s = safeSlug(slug)
    if (!s) throw new Error('invalid slug')
    await redis().hdel(K_TOPICS, s)
  },

  async readSettings() {
    const raw = await redis().get(K_SETTINGS)
    return mergeSettings(raw ? JSON.parse(raw) : {})
  },
  async writeSettings(settings) {
    await redis().set(K_SETTINGS, JSON.stringify(settings))
    return settings
  },

  async upsertUser(user) {
    const r = redis()
    const raw = await r.hget(K_USERS, String(user.id))
    const next = normalizeUser(user, raw ? JSON.parse(raw) : {})
    await r.hset(K_USERS, { [String(user.id)]: JSON.stringify(next) })
    return next
  },
  async readUser(userId) {
    const id = String(userId)
    if (!/^\d+$/.test(id)) return null
    const raw = await redis().hget(K_USERS, id)
    return raw ? JSON.parse(raw) : null
  },
  async listUsers() {
    const vals = await redis().hvals(K_USERS)
    return (vals || []).map((v) => JSON.parse(v)).filter(Boolean)
  },

  async listAttempts(userId) {
    const id = String(userId)
    if (!/^\d+$/.test(id)) return []
    const items = await redis().lrange(kResults(id), 0, -1)
    return (items || []).map((v) => JSON.parse(v))
  },
  async appendAttempt(userId, attempt) {
    const id = String(userId)
    if (!/^\d+$/.test(id)) throw new Error('invalid user id')
    const r = redis()
    // LPUSH + LTRIM atomik — parallel yozuvlar bir-birini o'chirmaydi.
    await r.lpush(kResults(id), JSON.stringify(attempt))
    await r.ltrim(kResults(id), 0, MAX_ATTEMPTS - 1)
    return attempt
  },
  async listAllAttempts() {
    const r = redis()
    const ids = (await r.hkeys(K_USERS)) || []
    const all = []
    for (const id of ids) {
      const items = await r.lrange(kResults(id), 0, -1)
      for (const v of items || []) all.push({ ...JSON.parse(v), userId: Number(id) })
    }
    return all
  },
}

/* ═══════════════════════════════ FILE BACKEND (lokal) ═════════════════════ */

async function ensureDirs() {
  await fs.mkdir(RESULTS_DIR, { recursive: true })
  await fs.mkdir(USERS_DIR, { recursive: true })
  await fs.mkdir(QUESTS_DIR, { recursive: true })
}

async function readJson(f, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(f, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    throw e
  }
}

/** Atomik yozish: avval .tmp, keyin rename. Yarim yozilgan JSON qolmaydi. */
async function writeJson(f, value) {
  await fs.mkdir(path.dirname(f), { recursive: true })
  const tmp = `${f}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tmp, f)
}

// Bir vaqtda kelgan yozuvlar bir-birini o'chirmasligi uchun user faylini navbatga qo'yamiz.
const writeQueues = new Map()

const file = {
  async listTopicSlugs() {
    await ensureDirs()
    const files = await fs.readdir(QUESTS_DIR)
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter((s) => safeSlug(s))
      .sort()
  },
  async readTopic(slug) {
    const s = safeSlug(slug)
    if (!s) return null
    const raw = await readJson(path.join(QUESTS_DIR, `${s}.json`))
    if (!raw || !Array.isArray(raw.questions)) return null
    return { ...raw, slug: s }
  },
  async writeTopic(slug, data) {
    const s = safeSlug(slug)
    if (!s) throw new Error('invalid slug')
    await writeJson(path.join(QUESTS_DIR, `${s}.json`), data)
    return s
  },
  async deleteTopic(slug) {
    const s = safeSlug(slug)
    if (!s) throw new Error('invalid slug')
    await fs.rm(path.join(QUESTS_DIR, `${s}.json`), { force: true })
  },

  async readSettings() {
    await ensureDirs()
    return mergeSettings((await readJson(SETTINGS_FILE, {})) || {})
  },
  async writeSettings(settings) {
    await writeJson(SETTINGS_FILE, settings)
    return settings
  },

  async upsertUser(user) {
    await ensureDirs()
    const f = path.join(USERS_DIR, `${user.id}.json`)
    const next = normalizeUser(user, (await readJson(f, {})) || {})
    await writeJson(f, next)
    return next
  },
  async readUser(userId) {
    const id = String(userId)
    if (!/^\d+$/.test(id)) return null
    return readJson(path.join(USERS_DIR, `${id}.json`))
  },
  async listUsers() {
    await ensureDirs()
    const files = await fs.readdir(USERS_DIR)
    const users = await Promise.all(
      files.filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(USERS_DIR, f)))
    )
    return users.filter(Boolean)
  },

  async listAttempts(userId) {
    const id = String(userId)
    if (!/^\d+$/.test(id)) return []
    const data = await readJson(path.join(RESULTS_DIR, `${id}.json`), { attempts: [] })
    return Array.isArray(data?.attempts) ? data.attempts : []
  },
  async appendAttempt(userId, attempt) {
    const id = String(userId)
    if (!/^\d+$/.test(id)) throw new Error('invalid user id')

    const prev = writeQueues.get(id) || Promise.resolve()
    const task = prev.then(async () => {
      await ensureDirs()
      const f = path.join(RESULTS_DIR, `${id}.json`)
      const data = (await readJson(f, null)) || { userId: Number(id), attempts: [] }
      data.attempts = Array.isArray(data.attempts) ? data.attempts : []
      data.attempts.unshift(attempt)
      data.attempts = data.attempts.slice(0, MAX_ATTEMPTS)
      await writeJson(f, data)
      return attempt
    })
    writeQueues.set(id, task.catch(() => {}))
    return task
  },
  async listAllAttempts() {
    await ensureDirs()
    const files = await fs.readdir(RESULTS_DIR)
    const all = []
    for (const f of files.filter((x) => x.endsWith('.json'))) {
      const data = await readJson(path.join(RESULTS_DIR, f), null)
      for (const a of data?.attempts || []) all.push({ ...a, userId: data.userId })
    }
    return all
  },
}

/* ═══════════════════════════════ TANLANGAN BACKEND ════════════════════════ */

const backend = USE_KV ? kv : file

export const listTopicSlugs = (...a) => backend.listTopicSlugs(...a)
export const readTopic = (...a) => backend.readTopic(...a)
export const writeTopic = (...a) => backend.writeTopic(...a)
export const deleteTopic = (...a) => backend.deleteTopic(...a)
export const readSettings = (...a) => backend.readSettings(...a)
export const writeSettings = (...a) => backend.writeSettings(...a)
export const upsertUser = (...a) => backend.upsertUser(...a)
export const readUser = (...a) => backend.readUser(...a)
export const listUsers = (...a) => backend.listUsers(...a)
export const listAttempts = (...a) => backend.listAttempts(...a)
export const appendAttempt = (...a) => backend.appendAttempt(...a)
export const listAllAttempts = (...a) => backend.listAllAttempts(...a)
