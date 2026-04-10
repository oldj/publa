import { Button, Tooltip } from '@mantine/core'
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTableOff,
} from '@tabler/icons-react'
import type { Editor } from '@tiptap/react'

interface TableToolbarProps {
  editor: Editor
  tableToolbar: { top: number }
}

export default function TableToolbar({ editor, tableToolbar }: TableToolbarProps) {
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
        <Tooltip label="前方插入列" position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          >
            <IconColumnInsertLeft size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="后方插入列" position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <IconColumnInsertRight size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="删除列" position="top" withArrow>
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

        <Tooltip label="上方插入行" position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addRowBefore().run()}
          >
            <IconRowInsertTop size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="下方插入行" position="top" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <IconRowInsertBottom size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="删除行" position="top" withArrow>
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

        <Tooltip label="删除表格" position="top" withArrow>
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
