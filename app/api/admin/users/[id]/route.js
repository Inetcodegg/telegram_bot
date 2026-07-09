import { requireAdmin } from '@/lib/auth'
import { readUser, listAttempts } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * Admin bitta foydalanuvchining to'liq profilini va barcha urinishlarini oladi.
 * Urinish ichida `review` bor — ya'ni admin user ko'rgan aynan o'sha tahlilni ko'radi.
 */
export async function GET(request, { params }) {
  const [, err] = requireAdmin(request)
  if (err) return err

  const { id } = await params
  const user = await readUser(id)
  if (!user) return Response.json({ error: 'user_not_found' }, { status: 404 })

  const attempts = await listAttempts(id)
  return Response.json({ user, attempts })
}
