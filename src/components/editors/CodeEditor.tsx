'use client'

/**
 * 基于 CodeMirror 6 封装的代码编辑器，用于 Markdown / HTML 源码模式。
 * 提供行号、语法高亮、括号匹配、行换行等基础能力，UI 上沿用 Mantine 的 Input.Wrapper
 * 以与 PostEditor / PageEditor 中其他表单字段保持一致。
 */

import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { Input, useComputedColorScheme } from '@mantine/core'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import CodeMirror, { type Extension } from '@uiw/react-codemirror'
import { useMemo } from 'react'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: 'markdown' | 'html'
  label?: React.ReactNode
  placeholder?: string
  /** 编辑区固定高度，CSS 长度值，默认 min(720px, calc(100vh - 220px))。内容超出时内部滚动 */
  height?: string
}

export default function CodeEditor({
  value,
  onChange,
  language,
  label,
  placeholder,
  height = 'min(720px, calc(100vh - 220px))',
}: CodeEditorProps) {
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: false })

  const extensions = useMemo<Extension[]>(() => {
    const langExt = language === 'markdown' ? markdown() : html()
    return [
      langExt,
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          // Markdown 视为正文写作，使用更大字号；HTML 视为代码，保持紧凑
          fontSize: language === 'markdown' ? '16px' : '13px',
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-default)',
          // 关键：裁剪行号槽等子元素，避免左上/左下角溢出外层圆角
          overflow: 'hidden',
        },
        '&.cm-focused': {
          outline: 'none',
          borderColor: 'var(--mantine-primary-color-filled)',
        },
        '.cm-scroller': {
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          lineHeight: '1.6',
        },
        // 让内容区至少撑满 scroller，否则点击空白区域无法定位光标
        '.cm-content': {
          minHeight: '100%',
        },
        // 行号槽同样撑满，避免短内容时左侧出现"行号 - 空白"的断层
        '.cm-gutters': {
          backgroundColor: 'var(--mantine-color-default-hover)',
          color: 'var(--mantine-color-dimmed)',
          borderRight: '1px solid var(--mantine-color-default-border)',
          minHeight: '100%',
        },
      }),
    ]
  }, [language])

  return (
    <Input.Wrapper label={label}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        placeholder={placeholder}
        theme={colorScheme === 'dark' ? vscodeDark : vscodeLight}
        basicSetup={{
          // Markdown 视为正文写作，去掉行号 / 折叠槽更接近文本编辑器；HTML 仍按代码处理
          lineNumbers: language === 'html',
          foldGutter: language === 'html',
          highlightActiveLine: true,
          highlightActiveLineGutter: language === 'html',
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          highlightSelectionMatches: false,
        }}
        height={height}
      />
    </Input.Wrapper>
  )
}
