'use client'

/**
 * 基于 CodeMirror 6 封装的代码编辑器，用于 Markdown / HTML / CSS 源码模式。
 * 提供行号、语法高亮、括号匹配、行换行等基础能力，UI 上沿用 Mantine 的 Input.Wrapper
 * 以与 PostEditor / PageEditor 中其他表单字段保持一致。
 */

import { indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { EditorView, keymap } from '@codemirror/view'
import { Input, useComputedColorScheme } from '@mantine/core'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import CodeMirror, { type Extension } from '@uiw/react-codemirror'
import { useMemo } from 'react'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: 'markdown' | 'html' | 'css'
  label?: React.ReactNode
  /** 字段说明文字，渲染在 label 下方，与 Mantine Input.Wrapper 的 description 一致 */
  description?: React.ReactNode
  placeholder?: string
  /** 编辑区固定高度，CSS 长度值，默认 min(720px, calc(100vh - 220px))。内容超出时内部滚动 */
  height?: string
}

export default function CodeEditor({
  value,
  onChange,
  language,
  label,
  description,
  placeholder,
  height = 'min(720px, calc(100vh - 220px))',
}: CodeEditorProps) {
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: false })

  const extensions = useMemo<Extension[]>(() => {
    let langExt: Extension
    switch (language) {
      case 'markdown':
        langExt = markdown()
        break
      case 'css':
        langExt = css()
        break
      case 'html':
        langExt = html()
        break
      default: {
        // 类型穷尽检查：联合类型新增成员时此处会编译失败，提醒补上对应分支
        const _exhaustive: never = language
        throw new Error(`Unsupported language: ${_exhaustive}`)
      }
    }
    return [
      langExt,
      // Tab 键统一缩进 4 个空格，避免焦点跳出编辑区
      indentUnit.of('    '),
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          // Markdown 视为正文写作，使用更大字号；HTML / CSS 视为代码，保持紧凑
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
    <Input.Wrapper
      label={label}
      description={description}
      styles={{ description: { marginBottom: '4px' } }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        placeholder={placeholder}
        theme={colorScheme === 'dark' ? vscodeDark : vscodeLight}
        basicSetup={{
          // Markdown 视为正文写作，去掉行号 / 折叠槽更接近文本编辑器；HTML / CSS 按代码处理
          lineNumbers: language !== 'markdown',
          foldGutter: language !== 'markdown',
          highlightActiveLine: true,
          highlightActiveLineGutter: language !== 'markdown',
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
