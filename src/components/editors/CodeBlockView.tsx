import { codeHighlightAliases, codeHighlightLanguages } from '@/lib/code-highlight'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { createLowlight } from 'lowlight'

// 代码高亮初始化
export const lowlight = createLowlight()
lowlight.register(codeHighlightLanguages)
lowlight.registerAlias(codeHighlightAliases)
const languages = lowlight.listLanguages()

// 代码块自定义组件，左上角显示语言选择器
export default function CodeBlockView({ node, updateAttributes }: any) {
  return (
    <NodeViewWrapper style={{ position: 'relative' }}>
      <select
        contentEditable={false}
        value={node.attrs.language || ''}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          zIndex: 1,
          fontSize: 12,
          padding: '2px 4px',
          borderRadius: 4,
          border: '1px solid #ddd',
          background: '#f5f5f5',
          color: '#555',
          cursor: 'pointer',
        }}
      >
        <option value="">auto</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
      <pre>
        <NodeViewContent as={'code' as any} />
      </pre>
    </NodeViewWrapper>
  )
}
