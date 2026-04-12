import enAdmin from '@/messages/en/admin.json'
import enCommon from '@/messages/en/common.json'
import enFrontend from '@/messages/en/frontend.json'
import zhAdmin from '@/messages/zh/admin.json'
import zhCommon from '@/messages/zh/common.json'
import zhFrontend from '@/messages/zh/frontend.json'
import { describe, expect, it } from 'vitest'

function collectKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    return collectKeys(child, nextPrefix)
  })
}

describe('messages parity', () => {
  it.each([
    ['common', zhCommon, enCommon],
    ['frontend', zhFrontend, enFrontend],
    ['admin', zhAdmin, enAdmin],
  ])('%s 的中英文 key 结构保持一致', (_name, zh, en) => {
    expect(collectKeys(en).sort()).toEqual(collectKeys(zh).sort())
  })
})
