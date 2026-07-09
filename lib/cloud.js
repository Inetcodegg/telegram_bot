'use client'

/**
 * Telegram CloudStorage — foydalanuvchi qurilmasidagi keshi.
 * Server JSON fayllari asosiy manba; bu offline/tez ko'rsatish uchun.
 * CloudStorage har bir user uchun izolyatsiya qilingan (admin uni o'qiy olmaydi).
 */
function cs() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp?.CloudStorage : null
}

const KEY = 'attempts_summary'
const MAX = 20 // CloudStorage qiymati 4096 baytdan oshmasligi kerak

export function cloudSet(key, value) {
  return new Promise((resolve) => {
    const store = cs()
    if (!store) return resolve(false)
    store.setItem(key, value, (err, ok) => resolve(!err && ok))
  })
}

export function cloudGet(key) {
  return new Promise((resolve) => {
    const store = cs()
    if (!store) return resolve(null)
    store.getItem(key, (err, value) => resolve(err ? null : value || null))
  })
}

/** Urinishlarning yengil xulosasini keshlaydi (review'siz — u juda katta). */
export async function cacheAttempts(attempts) {
  const slim = attempts.slice(0, MAX).map((a) => ({
    id: a.id,
    t: a.topicTitle,
    s: a.scorePercent,
    c: a.correctCount,
    n: a.total,
    at: a.finishedAt,
  }))
  const json = JSON.stringify(slim)
  if (json.length > 4000) return false
  return cloudSet(KEY, json)
}

export async function readCachedAttempts() {
  const raw = await cloudGet(KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).map((a) => ({
      id: a.id,
      topicTitle: a.t,
      scorePercent: a.s,
      correctCount: a.c,
      total: a.n,
      finishedAt: a.at,
      cached: true,
    }))
  } catch {
    return []
  }
}
