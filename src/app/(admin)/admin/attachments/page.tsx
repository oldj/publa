'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Image,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import {
  IconCheck,
  IconCloud,
  IconCloudOff,
  IconCopy,
  IconDice3,
  IconFile,
  IconGridDots,
  IconLink,
  IconList,
  IconPencil,
  IconPhoto,
  IconSettings,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'
import styles from './page.module.scss'

interface Attachment {
  id: number
  filename: string
  originalFilename: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  storageKey: string
  storageProvider: string
  publicUrl: string
  createdAt: string
}

interface StorageConfig {
  storageProvider: string
  storageS3Endpoint: string
  storageS3Region: string
  storageS3Bucket: string
  storageS3AccessKey: string
  storageS3SecretKey: string
  storageOssRegion: string
  storageOssBucket: string
  storageOssAccessKeyId: string
  storageOssAccessKeySecret: string
  storageCosRegion: string
  storageCosBucket: string
  storageCosSecretId: string
  storageCosSecretKey: string
  storageR2AccountId: string
  storageR2Bucket: string
  storageR2AccessKey: string
  storageR2SecretKey: string
  attachmentBaseUrl: string
}

const providerLabel: Record<string, string> = {
  s3: 'S3',
  r2: 'R2',
  oss: 'OSS',
  cos: 'COS',
}

