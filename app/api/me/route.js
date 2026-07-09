import { requireUser, isAdmin } from '@/lib/auth'
import { upsertUser } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const [user, err] = requireUser(request)
  if (err) return err

  // Har kirganda profilni yangilab boramiz — admin panel shu ma'lumotni ko'rsatadi.
  const stored = user.is_dev ? user : await upsertUser(user)

  return Response.json({ user: stored, isAdmin: isAdmin(user) })
}
