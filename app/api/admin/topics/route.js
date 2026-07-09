import { requireAdmin } from '@/lib/auth'
import { listTopicSlugs, readTopic, writeTopic, readSettings, writeSettings, safeSlug, slugify } from '@/lib/store'
import { validateQuestSchema } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const settings = await readSettings()
  const slugs = await listTopicSlugs()
  const topics = []
  for (const slug of slugs) {
    const t = await readTopic(slug)
    if (!t) continue
    topics.push({
      slug,
      title: settings.topics?.[slug]?.title || t.title || slug,
      questionCount: t.questions.length,
      types: t.questions.reduce((acc, q) => ({ ...acc, [q.type]: (acc[q.type] || 0) + 1 }), {}),
    })
  }
  return Response.json({ topics, settings })
}

/**
 * Yangi mavzu yaratadi yoki mavjudini yangilaydi (JSON yuklash).
 * Fayl nomi = mavzu slug'i, ya'ni `quests/<slug>.json`.
 * mode: 'replace' (standart) yoki 'merge' — merge'da savollar mavjudlariga qo'shiladi.
 */
export async function POST(request) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad_request' }, { status: 400 })

  const slug = safeSlug(body.slug || slugify(body.title || ''))
  if (!slug) {
    return Response.json({ error: 'invalid_slug', message: "Mavzu nomi noto'g'ri" }, { status: 400 })
  }

  const incoming = body.data && typeof body.data === 'object' ? body.data : { questions: body.questions }
  const errors = validateQuestSchema(incoming)
  if (errors.length) return Response.json({ error: 'invalid_schema', errors }, { status: 400 })

  const existing = await readTopic(slug)
  const merge = body.mode === 'merge' && existing

  let questions
  if (merge) {
    // Raqamlar to'qnashmasligi uchun yangi savollarni qayta raqamlaymiz.
    let next = Math.max(0, ...existing.questions.map((q) => Number(q.number) || 0)) + 1
    questions = [...existing.questions, ...incoming.questions.map((q) => ({ ...q, number: next++ }))]
  } else {
    questions = incoming.questions
  }

  const payload = {
    title: body.title || incoming.title || existing?.title || slug,
    description: body.description ?? incoming.description ?? existing?.description ?? null,
    total_questions: questions.length,
    questions,
  }
  await writeTopic(slug, payload)

  // Sozlamalarda ham sarlavhani ro'yxatdan o'tkazamiz.
  const settings = await readSettings()
  settings.topics[slug] = { ...(settings.topics[slug] || {}), title: payload.title }
  if (payload.description) settings.topics[slug].description = payload.description
  await writeSettings(settings)

  return Response.json({ slug, questionCount: questions.length, merged: Boolean(merge) })
}
