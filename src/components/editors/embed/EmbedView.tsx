import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { buildEmbedStyle, getProviderById } from './providers'

/**
 * 编辑态下的嵌入节点渲染。
 * 覆盖一层透明点击层，拦截鼠标事件防止被 iframe 吞掉，便于 ProseMirror 选中节点
 */
export default function EmbedView({ node, selected }: NodeViewProps) {
  const src = (node.attrs.src as string | null) ?? ''
  const providerId = (node.attrs.provider as string | null) ?? ''
  const provider = getProviderById(providerId)
  const aspectRatio = provider?.aspectRatio ?? '16/9'
  const containerStyle = provider ? buildEmbedStyle(provider) : 'aspect-ratio:16/9'

  return (
    <NodeViewWrapper
      className={selected ? 'embed embed-selected' : 'embed'}
      data-embed=""
      data-provider={providerId}
      data-aspect-ratio={aspectRatio}
      style={parseStyleString(containerStyle)}
    >
      <iframe
        src={src}
        loading="lazy"
        frameBorder={0}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        title={`${providerId} embed`}
      />
      {/* 透明点击层，只在未选中时覆盖 iframe，点击后让 ProseMirror 选中节点 */}
      {!selected && <div className="embed-click-mask" contentEditable={false} />}
    </NodeViewWrapper>
  )
}

/** 将 "a:b;c:d" 这种字符串转成 React 能识别的 style 对象 */
function parseStyleString(style: string): React.CSSProperties {
  const out: Record<string, string> = {}
  for (const part of style.split(';')) {
    const [k, v] = part.split(':').map((s) => s.trim())
    if (!k || !v) continue
    // kebab → camel
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  }
  return out as React.CSSProperties
}
