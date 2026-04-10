import { Button, Group, Modal, Stack, TextInput, Textarea } from '@mantine/core'
import type { Editor } from '@tiptap/react'

interface MathModalProps {
  editor: Editor | null
  opened: boolean
  onClose: () => void
  mathLatex: string
  setMathLatex: (v: string) => void
  mathEditType: React.RefObject<'inlineMath' | 'blockMath'>
  mathEditPos: React.RefObject<number | null>
}

export default function MathModal({
  editor,
  opened,
  onClose,
  mathLatex,
  setMathLatex,
  mathEditType,
  mathEditPos,
}: MathModalProps) {
  const handleConfirm = () => {
    if (!editor || !mathLatex.trim()) return
    const type = mathEditType.current
    const pos = mathEditPos.current

    if (pos !== null) {
      const node = editor.state.doc.nodeAt(pos)
      if (node) {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.replaceWith(
              pos,
              pos + node.nodeSize,
              editor.schema.nodes[type].create({ latex: mathLatex.trim() }),
            )
            return true
          })
          .run()
      }
    } else {
      editor
        .chain()
        .focus()
        .insertContent({ type, attrs: { latex: mathLatex.trim() } })
        .run()
    }

    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mathEditType.current === 'inlineMath' ? '编辑行内公式' : '编辑公式块'}
      size="lg"
      centered
    >
      <Stack>
        {mathEditType.current === 'blockMath' ? (
          <Textarea
            label="LaTeX"
            placeholder="输入 LaTeX 公式，如 \int_0^\infty x^2 dx"
            autosize
            minRows={3}
            value={mathLatex}
            onChange={(e) => setMathLatex(e.target.value)}
            styles={{ input: { fontFamily: 'monospace' } }}
            data-autofocus
          />
        ) : (
          <TextInput
            label="LaTeX"
            placeholder="输入 LaTeX 公式，如 E=mc^2"
            value={mathLatex}
            onChange={(e) => setMathLatex(e.target.value)}
            styles={{ input: { fontFamily: 'monospace' } }}
            data-autofocus
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm}>确定</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
