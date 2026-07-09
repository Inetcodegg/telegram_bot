'use client'

import { INIT_DATA_HEADER } from './constants'

/** Brauzerda ochilganda (dev) soxta initData — server DEV_ALLOW_UNSAFE bilan qabul qiladi. */
function initData() {
  if (typeof window === 'undefined') return ''
  const real = window.Telegram?.WebApp?.initData
  if (real) return real
  return new URLSearchParams({
    user: JSON.stringify({ id: 0, first_name: 'Dev', username: 'dev' }),
  }).toString()
}

/** Osilib qolgan so'rov o'z-o'zidan uzilsin — aks holda UI abadiy "Yuklanmoqda…" bo'lib qoladi. */
const TIMEOUT_MS = 15000

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `HTTP ${status}`)
    this.status = status
    this.payload = payload
  }
}

export async function api(path, options = {}) {
  const { signal: external, ...rest } = options
  const controller = new AbortController()
  const onAbort = () => controller.abort()

  if (external?.aborted) controller.abort()
  else external?.addEventListener('abort', onAbort, { once: true })

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)

  try {
    const res = await fetch(`/api${path}`, {
      ...rest,
      headers: {
        'content-type': 'application/json',
        [INIT_DATA_HEADER]: initData(),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, payload)
    return payload
  } catch (err) {
    if (timedOut) throw new ApiError(0, { message: 'Server javob bermadi. Internetni tekshiring.' })
    if (err.name === 'AbortError') throw err // chaqiruvchi bekor qildi
    if (err instanceof ApiError) throw err
    throw new ApiError(0, { message: 'Tarmoqqa ulanib bo\'lmadi. Internetni tekshiring.' })
  } finally {
    clearTimeout(timer)
    external?.removeEventListener('abort', onAbort)
  }
}
