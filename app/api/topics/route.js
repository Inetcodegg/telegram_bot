import { requireUser } from '@/lib/auth'
import { listTopicSlugs, readTopic, readSettings } from '@/lib/store'
import { resolveTimeLimit } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

/** Mavzu sarlavhasi: sozlamalarda bo'lsa o'sha, bo'lmasa fayl nomidan yasaladi. */
function titleFor(slug, topic, settings) {
  return (
    settings.topics?.[slug]?.title ||
    topic.title ||
    slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export async function GET(request) {
  const [, err] = requireUser(request)
  if (err) return err

  const settings = await readSettings()
  const slugs = await listTopicSlugs()

  const topics = []
  for (const slug of slugs) {
    const topic = await readTopic(slug)
    if (!topic) continue

    const totalSeconds = topic.questions.reduce(
      (sum, q) => sum + resolveTimeLimit(q, settings, slug),
      0
    )
    const difficulties = topic.questions.reduce((acc, q) => {
      const d = q.difficulty || 'medium'
      acc[d] = (acc[d] || 0) + 1
      return acc
    }, {})

    topics.push({
      slug,
      title: titleFor(slug, topic, settings),
      description: settings.topics?.[slug]?.description || topic.description || null,
      questionCount: topic.questions.length,
      totalSeconds,
      difficulties,
    })
  }

  return Response.json({ topics })
}
