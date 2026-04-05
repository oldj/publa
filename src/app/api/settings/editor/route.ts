import { requireCurrentUser } from '@/server/auth'
import {
  EDITOR_SETTINGS_KEYS,
  getAllSettings,
  pickSettings,
} from '@/server/services/settings'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const data = pickSettings(await getAllSettings(), EDITOR_SETTINGS_KEYS)
  return NextResponse.json({ success: true, data })
}
