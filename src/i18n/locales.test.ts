import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, guessLocaleFromAcceptLanguage, isLocale } from './locales'

describe('isLocale', () => {
  it('接受受支持的 locale', () => {
    expect(isLocale('zh')).toBe(true)
    expect(isLocale('en')).toBe(true)
  })

  it('拒绝不受支持的字符串', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('EN')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale('zh-CN')).toBe(false)
  })

  it('拒绝非字符串类型', () => {
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale(123)).toBe(false)
    expect(isLocale(true)).toBe(false)
    expect(isLocale({})).toBe(false)
  })
})

describe('guessLocaleFromAcceptLanguage', () => {
  it('空值返回默认 locale', () => {
    expect(guessLocaleFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE)
    expect(guessLocaleFromAcceptLanguage(undefined)).toBe(DEFAULT_LOCALE)
    expect(guessLocaleFromAcceptLanguage('')).toBe(DEFAULT_LOCALE)
  })

  it('zh 开头返回 zh', () => {
    expect(guessLocaleFromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh')
    expect(guessLocaleFromAcceptLanguage('zh')).toBe('zh')
    expect(guessLocaleFromAcceptLanguage('zh-TW')).toBe('zh')
  })

  it('非 zh 开头返回默认 locale', () => {
    expect(guessLocaleFromAcceptLanguage('en-US,en;q=0.9')).toBe(DEFAULT_LOCALE)
    expect(guessLocaleFromAcceptLanguage('ja,en;q=0.9')).toBe(DEFAULT_LOCALE)
    expect(guessLocaleFromAcceptLanguage('fr-FR')).toBe(DEFAULT_LOCALE)
  })
})
