import { requireUser } from '@/lib/auth'
import { readTopic } from '@/lib/store'
import { findQuestion, isCorrect } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

/**
 * Bitta savolni tekshiradi va darhol fikr-mulohaza qaytaradi.
 * Javoblar clientda saqlanmagani uchun tekshiruv shu yerda bo'lishi shart.
 */
export async function POST(request) {
  const [, err] = requireUser(request)
  if (err) return err

  const body = await request.json().catch(() => null)
  if (!body?.topic || body.number == null) {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const topic = await readTopic(body.topic)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const question = findQuestion(topic, body.number)
  if (!question) return Response.json({ error: 'question_not_found' }, { status: 404 })

  const correct = isCorrect(question, body.answer)

  return Response.json({
    correct,
    correctAnswer: question.answer,
    explanation: question.explanation || null,
  })
}
