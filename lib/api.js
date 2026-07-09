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

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `HTTP ${status}`)
    this.status = status
    this.payload = payload
  }
}

export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      [INIT_DATA_HEADER]: initData(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, payload)
  return payload
}
