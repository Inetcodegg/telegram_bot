import { requireAdmin } from '@/lib/auth'
import { readTopic, writeTopic, deleteTopic, readSettings, writeSettings } from '@/lib/store'
import { validateQuestSchema } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

/** To'liq mavzu (javoblari bilan) — faqat admin uchun. */
export async function GET(request, { params }) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const { slug } = await params
  const topic = await readTopic(slug)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const settings = await readSettings()
  return Response.json({ topic, meta: settings.topics?.[slug] || {}, settings })
}

export async function PUT(request, { params }) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const { slug } = await params
  const existing = await readTopic(slug)
  if (!existing) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body?.questions) return Response.json({ error: 'bad_request' }, { status: 400 })

  const errors = validateQuestSchema(body)
  if (errors.length) return Response.json({ error: 'invalid_schema', errors }, { status: 400 })

  await writeTopic(slug, {
    title: body.title || existing.title,
    description: body.description ?? existing.description ?? null,
    total_questions: body.questions.length,
    questions: body.questions,
  })
  return Response.json({ ok: true, questionCount: body.questions.length })
}

export async function DELETE(request, { params }) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const { slug } = await params
  const topic = await readTopic(slug)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  await deleteTopic(slug)

  const settings = await readSettings()
  delete settings.topics[slug]
  await writeSettings(settings)

  return Response.json({ ok: true })
}
