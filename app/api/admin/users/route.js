import { requireAdmin } from '@/lib/auth'
import { listUsers, listAttempts } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const users = await listUsers()

  const rows = await Promise.all(
    users.map(async (u) => {
      const attempts = await listAttempts(u.id)
      const avg = attempts.length
        ? Math.round(attempts.reduce((s, a) => s + (a.scorePercent || 0), 0) / attempts.length)
        : null
      return {
        ...u,
        attemptCount: attempts.length,
        averageScore: avg,
        lastAttemptAt: attempts[0]?.finishedAt || null,
      }
    })
  )

  rows.sort((a, b) => new Date(b.lastAttemptAt || b.last_seen_at || 0) - new Date(a.lastAttemptAt || a.last_seen_at || 0))
  return Response.json({ users: rows })
}
