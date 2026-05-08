'use client'

/**
 * 渐进式 ESC 的 Drawer 包装：当焦点位于文本输入元素（input / textarea /
 * contenteditable，覆盖 CodeMirror 等富文本场景）时，ESC 仅 blur 当前输入框；
 * 否则关闭 Drawer。
 *
 * 目的：避免在 Drawer 内编辑（如外观页面 CSS 编辑器、用户表单）时误按 ESC
 * 直接关闭、丢失尚未保存的内容。
 *
 * 实现：禁用 Mantine 自带的 closeOnEscape，由自身监听 ESC 决定是 blur 还是 onClose。
 * Mantine 的 ESC 监听位于 window 的 capture 阶段，比任何下层监听都先触发，因此
 * 用"先于 Mantine 拦截"的思路不可行；只能从 prop 关闭它再自实现。
 */

import { Drawer, type DrawerProps } from '@mantine/core'
import { useEffect, useRef } from 'react'

// 这些 input type 不接收文本输入，按 ESC 时按"不在输入元素"对待
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'range',
  'color',
  'image',
])

function isTextInputElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(el.type)
  }
  return false
}

// closeOnEscape 由组件内部强制为 false，禁止调用方传入避免歧义
type SafeDrawerProps = Omit<DrawerProps, 'closeOnEscape'>

export function SafeDrawer(props: SafeDrawerProps) {
  const { opened, onClose } = props

  // 用 ref 持有最新 onClose，避免内联箭头函数让 useEffect 每次 render 反复 add/remove 监听器
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Drawer 通过 portal 渲染在 body 末尾，rootRef 指向其 portal 容器；
  // 嵌套 Modal 是另一个 portal（兄弟节点），不会落在此容器内
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!opened) return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      const active = document.activeElement
      // 焦点指向某个具体元素但不在当前 Drawer 内（例如位于嵌套的 Modal 中）：
      // 让上层组件处理 ESC。document.body 视为"无焦点"（blur 后短暂状态），仍允许关闭
      if (active && active !== document.body && !rootRef.current?.contains(active)) return
      if (isTextInputElement(active)) {
        active.blur()
        // 多个 SafeDrawer 同时打开时，避免事件继续命中其他实例
        event.stopImmediatePropagation()
        event.preventDefault()
        return
      }
      onCloseRef.current()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [opened])

  return <Drawer {...props} ref={rootRef} closeOnEscape={false} />
}
