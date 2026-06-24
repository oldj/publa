'use client'

/**
 * 基于 CodeMirror 6 `@codemirror/merge` 的只读双栏对比视图。
 * 左栏为较旧版本，右栏为较新版本，两侧均只读、不提供 revert 控件。
 * 颜色与暗色模式由同名 scss module 通过 Mantine CSS 变量控制。
 */
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import styles from './RevisionDiffView.module.scss'

interface Props {
  /** 较旧版本的源码内容（富文本为 HTML，源码模式为编辑原文），显示在左侧 */
  leftValue: string
  /** 较新版本的源码内容（富文本为 HTML，源码模式为编辑原文），显示在右侧 */
  rightValue: string
  /** 左栏无障碍标签 */
  leftLabel: string
  /** 右栏无障碍标签 */
  rightLabel: string
}

export default function RevisionDiffView({ leftValue, rightValue, leftLabel, rightLabel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 只读对比的内容在视图存续期间不会变化，故仅在挂载时用初始值构建一次；
  // 每次发起新的对比由父级通过 key 触发重新挂载。
  const leftRef = useRef(leftValue)
  const rightRef = useRef(rightValue)
  const leftLabelRef = useRef(leftLabel)
  const rightLabelRef = useRef(rightLabel)

  useEffect(() => {
    if (!containerRef.current) return

    const readOnly = [
      lineNumbers(),
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ]

    const mergeView = new MergeView({
      parent: containerRef.current,
      a: {
        doc: leftRef.current,
        extensions: [
          ...readOnly,
          EditorView.contentAttributes.of({ 'aria-label': leftLabelRef.current }),
        ],
      },
      b: {
        doc: rightRef.current,
        extensions: [
          ...readOnly,
          EditorView.contentAttributes.of({ 'aria-label': rightLabelRef.current }),
        ],
      },
      gutter: true,
      // 折叠大段未变更内容，长文对比时聚焦差异
      collapseUnchanged: { margin: 3, minSize: 4 },
    })

    return () => {
      mergeView.destroy()
    }
  }, [])

  return <div ref={containerRef} className={styles.editor} />
}
