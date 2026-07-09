import { requireUser } from '@/lib/auth'
import { readTopic, readSettings } from '@/lib/store'
import { resolveTimeLimit, toPublicQuestion } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const [, err] = requireUser(request)
  if (err) return err

  const { slug } = await params
  const topic = await readTopic(slug)
  if (!topic) return Response.json({ error: 'topic_not_found' }, { status: 404 })

  const settings = await readSettings()
  const meta = settings.topics?.[slug] || {}

  // Diqqat: `answer` va `explanation` bu yerda yuborilmaydi.
  const questions = topic.questions.map((q) =>
    toPublicQuestion(q, resolveTimeLimit(q, settings, slug))
  )

  return Response.json({
    slug,
    title: meta.title || topic.title || slug.replace(/[-_]/g, ' '),
    description: meta.description || topic.description || null,
    instructions: meta.instructions || topic.instructions || null,
    questionCount: questions.length,
    totalSeconds: questions.reduce((s, q) => s + q.timeLimit, 0),
    questions,
  })
}
