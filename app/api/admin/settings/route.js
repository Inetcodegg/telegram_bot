import { requireAdmin } from '@/lib/auth'
import { readSettings, writeSettings, safeSlug } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const [, err] = requireAdmin(request)
  if (err) return err
  return Response.json({ settings: await readSettings() })
}

function positiveIntOrNull(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= 3600 ? Math.round(n) : null
}

/** Vaqt sozlamalarini yangilaydi: global + har bir mavzu uchun savol turi bo'yicha. */
export async function PUT(request) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad_request' }, { status: 400 })

  const current = await readSettings()
  const next = { ...current }

  if (body.globalTimers) {
    next.globalTimers = { ...current.globalTimers }
    for (const type of ['true_false', 'multiple_choice']) {
      const v = positiveIntOrNull(body.globalTimers[type])
      if (v) next.globalTimers[type] = v
    }
  }

  const dt = positiveIntOrNull(body.defaultTimer)
  if (dt) next.defaultTimer = dt

  if (body.topics && typeof body.topics === 'object') {
    next.topics = { ...current.topics }
    for (const [rawSlug, patch] of Object.entries(body.topics)) {
      const slug = safeSlug(rawSlug)
      if (!slug || !patch || typeof patch !== 'object') continue

      const prev = next.topics[slug] || {}
      const timers = { ...(prev.timers || {}) }
      for (const type of ['true_false', 'multiple_choice']) {
        if (!(type in (patch.timers || {}))) continue
        const v = positiveIntOrNull(patch.timers[type])
        if (v) timers[type] = v
        else delete timers[type] // bo'sh qoldirilsa — global qiymatga qaytadi
      }

      next.topics[slug] = {
        ...prev,
        ...(patch.title != null ? { title: String(patch.title).slice(0, 120) } : {}),
        ...(patch.description != null ? { description: String(patch.description).slice(0, 500) } : {}),
        ...(patch.instructions != null ? { instructions: String(patch.instructions).slice(0, 2000) } : {}),
        ...('defaultTimer' in patch ? { defaultTimer: positiveIntOrNull(patch.defaultTimer) ?? undefined } : {}),
        timers,
      }
    }
  }

  await writeSettings(next)
  return Response.json({ settings: next })
}
