import { Button, Tooltip } from '@mantine/core'
import { useTranslations } from 'next-intl'
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTableOff,
} from '@tabler/icons-react'
import { TableCellsMerge, TableCellsSplit } from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface TableToolbarProps {
  editor: Editor
  tableToolbar: { top: number }
}

export default function TableToolbar({ editor, tableToolbar }: TableToolbarProps) {
  const t = useTranslations('admin.editor.tableToolbar')
  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()
  return (
    <div
      style={{
        position: 'absolute',
        top: tableToolbar.top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div className="image-bubble-menu" style={{ pointerEvents: 'auto' }}>
        <Tooltip label={t('addColumnBefore')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          >
            <IconColumnInsertLeft size={16} />
          </Button>
        </Tooltip>
        <Tooltip label={t('addColumnAfter')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <IconColumnInsertRight size={16} />
          </Button>
        </Tooltip>
        <Tooltip label={t('deleteColumn')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <IconColumnRemove size={16} />
          </Button>
        </Tooltip>

        <div style={{ width: 1, height: 16, background: 'var(--mantine-color-gray-3)' }} />

        <Tooltip label={t('addRowBefore')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addRowBefore().run()}
          >
            <IconRowInsertTop size={16} />
          </Button>
        </Tooltip>
        <Tooltip label={t('addRowAfter')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <IconRowInsertBottom size={16} />
          </Button>
        </Tooltip>
        <Tooltip label={t('deleteRow')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <IconRowRemove size={16} />
          </Button>
        </Tooltip>

        <div style={{ width: 1, height: 16, background: 'var(--mantine-color-gray-3)' }} />

        <Tooltip label={t('mergeCells')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            disabled={!canMerge}
            onClick={() => editor.chain().focus().mergeCells().run()}
          >
            <TableCellsMerge size={16} />
          </Button>
        </Tooltip>
        <Tooltip label={t('splitCell')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            disabled={!canSplit}
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            <TableCellsSplit size={16} />
          </Button>
        </Tooltip>

        <div style={{ width: 1, height: 16, background: 'var(--mantine-color-gray-3)' }} />

        <Tooltip label={t('deleteTable')} position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <IconTableOff size={16} />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
