import { requireCurrentUser } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  return jsonSuccess(guard.user)
}