export default function AttachmentsPage() {
  const currentUser = useCurrentUser()
  const canManageConfig = currentUser?.role === 'owner'
  const [data, setData] = useState<{
    items: Attachment[]
    pageCount: number
    itemCount: number
  } | null>(null)
  const [page, setPage] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [viewMode, setViewMode] = useState<string>('list')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // 详情 Drawer
  const [detailAttachment, setDetailAttachment] = useState<Attachment | null>(null)

  // 重命名 Modal
  const [renameOpened, setRenameOpened] = useState(false)
  const [renameKey, setRenameKey] = useState('')
  const [renaming, setRenaming] = useState(false)

  // 配置
  const [config, setConfig] = useState<StorageConfig | null>(null)
  const [configForm, setConfigForm] = useState<StorageConfig | null>(null)
  const [configOpened, setConfigOpened] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const isConfigured =
    config?.storageProvider && ['s3', 'oss', 'cos', 'r2'].includes(config.storageProvider)
  const uploadEnabled = canManageConfig ? isConfigured : true

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/attachments?page=${page}`)
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [page])

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/attachments/config')
    const json = await res.json()
    if (json.success) setConfig(json.data)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!canManageConfig) return
    fetchConfig()
  }, [canManageConfig, fetchConfig])

  const openConfig = () => {
    setConfigForm(config ? { ...config } : null)
    setConfigOpened(true)
  }

  const setField = (key: keyof StorageConfig, value: string) => {
    if (!configForm) return
    setConfigForm({ ...configForm, [key]: value })
  }

  const handleTestConnection = async () => {
    if (!configForm?.storageProvider) return
    setTesting(true)

    const provider = configForm.storageProvider
    const testConfig: Record<string, string> = { provider }

    if (provider === 's3') {
      testConfig.endpoint = configForm.storageS3Endpoint
      testConfig.region = configForm.storageS3Region
      testConfig.bucket = configForm.storageS3Bucket
      testConfig.accessKey = configForm.storageS3AccessKey
      testConfig.secretKey = configForm.storageS3SecretKey
    } else if (provider === 'oss') {
      testConfig.region = configForm.storageOssRegion
      testConfig.bucket = configForm.storageOssBucket
      testConfig.accessKeyId = configForm.storageOssAccessKeyId
      testConfig.accessKeySecret = configForm.storageOssAccessKeySecret
    } else if (provider === 'cos') {
      testConfig.region = configForm.storageCosRegion
      testConfig.bucket = configForm.storageCosBucket
      testConfig.secretId = configForm.storageCosSecretId
      testConfig.secretKey = configForm.storageCosSecretKey
    } else if (provider === 'r2') {
      testConfig.accountId = configForm.storageR2AccountId
      testConfig.bucket = configForm.storageR2Bucket
      testConfig.accessKey = configForm.storageR2AccessKey
      testConfig.secretKey = configForm.storageR2SecretKey
    }

    try {
      const res = await fetch('/api/attachments/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '连接成功' })
      } else {
        notify({ color: 'red', message: json.message || '连接失败' })
      }
    } catch {
      notify({ color: 'red', message: '连接失败' })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!configForm) return
    setSaving(true)

    try {
      const res = await fetch('/api/attachments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '保存成功' })
        setConfigOpened(false)
        fetchConfig()
      } else {
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (files: File[]) => {
    if (!files.length) return
    setUploading(true)

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/attachments', { method: 'POST', body: formData })
        const json = await res.json()
        if (!json.success) {
          notify({ color: 'red', message: `上传 ${file.name} 失败：${json.message}` })
        }
      } catch {
        notify({ color: 'red', message: `上传 ${file.name} 失败` })
      }
    }

    setUploading(false)
    notify({ color: 'green', message: '上传完成' })
    fetchData()
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data) return
    if (selected.size === data.items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.items.map((a) => a.id)))
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!(await myModal.confirm({ message: `确定要删除「${name}」吗？` }))) return
    const nid = `delete-${id}`
    notifications.show({ id: nid, loading: true, message: '正在删除…', autoClose: false })
    const res = await fetch(`/api/attachments?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notifications.update({
        id: nid,
        loading: false,
        color: 'green',
        icon: <IconCheck size={18} />,
        message: '删除成功',
        autoClose: 2000,
      })
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (data && data.items.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchData()
      }
    } else {
      notifications.update({
        id: nid,
        loading: false,
        color: 'red',
        icon: <IconX size={18} />,
        message: json.message || '删除失败',
        autoClose: 4000,
      })
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!(await myModal.confirm({ message: `确定要删除选中的 ${selected.size} 个附件吗？` })))
      return

    const nid = 'batch-delete'
    const total = selected.size
    notifications.show({
      id: nid,
      loading: true,
      message: `正在删除 ${total} 个附件…`,
      autoClose: false,
    })

    let successCount = 0
    for (const id of selected) {
      const res = await fetch(`/api/attachments?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) successCount++
    }

    const failCount = total - successCount
    if (failCount > 0) {
      notifications.update({
        id: nid,
        loading: false,
        color: 'orange',
        icon: <IconX size={18} />,
        message: `已删除 ${successCount} 个，${failCount} 个删除失败`,
        autoClose: 4000,
      })
    } else {
      notifications.update({
        id: nid,
        loading: false,
        color: 'green',
        icon: <IconCheck size={18} />,
        message: `已删除 ${successCount} 个附件`,
        autoClose: 2000,
      })
    }
    setSelected(new Set())
    if (data && successCount >= data.items.length && page > 1) {
      setPage(page - 1)
    } else {
      fetchData()
    }
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    notify({ color: 'green', message: '已复制链接' })
  }

  const openDetail = (att: Attachment) => {
    setDetailAttachment(att)
  }

  const openRename = () => {
    if (!detailAttachment) return
    setRenameKey(detailAttachment.storageKey)
    setRenameOpened(true)
  }

  const handleRandomName = () => {
    const lastSlash = renameKey.lastIndexOf('/')
    const dir = lastSlash >= 0 ? renameKey.slice(0, lastSlash) : ''
    const filename = lastSlash >= 0 ? renameKey.slice(lastSlash + 1) : renameKey
    const dotIdx = filename.lastIndexOf('.')
    const ext = dotIdx >= 0 ? filename.slice(dotIdx) : ''
    setRenameKey(`${dir}/${nanoid(12)}${ext}`)
  }

  const handleRename = async () => {
    if (!detailAttachment) return
    const newKey = renameKey.trim()
    if (newKey === detailAttachment.storageKey) {
      setRenameOpened(false)
      return
    }

    setRenaming(true)
    try {
      const res = await fetch(`/api/attachments/${detailAttachment.id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStorageKey: newKey }),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '重命名成功' })
        setRenameOpened(false)
        setDetailAttachment(json.data)
        fetchData()
      } else {
        notify({ color: 'red', message: json.message || '重命名失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setRenaming(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const isImage = (mimeType: string) => mimeType.startsWith('image/')

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <Title order={3}>附件管理</Title>
          {canManageConfig &&
            (isConfigured ? (
              <Badge variant="light" color="green" leftSection={<IconCloud size={12} />}>
                {providerLabel[config!.storageProvider] || config!.storageProvider}
              </Badge>
            ) : (
              <Badge variant="light" color="orange" leftSection={<IconCloudOff size={12} />}>
                未配置
              </Badge>
            ))}
        </Group>
        {canManageConfig && (
          <Button variant="light" leftSection={<IconSettings size={16} />} onClick={openConfig}>
            配置
          </Button>
        )}
      </Group>

      {/* 上传区域 */}
      <Dropzone
        onDrop={handleUpload}
        loading={uploading}
        disabled={!uploadEnabled}
        mb="lg"
        className={styles.dropzone}
      >
        <Group justify="center" gap="xl" style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={40} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={40} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto size={40} stroke={1.5} color="var(--mantine-color-dimmed)" />
          </Dropzone.Idle>
          <div>
            <Text size="lg" inline>
              {isConfigured ? '拖拽文件到此处或点击选择文件' : '请先配置存储服务'}
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              支持多文件上传
            </Text>
          </div>
        </Group>
      </Dropzone>

      {/* 视图切换 + 批量操作 */}
      <Group justify="space-between" mb="sm">
        {viewMode === 'list' && selected.size > 0 ? (
          <Button
            size="xs"
            color="red"
            variant="light"
            leftSection={<IconTrash size={14} />}
            onClick={handleBatchDelete}
          >
            删除选中 ({selected.size})
          </Button>
        ) : (
          <div />
        )}

        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={setViewMode}
          data={[
            {
              value: 'list',
              label: (
                <Group gap={0} justify="center" w={28} h={20}>
                  <IconList size={16} />
                </Group>
              ),
            },
            {
              value: 'grid',
              label: (
                <Group gap={0} justify="center" w={28} h={20}>
                  <IconGridDots size={16} />
                </Group>
              ),
            },
          ]}
        />
      </Group>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <Table highlightOnHover className={adminStyles.tableContainer}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  size="xs"
                  checked={
                    data ? data.items.length > 0 && selected.size === data.items.length : false
                  }
                  indeterminate={selected.size > 0 && selected.size < (data?.items.length || 0)}
                  onChange={toggleSelectAll}
                />
              </Table.Th>
              <Table.Th style={{ width: 64 }} />
              <Table.Th>文件</Table.Th>
              <Table.Th style={{ width: 50 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((att) => (
              <Table.Tr key={att.id}>
                <Table.Td style={{ width: 40 }}>
                  <Checkbox
                    size="xs"
                    checked={selected.has(att.id)}
                    onChange={() => toggleSelect(att.id)}
                  />
                </Table.Td>
                <Table.Td style={{ width: 64 }}>
                  {isImage(att.mimeType) ? (
                    <Image
                      src={att.publicUrl}
                      w={48}
                      h={48}
                      radius="sm"
                      alt={att.originalFilename}
                      fit="cover"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setPreviewUrl(att.publicUrl)}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f5f5f5',
                        borderRadius: 4,
                      }}
                    >
                      <IconFile size={20} color="var(--mantine-color-dimmed)" />
                    </div>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} title={att.filename}>
                    {att.filename}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {att.mimeType} · {formatSize(att.size)} ·{' '}
                    {dayjs(att.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </Table.Td>
                <Table.Td style={{ width: 120 }}>
                  <Group gap={4}>
                    <Tooltip label="复制链接" position="top" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        onClick={() => handleCopyUrl(att.publicUrl)}
                      >
                        <IconLink size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="编辑" position="top" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        onClick={() => openDetail(att)}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除" position="top" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="md"
                        onClick={() => handleDelete(att.id, att.originalFilename)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* 网格视图 */}
      {viewMode === 'grid' && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
          {data?.items.map((att) => (
            <Card key={att.id} shadow="sm" padding="xs" radius="md" withBorder>
              {isImage(att.mimeType) ? (
                <Card.Section
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPreviewUrl(att.publicUrl)}
                >
                  <Image src={att.publicUrl} height={120} alt={att.originalFilename} fit="cover" />
                </Card.Section>
              ) : (
                <Card.Section
                  p="md"
                  style={{
                    height: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f5f5f5',
                  }}
                >
                  <IconFile size={32} color="var(--mantine-color-dimmed)" />
                </Card.Section>
              )}
              <Text size="xs" mt="xs" lineClamp={1} title={att.filename}>
                {att.filename}
              </Text>
              <Group justify="space-between" mt={4}>
                <Text size="xs" c="dimmed">
                  {formatSize(att.size)}
                </Text>
                <Group gap={4}>
                  <Tooltip label="复制链接" position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => handleCopyUrl(att.publicUrl)}
                    >
                      <IconLink size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="编辑" position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => openDetail(att)}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="删除" position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleDelete(att.id, att.originalFilename)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {data?.items.length === 0 && (
        <Text ta="center" c="dimmed" py="xl">
          暂无附件
        </Text>
      )}

      {data && (
        <Group justify="center" mt="md" gap="md">
          {data.itemCount > 0 && (
            <Text size="sm" c="dimmed">
              共 {data.itemCount} 个
            </Text>
          )}
          {data.pageCount > 1 && (
            <Pagination total={data.pageCount} value={page} onChange={setPage} />
          )}
        </Group>
      )}

      {/* 图片预览 */}
      <Modal
        opened={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        size="80%"
        centered
        withCloseButton
        padding={0}
        styles={{ body: { display: 'flex', justifyContent: 'center' } }}
      >
        {previewUrl && <Image src={previewUrl} alt="preview" fit="contain" mah="80vh" />}
      </Modal>

      {/* 附件详情 Drawer */}
      <Drawer
        opened={!!detailAttachment}
        onClose={() => setDetailAttachment(null)}
        title="附件详情"
        position="right"
        size="lg"
      >
        {detailAttachment && (
          <Stack gap="md">
            {isImage(detailAttachment.mimeType) && (
              <Image
                src={detailAttachment.publicUrl}
                alt={detailAttachment.filename}
                fit="contain"
                mah={300}
                radius="sm"
              />
            )}

            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={500} w={100}>
                    文件名
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ wordBreak: 'break-all' }}>
                      {detailAttachment.filename}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>原始文件名</Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ wordBreak: 'break-all' }}>
                      {detailAttachment.originalFilename}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>存储路径</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" style={{ wordBreak: 'break-all' }}>
                        {detailAttachment.storageKey}
                      </Text>
                      <Tooltip label="修改" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={openRename}
                          style={{ flexShrink: 0 }}
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>类型</Table.Td>
                  <Table.Td>
                    <Text size="sm">{detailAttachment.mimeType}</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>存储</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {providerLabel[detailAttachment.storageProvider] ||
                        detailAttachment.storageProvider}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>大小</Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatSize(detailAttachment.size)}</Text>
                  </Table.Td>
                </Table.Tr>
                {detailAttachment.width && detailAttachment.height && (
                  <Table.Tr>
                    <Table.Td fw={500}>尺寸</Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {detailAttachment.width} × {detailAttachment.height}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr>
                  <Table.Td fw={500}>URL</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Anchor
                        href={detailAttachment.publicUrl}
                        target="_blank"
                        size="sm"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {detailAttachment.publicUrl}
                      </Anchor>
                      <Tooltip label="复制链接" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={() => handleCopyUrl(detailAttachment.publicUrl)}
                          style={{ flexShrink: 0 }}
                        >
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>上传时间</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {dayjs(detailAttachment.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>

            <Divider />
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={async () => {
                const confirmed = await myModal.confirm({
                  message: `确定要删除「${detailAttachment.originalFilename}」吗？`,
                })
                if (!confirmed) return
                const nid = `delete-detail-${detailAttachment.id}`
                notifications.show({
                  id: nid,
                  loading: true,
                  message: '正在删除…',
                  autoClose: false,
                })
                const res = await fetch(`/api/attachments?id=${detailAttachment.id}`, {
                  method: 'DELETE',
                })
                const json = await res.json()
                if (json.success) {
                  notifications.update({
                    id: nid,
                    loading: false,
                    color: 'green',
                    icon: <IconCheck size={18} />,
                    message: '删除成功',
                    autoClose: 2000,
                  })
                  setDetailAttachment(null)
                  if (data && data.items.length <= 1 && page > 1) {
                    setPage(page - 1)
                  } else {
                    fetchData()
                  }
                } else {
                  notifications.update({
                    id: nid,
                    loading: false,
                    color: 'red',
                    icon: <IconX size={18} />,
                    message: json.message || '删除失败',
                    autoClose: 4000,
                  })
                }
              }}
            >
              删除附件
            </Button>
          </Stack>
        )}
      </Drawer>

      {/* 重命名 Modal */}
      <Modal
        opened={renameOpened}
        onClose={() => setRenameOpened(false)}
        title="修改存储路径"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="存储路径"
            value={renameKey}
            onChange={(e) => setRenameKey(e.target.value)}
            rightSection={
              <Tooltip label="随机命名" withArrow>
                <ActionIcon variant="subtle" color="gray" onClick={handleRandomName}>
                  <IconDice3 size={16} />
                </ActionIcon>
              </Tooltip>
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRenameOpened(false)}>
              取消
            </Button>
            <Button onClick={handleRename} loading={renaming}>
              确认
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* 存储配置 Drawer */}
      <Drawer
        opened={configOpened}
        onClose={() => setConfigOpened(false)}
        title="存储配置"
        position="right"
        size="md"
      >
        {configForm && (
          <Stack gap="md">
            <Select
              label="存储服务商"
              placeholder="请选择"
              data={[
                { value: 's3', label: 'S3（AWS / MinIO / 兼容 S3 协议）' },
                { value: 'r2', label: 'R2（Cloudflare 对象存储）' },
                { value: 'oss', label: 'OSS（阿里云对象存储）' },
                { value: 'cos', label: 'COS（腾讯云对象存储）' },
              ]}
              value={configForm.storageProvider || null}
              onChange={(v) => setField('storageProvider', v || '')}
            />

            {configForm.storageProvider === 's3' && (
              <>
                <Divider label="S3 配置" labelPosition="left" />
                <TextInput
                  label="Endpoint"
                  placeholder="https://s3.amazonaws.com"
                  value={configForm.storageS3Endpoint}
                  onChange={(e) => setField('storageS3Endpoint', e.target.value)}
                />
                <TextInput
                  label="Region"
                  placeholder="us-east-1"
                  value={configForm.storageS3Region}
                  onChange={(e) => setField('storageS3Region', e.target.value)}
                />
                <TextInput
                  label="Bucket"
                  value={configForm.storageS3Bucket}
                  onChange={(e) => setField('storageS3Bucket', e.target.value)}
                />
                <TextInput
                  label="Access Key"
                  value={configForm.storageS3AccessKey}
                  onChange={(e) => setField('storageS3AccessKey', e.target.value)}
                />
                <TextInput
                  label="Secret Key"
                  value={configForm.storageS3SecretKey}
                  onChange={(e) => setField('storageS3SecretKey', e.target.value)}
                />
              </>
            )}

            {configForm.storageProvider === 'oss' && (
              <>
                <Divider label="OSS 配置" labelPosition="left" />
                <TextInput
                  label="Region"
                  placeholder="oss-cn-hangzhou"
                  value={configForm.storageOssRegion}
                  onChange={(e) => setField('storageOssRegion', e.target.value)}
                />
                <TextInput
                  label="Bucket"
                  value={configForm.storageOssBucket}
                  onChange={(e) => setField('storageOssBucket', e.target.value)}
                />
                <TextInput
                  label="AccessKey ID"
                  value={configForm.storageOssAccessKeyId}
                  onChange={(e) => setField('storageOssAccessKeyId', e.target.value)}
                />
                <TextInput
                  label="AccessKey Secret"
                  value={configForm.storageOssAccessKeySecret}
                  onChange={(e) => setField('storageOssAccessKeySecret', e.target.value)}
                />
              </>
            )}

            {configForm.storageProvider === 'cos' && (
              <>
                <Divider label="COS 配置" labelPosition="left" />
                <TextInput
                  label="Region"
                  placeholder="ap-guangzhou"
                  value={configForm.storageCosRegion}
                  onChange={(e) => setField('storageCosRegion', e.target.value)}
                />
                <TextInput
                  label="Bucket"
                  placeholder="bucket-1234567890"
                  value={configForm.storageCosBucket}
                  onChange={(e) => setField('storageCosBucket', e.target.value)}
                />
                <TextInput
                  label="SecretId"
                  value={configForm.storageCosSecretId}
                  onChange={(e) => setField('storageCosSecretId', e.target.value)}
                />
                <TextInput
                  label="SecretKey"
                  value={configForm.storageCosSecretKey}
                  onChange={(e) => setField('storageCosSecretKey', e.target.value)}
                />
              </>
            )}

            {configForm.storageProvider === 'r2' && (
              <>
                <Divider label="R2 配置" labelPosition="left" />
                <TextInput
                  label="Account ID"
                  description="Cloudflare 账户 ID，可在仪表盘右侧找到"
                  value={configForm.storageR2AccountId}
                  onChange={(e) => setField('storageR2AccountId', e.target.value)}
                />
                <TextInput
                  label="Bucket"
                  value={configForm.storageR2Bucket}
                  onChange={(e) => setField('storageR2Bucket', e.target.value)}
                />
                <TextInput
                  label="Access Key ID"
                  value={configForm.storageR2AccessKey}
                  onChange={(e) => setField('storageR2AccessKey', e.target.value)}
                />
                <TextInput
                  label="Secret Access Key"
                  value={configForm.storageR2SecretKey}
                  onChange={(e) => setField('storageR2SecretKey', e.target.value)}
                />
              </>
            )}

            <Divider label="通用配置" labelPosition="left" />
            <TextInput
              label="附件服务地址"
              description="可选。如 https://cdn.xxx.com，用于拼接附件的完整访问地址"
              placeholder="https://cdn.xxx.com"
              value={configForm.attachmentBaseUrl}
              onChange={(e) => setField('attachmentBaseUrl', e.target.value)}
            />

            <Group mt="md">
              {configForm.storageProvider && (
                <Button
                  variant="light"
                  onClick={handleTestConnection}
                  loading={testing}
                  leftSection={<IconCheck size={16} />}
                >
                  测试连接
                </Button>
              )}
              <Button onClick={handleSaveConfig} loading={saving}>
                保存
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Box>
  )
}
