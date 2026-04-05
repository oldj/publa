import { describe, expect, it } from 'vitest'
import { shouldCreateDraftRecord } from './draft-persistence'

describe('shouldCreateDraftRecord', () => {
  it('仅输入标题时也应创建首条草稿', () => {
    expect(
      shouldCreateDraftRecord({
        title: '只有标题',
        contentType: 'markdown',
        currentContent: '',
      }),
    ).toBe(true)
  })

  it('富文本空白占位内容不应触发创建', () => {
    expect(
      shouldCreateDraftRecord({
        title: '',
        contentType: 'richtext',
        currentContent: '<p></p>',
        richTextText: '',
      }),
    ).toBe(false)
  })

  it('Markdown 有实际内容时应创建首条草稿', () => {
    expect(
      shouldCreateDraftRecord({
        title: '',
        contentType: 'markdown',
        currentContent: '# 标题',
      }),
    ).toBe(true)
  })
})
