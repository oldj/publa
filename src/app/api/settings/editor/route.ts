import { requireCurrentUser } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { EDITOR_SETTINGS_KEYS, getAllSettings, pickSettings } from '@/server/services/settings'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const data = pickSettings(await getAllSettings(), EDITOR_SETTINGS_KEYS)
  return jsonSuccess(data)
}
