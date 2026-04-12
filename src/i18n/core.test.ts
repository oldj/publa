import { describe, expect, it } from 'vitest'
import { createTranslator, formatMessage, getMessage } from './core'

describe('getMessage', () => {
  const messages = {
    common: {
      errors: { notFound: 'Not found' },
    },
    flat: 'Hello',
  }

  it('按路径取到叶子节点', () => {
    expect(getMessage(messages, 'common.errors.notFound')).toBe('Not found')
    expect(getMessage(messages, 'flat')).toBe('Hello')
  })

  it('路径不存在时返回 undefined', () => {
    expect(getMessage(messages, 'common.errors.missing')).toBeUndefined()
    expect(getMessage(messages, 'nonexistent.path')).toBeUndefined()
  })

  it('路径指向非叶子节点时返回对象', () => {
    expect(getMessage(messages, 'common.errors')).toEqual({ notFound: 'Not found' })
  })
})

describe('formatMessage', () => {
  it('无占位符时直接返回原文', () => {
    expect(formatMessage('en', 'Hello')).toBe('Hello')
    expect(formatMessage('en', 'Hello', {})).toBe('Hello')
  })

  it('替换占位符', () => {
    expect(formatMessage('en', 'Hello {name}', { name: 'World' })).toBe('Hello World')
  })

  it('支持多个占位符', () => {
    expect(formatMessage('en', '{a} and {b}', { a: 'X', b: 'Y' })).toBe('X and Y')
  })
})

describe('createTranslator', () => {
  const messages = {
    admin: {
      title: 'Dashboard',
      greeting: 'Hello {name}',
    },
    simple: 'Simple text',
  }

  it('按 namespace 取翻译', () => {
    const t = createTranslator(messages, 'en', 'admin')
    expect(t('title')).toBe('Dashboard')
    expect(t('greeting', { name: 'Alice' })).toBe('Hello Alice')
  })

  it('无 namespace 时用完整路径', () => {
    const t = createTranslator(messages, 'en')
    expect(t('simple')).toBe('Simple text')
    expect(t('admin.title')).toBe('Dashboard')
  })

  it('key 不存在时抛出错误', () => {
    const t = createTranslator(messages, 'en', 'admin')
    expect(() => t('missing')).toThrow('Missing translation message: admin.missing')
  })
})
