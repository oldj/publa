'use client'

import { Badge, Center, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { formatHtmlForDiff } from './format-html'
import RevisionDiffView from './RevisionDiffView'

/** 对比所需的版本元信息（来自历史列表，不含内容） */
export interface DiffRevisionMeta {
  id: number
  title: string
  status: string
  updatedAt: string
}

interface Props {
  opened: boolean
  onClose: () => void
  /** 版本内容接口前缀，如 `/api/posts/123/revisions` */
  apiBase: string
  /** 较旧版本（左侧） */
  older: DiffRevisionMeta | null
  /** 较新版本（右侧） */
  newer: DiffRevisionMeta | null
}

/** 加载状态，绑定到所属的版本对 key，避免切换对比时残留上一对的内容 */
type LoadState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; left: string; right: string }
  | { status: 'error'; key: string }

export default function RevisionDiffModal({ opened, onClose, apiBase, older, newer }: Props) {
  const t = useTranslations('admin.revisionHistory')
  const [state, setState] = useState<LoadState | null>(null)

  const olderId = older?.id
  const newerId = newer?.id
  const currentKey = olderId !== undefined && newerId !== undefined ? `${olderId}-${newerId}` : null

  useEffect(() => {
    if (!opened || olderId === undefined || newerId === undefined) return

    const key = `${olderId}-${newerId}`
    let cancelled = false
    setState({ status: 'loading', key })

    // 取「用户真正编辑的内容」做对比：
    // - 富文本：渲染后的 HTML 源码（单行，需格式化拆行便于逐行 diff）
    // - markdown / html 源码模式：直接用编辑原文 contentRaw（本就多行，保持原样）
    const fetchDiffText = async (id: number): Promise<string> => {
      const res = await fetch(`${apiBase}/${id}`)
      const json = await res.json()
      // 区分「真正的空内容」与「接口失败」：失败时抛出，由上层进入错误态，
      // 而不是退化成空字符串伪装成一份「无差异」的对比
      if (!res.ok || !json.success) {
        throw new Error('FETCH_REVISION_FAILED')
      }
      const { contentType, contentRaw, contentHtml } = json.data
      return contentType === 'markdown' || contentType === 'html'
        ? (contentRaw ?? '')
        : formatHtmlForDiff(contentHtml ?? '')
    }

    Promise.all([fetchDiffText(olderId), fetchDiffText(newerId)])
      .then(([left, right]) => {
        if (!cancelled) setState({ status: 'ready', key, left, right })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', key })
      })

    return () => {
      cancelled = true
    }
  }, [opened, apiBase, olderId, newerId])

  const renderHeader = (rev: DiffRevisionMeta | null, sideLabel: string) => (
    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
      <Badge size="xs" variant="outline" color="gray">
        {sideLabel}
      </Badge>
      {rev && (
        <>
          <Badge size="xs" variant="light" color={rev.status === 'published' ? 'green' : 'blue'}>
            {rev.status === 'published' ? t('published') : t('draftSnapshot')}
          </Badge>
          {rev.title && (
            <Text size="xs" fw={500} truncate style={{ flex: 1, minWidth: 0 }}>
              {rev.title}
            </Text>
          )}
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {dayjs(rev.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        </>
      )}
    </Group>
  )

  // 只采信「与当前版本对一致」的加载结果，杜绝切换对比时短暂渲染上一对的内容
  const current = state && state.key === currentKey ? state : null

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      title={t('diffTitle')}
      padding="md"
      // 让 body 撑满全屏内容区，下方对比视图用 flex 自适应高度，避免硬编码高度
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
        {/* 左右版本信息头部，与下方双栏对应 */}
        <Group gap="sm" align="center" wrap="nowrap">
          {renderHeader(older, t('diffOlder'))}
          {renderHeader(newer, t('diffNewer'))}
        </Group>

        {current?.status === 'error' ? (
          <Center h="40vh">
            <Text size="sm" c="dimmed">
              {t('diffLoadFailed')}
            </Text>
          </Center>
        ) : current?.status === 'ready' ? (
          <RevisionDiffView
            key={current.key}
            leftValue={current.left}
            rightValue={current.right}
            leftLabel={t('diffOlder')}
            rightLabel={t('diffNewer')}
          />
        ) : (
          <Center h="40vh">
            <Loader />
          </Center>
        )}
      </Stack>
    </Modal>
  )
}
