import { requireRole } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam } from '@/server/lib/request'
import { deleteEmailLog } from '@/server/services/email-logs'
import { NextRequest } from 'next/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id, error } = await parseIdParam(idStr)
  if (error) return error

  await deleteEmailLog(id)
  return jsonSuccess()
}
