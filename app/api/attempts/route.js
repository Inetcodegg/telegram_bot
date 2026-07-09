import { requireUser } from '@/lib/auth'
import { readTopic, readSettings, appendAttempt, listAttempts, upsertUser } from '@/lib/store'
import { gradeAttempt } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

/** Foydalanuvchining o'z tarixi. */
export async function GET(request) {
  const [user, err] = requireUser(request)
  if (err) return err
  const attempts = await listAttempts(user.id)
  return Response.json({ attempts })
}

/** Testni yakunlash: baholash serverda bo'ladi, client faqat javoblarni yuboradi. */
export async function POST(request) {
  const [user, err] = requireUser(request)
  if (err) return err

  const body = await request.json().catch(() => null)
  if (!body?.topic || !Array.isArray(body.answers)) {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const topic = await readTopic(body.topic)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const settings = await readSettings()
  const result = gradeAttempt(topic, settings, body.answers)

  const startedAt = Number(body.startedAt) || Date.now()
  const attempt = {
    id: `${user.id}-${Date.now()}`,
    topicSlug: topic.slug,
    topicTitle: settings.topics?.[topic.slug]?.title || topic.title || topic.slug,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
    ...result,
  }

  if (!user.is_dev) {
    await upsertUser(user)
    await appendAttempt(user.id, attempt)
  }

  return Response.json({ attempt })
}
