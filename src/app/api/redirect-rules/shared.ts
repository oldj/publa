import { RedirectRuleValidationError } from '@/server/services/redirect-rules'
import { NextResponse } from 'next/server'

function toValidationMessage(error: RedirectRuleValidationError): string {
  switch (error.code) {
    case 'INVALID_PATH_REGEX':
      return '匹配路径正则表达式无效'
    case 'INVALID_REDIRECT_TO':
      return '跳转目标必须是站内路径或 http/https URL'
    case 'INVALID_REDIRECT_TYPE':
      return '跳转类型无效'
    case 'INVALID_REORDER_IDS':
      return '排序数据无效'
    default:
      return '请求数据无效'
  }
}

export function validationErrorResponse(error: RedirectRuleValidationError) {
  return NextResponse.json(
    {
      success: false,
      code: 'VALIDATION_ERROR',
      message: toValidationMessage(error),
    },
    { status: 400 },
  )
}
