'use client'

import { useCurrentUser } from '@/app/(admin)/_components/AdminCountsContext'
import adminStyles from '@/app/(admin)/_components/AdminShell.module.scss'
import myModal from '@/app/(admin)/_components/myModals'
import { SafeDrawer } from '@/components/SafeDrawer'
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
  IconExclamationMark,
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
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
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
  const t = useTranslations('admin.attachmentsPage')
  const tCommon = useTranslations('common')
  const tApi = useTranslations('admin.api.attachments')
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
        notify({ color: 'green', message: t('messages.connectionSuccess') })
      } else {
        notify({ color: 'red', message: json.message || tApi('connectionFailed') })
      }
    } catch {
      notify({ color: 'red', message: tApi('connectionFailed') })
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
        notify({ color: 'green', message: tCommon('save.success') })
        setConfigOpened(false)
        fetchConfig()
      } else {
        notify({ color: 'red', message: json.message || tCommon('errors.saveFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (files: File[]) => {
    if (!files.length) return
    if (canManageConfig && !isConfigured) {
      notify({ color: 'orange', message: t('upload.needConfig') })
      return
    }
    setUploading(true)

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/attachments', { method: 'POST', body: formData })
        const json = await res.json()
        if (!json.success) {
          notify({
            color: 'red',
            message: t('messages.uploadItemFailedWithMessage', {
              name: file.name,
              message: json.message || tCommon('errors.uploadFailed'),
            }),
          })
        }
      } catch {
        notify({ color: 'red', message: t('messages.uploadItemFailed', { name: file.name }) })
      }
    }

    setUploading(false)
    notify({ color: 'green', message: t('messages.uploadComplete') })
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
    if (!(await myModal.confirm({ message: t('confirm.deleteOne', { name }) }))) return
    const nid = `delete-${id}`
    notifications.show({
      id: nid,
      loading: true,
      message: t('notifications.deleting'),
      autoClose: false,
    })
    const res = await fetch(`/api/attachments?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notifications.update({
        id: nid,
        loading: false,
        color: 'green',
        icon: <IconCheck size={18} />,
        message: t('notifications.deleted'),
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
        message: json.message || tCommon('errors.deleteFailed'),
        autoClose: 4000,
      })
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!(await myModal.confirm({ message: t('confirm.deleteMany', { count: selected.size }) })))
      return

    const nid = 'batch-delete'
    const total = selected.size
    notifications.show({
      id: nid,
      loading: true,
      message: t('notifications.deletingMany', { count: total }),
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
        message: t('notifications.batchDeletedPartial', { successCount, failCount }),
        autoClose: 4000,
      })
    } else {
      notifications.update({
        id: nid,
        loading: false,
        color: 'green',
        icon: <IconCheck size={18} />,
        message: t('notifications.batchDeletedSuccess', { count: successCount }),
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
    notify({ color: 'green', message: t('messages.copySuccess') })
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
        notify({ color: 'green', message: t('messages.renameSuccess') })
        setRenameOpened(false)
        setDetailAttachment(json.data)
        fetchData()
      } else {
        notify({ color: 'red', message: json.message || tApi('renameFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
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
          <Title order={3}>{t('title')}</Title>
          {canManageConfig &&
            (isConfigured ? (
              <Badge variant="light" color="green" leftSection={<IconCloud size={12} />}>
                {providerLabel[config!.storageProvider] || config!.storageProvider}
              </Badge>
            ) : (
              <Badge variant="light" color="orange" leftSection={<IconCloudOff size={12} />}>
                {t('badges.unconfigured')}
              </Badge>
            ))}
        </Group>
        {canManageConfig && (
          <Button variant="light" leftSection={<IconSettings size={16} />} onClick={openConfig}>
            {t('buttons.config')}
          </Button>
        )}
      </Group>

      {/* 上传区域 */}
      <div
        onClickCapture={(e) => {
          if (canManageConfig && !isConfigured) {
            e.stopPropagation()
            e.preventDefault()
            notify({
              color: 'orange',
              icon: <IconExclamationMark size={18} />,
              message: t('upload.needConfig'),
            })
          }
        }}
      >
        <Dropzone onDrop={handleUpload} loading={uploading} mb="lg" className={styles.dropzone}>
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
                {isConfigured ? t('upload.ready') : t('upload.needConfig')}
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                {t('upload.hint')}
              </Text>
            </div>
          </Group>
        </Dropzone>
      </div>

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
            {t('buttons.deleteSelected', { count: selected.size })}
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
              <Table.Th>{t('columns.file')}</Table.Th>
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
                    <Tooltip label={t('tooltips.copyLink')} position="top" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        onClick={() => handleCopyUrl(att.publicUrl)}
                      >
                        <IconLink size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('tooltips.edit')} position="top" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        onClick={() => openDetail(att)}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('tooltips.delete')} position="top" withArrow>
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
                  <Tooltip label={t('tooltips.copyLink')} position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => handleCopyUrl(att.publicUrl)}
                    >
                      <IconLink size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('tooltips.edit')} position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => openDetail(att)}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('tooltips.delete')} position="top" withArrow>
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
          {t('empty')}
        </Text>
      )}

      {data && (
        <Group justify="center" mt="md" gap="md">
          {data.itemCount > 0 && (
            <Text size="sm" c="dimmed">
              {t('totalCount', { count: data.itemCount })}
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
        {previewUrl && <Image src={previewUrl} alt={t('previewAlt')} fit="contain" mah="80vh" />}
      </Modal>

      {/* 附件详情 Drawer */}
      <SafeDrawer
        opened={!!detailAttachment}
        onClose={() => setDetailAttachment(null)}
        title={t('detail.title')}
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
                    {t('detail.fields.filename')}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ wordBreak: 'break-all' }}>
                      {detailAttachment.filename}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>{t('detail.fields.originalFilename')}</Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ wordBreak: 'break-all' }}>
                      {detailAttachment.originalFilename}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>{t('detail.fields.storageKey')}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" style={{ wordBreak: 'break-all' }}>
                        {detailAttachment.storageKey}
                      </Text>
                      <Tooltip label={t('tooltips.rename')} withArrow>
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
                  <Table.Td fw={500}>{t('detail.fields.type')}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{detailAttachment.mimeType}</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>{t('detail.fields.storage')}</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {providerLabel[detailAttachment.storageProvider] ||
                        detailAttachment.storageProvider}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>{t('detail.fields.size')}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatSize(detailAttachment.size)}</Text>
                  </Table.Td>
                </Table.Tr>
                {detailAttachment.width && detailAttachment.height && (
                  <Table.Tr>
                    <Table.Td fw={500}>{t('detail.fields.dimensions')}</Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {detailAttachment.width} × {detailAttachment.height}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr>
                  <Table.Td fw={500}>{t('detail.fields.url')}</Table.Td>
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
                      <Tooltip label={t('tooltips.copyLink')} withArrow>
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
                  <Table.Td fw={500}>{t('detail.fields.uploadedAt')}</Table.Td>
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
                  message: t('confirm.deleteOne', { name: detailAttachment.originalFilename }),
                })
                if (!confirmed) return
                const nid = `delete-detail-${detailAttachment.id}`
                notifications.show({
                  id: nid,
                  loading: true,
                  message: t('notifications.deleting'),
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
                    message: t('notifications.deleted'),
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
                    message: json.message || tCommon('errors.deleteFailed'),
                    autoClose: 4000,
                  })
                }
              }}
            >
              {t('buttons.deleteAttachment')}
            </Button>
          </Stack>
        )}
      </SafeDrawer>

      {/* 重命名 Modal */}
      <Modal
        opened={renameOpened}
        onClose={() => setRenameOpened(false)}
        title={t('renameModal.title')}
        centered
      >
        <Stack gap="md">
          <TextInput
            label={t('renameModal.storageKey')}
            value={renameKey}
            onChange={(e) => setRenameKey(e.target.value)}
            rightSection={
              <Tooltip label={t('tooltips.randomName')} withArrow>
                <ActionIcon variant="subtle" color="gray" onClick={handleRandomName}>
                  <IconDice3 size={16} />
                </ActionIcon>
              </Tooltip>
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRenameOpened(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleRename} loading={renaming}>
              {tCommon('actions.confirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* 存储配置 Drawer */}
      <SafeDrawer
        opened={configOpened}
        onClose={() => setConfigOpened(false)}
        title={t('config.title')}
        position="right"
        size="md"
      >
        {configForm && (
          <Stack gap="md">
            <Select
              label={t('config.fields.provider')}
              placeholder={t('config.fields.providerPlaceholder')}
              data={[
                { value: 's3', label: t('config.providers.s3') },
                { value: 'r2', label: t('config.providers.r2') },
                { value: 'oss', label: t('config.providers.oss') },
                { value: 'cos', label: t('config.providers.cos') },
              ]}
              value={configForm.storageProvider || null}
              onChange={(v) => setField('storageProvider', v || '')}
            />

            {configForm.storageProvider === 's3' && (
              <>
                <Divider label={t('config.sections.s3')} labelPosition="left" />
                <TextInput
                  label={t('config.fields.endpoint')}
                  placeholder="https://s3.amazonaws.com"
                  value={configForm.storageS3Endpoint}
                  onChange={(e) => setField('storageS3Endpoint', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.region')}
                  placeholder="us-east-1"
                  value={configForm.storageS3Region}
                  onChange={(e) => setField('storageS3Region', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.bucket')}
                  value={configForm.storageS3Bucket}
                  onChange={(e) => setField('storageS3Bucket', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.accessKey')}
                  value={configForm.storageS3AccessKey}
                  onChange={(e) => setField('storageS3AccessKey', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.secretKey')}
                  value={configForm.storageS3SecretKey}
                  onChange={(e) => setField('storageS3SecretKey', e.target.value)}
                />
              </>
            )}

            {configForm.storageProvider === 'oss' && (
              <>
                <Divider label={t('config.sections.oss')} labelPosition="left" />
                <TextInput
                  label={t('config.fields.region')}
                  placeholder="oss-cn-hangzhou"
                  value={configForm.storageOssRegion}
                  onChange={(e) => setField('storageOssRegion', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.bucket')}
                  value={configForm.storageOssBucket}
                  onChange={(e) => setField('storageOssBucket', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.accessKeyId')}
                  value={configForm.storageOssAccessKeyId}
                  onChange={(e) => setField('storageOssAccessKeyId', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.accessKeySecret')}
                  value={configForm.storageOssAccessKeySecret}
                  onChange={(e) => setField('storageOssAccessKeySecret', e.target.value)}
                />
              </>
            )}

            {configForm.storageProvider === 'cos' && (
              <>
                <Divider label={t('config.sections.cos')} labelPosition="left" />
                <TextInput
                  label={t('config.fields.region')}
                  placeholder="ap-guangzhou"
                  value={configForm.storageCosRegion}
                  onChange={(e) => setField('storageCosRegion', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.bucket')}
                  placeholder="bucket-1234567890"
                  value={configForm.storageCosBucket}
                  onChange={(e) => setField('storageCosBucket', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.secretId')}
                  value={configForm.storageCosSecretId}
                  onChange={(e) => setField('storageCosSecretId', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.secretKey')}
                  value={configForm.storageCosSecretKey}
                  onChange={(e) => setField('storageCosSecretKey', e.target.value)}
                />
              </>
            )}

            {configForm.storageProvider === 'r2' && (
              <>
                <Divider label={t('config.sections.r2')} labelPosition="left" />
                <TextInput
                  label={t('config.fields.accountId')}
                  description={t('config.fields.accountIdDescription')}
                  value={configForm.storageR2AccountId}
                  onChange={(e) => setField('storageR2AccountId', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.bucket')}
                  value={configForm.storageR2Bucket}
                  onChange={(e) => setField('storageR2Bucket', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.accessKeyId')}
                  value={configForm.storageR2AccessKey}
                  onChange={(e) => setField('storageR2AccessKey', e.target.value)}
                />
                <TextInput
                  label={t('config.fields.secretKey')}
                  value={configForm.storageR2SecretKey}
                  onChange={(e) => setField('storageR2SecretKey', e.target.value)}
                />
              </>
            )}

            <Divider label={t('config.sections.general')} labelPosition="left" />
            <TextInput
              label={t('config.fields.attachmentBaseUrl')}
              description={t('config.fields.attachmentBaseUrlDescription')}
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
                  {t('buttons.testConnection')}
                </Button>
              )}
              <Button onClick={handleSaveConfig} loading={saving}>
                {tCommon('actions.save')}
              </Button>
            </Group>
          </Stack>
        )}
      </SafeDrawer>
    </Box>
  )
}
