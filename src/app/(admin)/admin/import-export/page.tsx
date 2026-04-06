'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { notify } from '@/lib/notify'
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  List,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconDownload, IconEye, IconUpload } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAdminCounts, useCurrentUser } from '../../_components/AdminCountsContext'

interface ImportFile {
  name: string
  type: 'content' | 'settings'
  data: any
}

const typeLabel: Record<string, string> = {
  content: '内容数据',
  settings: '设置数据',
}

export default function ImportExportPage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const { refreshCounts } = useAdminCounts()
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<string[]>([])
  const [importFile, setImportFile] = useState<ImportFile | null>(null)

  // 数据格式文档
  const [formatHtml, setFormatHtml] = useState('')
  const [formatOpened, setFormatOpened] = useState(false)

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace('/admin')
    }
  }, [currentUser, router])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const handleExport = async (type: 'content' | 'settings') => {
    const message =
      type === 'content' ? (
        '将导出文章、页面、分类、标签、评论、留言、附件、历史记录等内容数据，确定导出吗？'
      ) : (
        <>
          <p>
            将导出用户、菜单、系统设置、跳转规则等设置数据。
            <br />
            注意：密码、存储密钥等敏感信息不会被导出。
          </p>
        </>
      )
    const confirmed = await myModal.confirm({ message })
    if (!confirmed) return
    window.open(`/api/import-export?type=${type}`, '_blank')
  }

  const handleSelectFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!data?.meta?.type || !['content', 'settings'].includes(data.meta.type)) {
          notify({ color: 'red', message: '无法识别的文件格式' })
          return
        }

        setImportFile({ name: file.name, type: data.meta.type, data })
        setImportResults([])
      } catch {
        notify({ color: 'red', message: '文件解析失败，请检查 JSON 格式' })
      }
    }
    input.click()
  }

  const handleImport = async (mode: 'overwrite' | 'merge') => {
    if (!importFile) return

    const typeText = typeLabel[importFile.type]
    if (mode === 'overwrite') {
      const confirmed = await myModal.confirm({
        message: `覆盖导入将清空现有${typeText}后重新导入，确定继续吗？`,
      })
      if (!confirmed) return
    }

    setImporting(true)
    setImportResults([])

    try {
      const res = await fetch('/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importFile.data),
      })
      const json = await res.json()

      if (json.success) {
        setImportResults(json.data.results)
        await refreshCounts()
        notify({ color: 'green', message: '导入完成' })
      } else {
        notify({ color: 'red', message: json.message || '导入失败' })
      }
    } catch {
      notify({ color: 'red', message: '导入失败' })
    } finally {
      setImporting(false)
    }
  }

  const showFormat = async () => {
    if (!formatHtml) {
      const res = await fetch('/api/import-export/format')
      const json = await res.json()
      if (json.success) setFormatHtml(json.data.html)
    }
    setFormatOpened(true)
  }

  const downloadFormat = async () => {
    const res = await fetch('/api/import-export/format')
    const json = await res.json()
    if (!json.success) return
    const blob = new Blob([json.data.md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-export-format.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>导入导出</Title>
        <Group gap="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEye size={14} />}
            onClick={showFormat}
          >
            查看数据格式
          </Button>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={downloadFormat}
          >
            下载文档
          </Button>
        </Group>
      </Group>

      <Stack>
        {/* 导出 */}
        <Paper withBorder p="md">
          <Text fw={500} mb="sm">
            导出数据
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            将数据导出为 JSON
            文件。内容数据包含文章、页面、分类、标签、评论、留言、附件、历史记录；设置数据包含用户、菜单、系统设置、跳转规则。
          </Text>
          <Group>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={() => handleExport('content')}
            >
              导出内容数据
            </Button>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={() => handleExport('settings')}
            >
              导出设置数据
            </Button>
          </Group>
        </Paper>

        {/* 导入 */}
        <Paper withBorder p="md">
          <Text fw={500} mb="sm">
            导入数据
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            选择 JSON 文件后，系统会自动识别数据类型。覆盖导入会先清空对应的现有数据。
          </Text>

          <Button leftSection={<IconUpload size={16} />} onClick={handleSelectFile} variant="light">
            选择文件
          </Button>

          {importFile && (
            <div style={{ marginTop: 16 }}>
              <Divider mb="sm" />
              <Group gap="sm" mb="md">
                <Text size="sm">已选择：{importFile.name}</Text>
                <Badge variant="light">{typeLabel[importFile.type]}</Badge>
              </Group>
              <Group>
                <Button
                  onClick={() => handleImport('overwrite')}
                  loading={importing}
                  color="orange"
                >
                  覆盖导入
                </Button>
                {importFile.type === 'content' && (
                  <Button disabled title="合并导入功能即将推出">
                    合并导入
                  </Button>
                )}
              </Group>
            </div>
          )}

          {importResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Divider mb="sm" />
              <Text size="sm" fw={500} mb="xs">
                导入结果：
              </Text>
              <List size="sm">
                {importResults.map((r, i) => (
                  <List.Item key={i}>{r}</List.Item>
                ))}
              </List>
            </div>
          )}
        </Paper>
      </Stack>

      {/* 数据格式文档 Drawer */}
      <Drawer
        opened={formatOpened}
        onClose={() => setFormatOpened(false)}
        title="数据格式说明"
        position="right"
        size="xl"
      >
        <ScrollArea h="calc(100vh - 100px)">
          <div className="post-content" dangerouslySetInnerHTML={{ __html: formatHtml }} />
        </ScrollArea>
      </Drawer>
    </div>
  )
}
