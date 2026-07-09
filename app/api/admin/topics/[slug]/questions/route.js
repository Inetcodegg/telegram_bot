import { requireAdmin } from '@/lib/auth'
import { readTopic, writeTopic } from '@/lib/store'
import { validateQuestSchema } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

/** Bitta savol qo'shadi (admin formasi orqali). */
export async function POST(request, { params }) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const { slug } = await params
  const topic = await readTopic(slug)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body?.question) return Response.json({ error: 'bad_request' }, { status: 400 })

  const nextNumber = Math.max(0, ...topic.questions.map((q) => Number(q.number) || 0)) + 1
  const question = { ...body.question, number: nextNumber }

  const errors = validateQuestSchema({ questions: [question] })
  if (errors.length) return Response.json({ error: 'invalid_schema', errors }, { status: 400 })

  const questions = [...topic.questions, question]
  await writeTopic(slug, {
    title: topic.title,
    description: topic.description ?? null,
    total_questions: questions.length,
    questions,
  })
  return Response.json({ ok: true, number: nextNumber, questionCount: questions.length })
}

/** Savolni o'chiradi: /api/admin/topics/<slug>/questions?number=12 */
export async function DELETE(request, { params }) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const { slug } = await params
  const topic = await readTopic(slug)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const number = Number(new URL(request.url).searchParams.get('number'))
  const questions = topic.questions.filter((q) => Number(q.number) !== number)
  if (questions.length === topic.questions.length) {
    return Response.json({ error: 'question_not_found' }, { status: 404 })
  }

  await writeTopic(slug, {
    title: topic.title,
    description: topic.description ?? null,
    total_questions: questions.length,
    questions,
  })
  return Response.json({ ok: true, questionCount: questions.length })
}
