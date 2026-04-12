import { Button, Group, Modal, Stack, TextInput, Textarea } from '@mantine/core'
import type { Editor } from '@tiptap/react'
import { useTranslations } from 'next-intl'

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
  const tCommon = useTranslations('common')
  const t = useTranslations('admin.editor.mathModal')
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
      title={mathEditType.current === 'inlineMath' ? t('editInline') : t('editBlock')}
      size="lg"
      centered
    >
      <Stack>
        {mathEditType.current === 'blockMath' ? (
          <Textarea
            label="LaTeX"
            placeholder={t('placeholderBlock')}
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
            placeholder={t('placeholderInline')}
            value={mathLatex}
            onChange={(e) => setMathLatex(e.target.value)}
            styles={{ input: { fontFamily: 'monospace' } }}
            data-autofocus
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleConfirm}>{tCommon('actions.confirm')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
