import { beforeEach, describe, expect, it } from 'vitest'
import { getClientTranslator, setClientI18n } from './client-runtime'

const messages = {
  common: {
    title: 'Test',
    hello: 'Hello {name}',
  },
  admin: {
    label: 'Admin Panel',
  },
}

describe('client-runtime', () => {
  beforeEach(() => {
    setClientI18n('en', messages)
  })

  it('messages 未设置时返回 key 路径', () => {
    setClientI18n('en', null as any)
    const t = getClientTranslator('common')
    expect(t('title')).toBe('common.title')
  })

  it('messages 未设置且无 namespace 时只返回 key', () => {
    setClientI18n('en', null as any)
    const t = getClientTranslator()
    expect(t('title')).toBe('title')
  })

  it('正常翻译', () => {
    const t = getClientTranslator('common')
    expect(t('title')).toBe('Test')
  })

  it('支持占位符', () => {
    const t = getClientTranslator('common')
    expect(t('hello', { name: 'World' })).toBe('Hello World')
  })

  it('不同 namespace 互不影响', () => {
    const tCommon = getClientTranslator('common')
    const tAdmin = getClientTranslator('admin')
    expect(tCommon('title')).toBe('Test')
    expect(tAdmin('label')).toBe('Admin Panel')
  })

  it('setClientI18n 后缓存被清除', () => {
    const t = getClientTranslator('common')
    expect(t('title')).toBe('Test')

    setClientI18n('zh', { common: { title: '测试' } })
    // 同一个 translator 函数引用应该读到新值
    expect(t('title')).toBe('测试')
  })
})
