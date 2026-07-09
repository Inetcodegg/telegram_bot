import fs from 'node:fs/promises'
import path from 'node:path'
import { slugify } from './text'

const ROOT = process.cwd()
const QUESTS_DIR = path.join(ROOT, 'quests')
const DATA_DIR = path.join(ROOT, 'data')
const RESULTS_DIR = path.join(DATA_DIR, 'results')
const USERS_DIR = path.join(DATA_DIR, 'users')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

const SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/i

/** Path traversal'ga qarshi: faqat toza slug'lar fayl nomiga aylanadi. */
export function safeSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return null
  return slug.toLowerCase()
}

export { slugify }

async function ensureDirs() {
  await fs.mkdir(RESULTS_DIR, { recursive: true })
  await fs.mkdir(USERS_DIR, { recursive: true })
  await fs.mkdir(QUESTS_DIR, { recursive: true })
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    throw e
  }
}

/** Atomik yozish: avval .tmp, keyin rename. Yarim yozilgan JSON qolmaydi. */
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

/* ---------------------------------- Mavzular (quests/*.json) --------------- */

export async function listTopicSlugs() {
  await ensureDirs()
  const files = await fs.readdir(QUESTS_DIR)
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter((s) => safeSlug(s))
    .sort()
}

export async function readTopic(slug) {
  const s = safeSlug(slug)
  if (!s) return null
  const raw = await readJson(path.join(QUESTS_DIR, `${s}.json`))
  if (!raw || !Array.isArray(raw.questions)) return null
  return { ...raw, slug: s }
}

export async function writeTopic(slug, data) {
  const s = safeSlug(slug)
  if (!s) throw new Error('invalid slug')
  await writeJson(path.join(QUESTS_DIR, `${s}.json`), data)
  return s
}

export async function deleteTopic(slug) {
  const s = safeSlug(slug)
  if (!s) throw new Error('invalid slug')
  await fs.rm(path.join(QUESTS_DIR, `${s}.json`), { force: true })
}

/* --------------------------------- Sozlamalar (data/settings.json) -------- */

const DEFAULT_SETTINGS = {
  // Savol turi bo'yicha global standart vaqt (soniya).
  globalTimers: { true_false: 20, multiple_choice: 30 },
  defaultTimer: 30,
  // Mavzuga xos sozlamalar: { [slug]: { title, description, timers, defaultTimer, shuffle } }
  topics: {},
}

export async function readSettings() {
  await ensureDirs()
  const saved = (await readJson(SETTINGS_FILE, {})) || {}
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    globalTimers: { ...DEFAULT_SETTINGS.globalTimers, ...(saved.globalTimers || {}) },
    topics: saved.topics || {},
  }
}

export async function writeSettings(settings) {
  await writeJson(SETTINGS_FILE, settings)
  return settings
}

/* ----------------------------------- Foydalanuvchilar (data/users) -------- */

/** Telegram profilini har kirganda yangilab boradi — admin shu ma'lumotni ko'radi. */
export async function upsertUser(user) {
  await ensureDirs()
  const file = path.join(USERS_DIR, `${user.id}.json`)
  const prev = (await readJson(file, {})) || {}
  const now = new Date().toISOString()
  const next = {
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
  await writeJson(file, next)
  return next
}

export async function readUser(userId) {
  const id = String(userId)
  if (!/^\d+$/.test(id)) return null
  return readJson(path.join(USERS_DIR, `${id}.json`))
}

export async function listUsers() {
  await ensureDirs()
  const files = await fs.readdir(USERS_DIR)
  const users = await Promise.all(
    files.filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(USERS_DIR, f)))
  )
  return users.filter(Boolean)
}

/* ------------------------------------- Natijalar (data/results) ----------- */

function resultsFile(userId) {
  return path.join(RESULTS_DIR, `${userId}.json`)
}

export async function listAttempts(userId) {
  const id = String(userId)
  if (!/^\d+$/.test(id)) return []
  const data = await readJson(resultsFile(id), { attempts: [] })
  return Array.isArray(data?.attempts) ? data.attempts : []
}

/**
 * Urinishni qo'shadi. Bir vaqtda kelgan yozuvlar bir-birini o'chirmasligi uchun
 * har bir user faylini ketma-ket (queue) yozamiz.
 */
const writeQueues = new Map()

export async function appendAttempt(userId, attempt) {
  const id = String(userId)
  if (!/^\d+$/.test(id)) throw new Error('invalid user id')

  const prev = writeQueues.get(id) || Promise.resolve()
  const task = prev.then(async () => {
    await ensureDirs()
    const file = resultsFile(id)
    const data = (await readJson(file, null)) || { userId: Number(id), attempts: [] }
    data.attempts = Array.isArray(data.attempts) ? data.attempts : []
    data.attempts.unshift(attempt)
    data.attempts = data.attempts.slice(0, 200) // oxirgi 200 ta urinish saqlanadi
    await writeJson(file, data)
    return attempt
  })

  writeQueues.set(
    id,
    task.catch(() => {})
  )
  return task
}

export async function listAllAttempts() {
  await ensureDirs()
  const files = await fs.readdir(RESULTS_DIR)
  const all = []
  for (const f of files.filter((x) => x.endsWith('.json'))) {
    const data = await readJson(path.join(RESULTS_DIR, f), null)
    for (const a of data?.attempts || []) all.push({ ...a, userId: data.userId })
  }
  return all
}
