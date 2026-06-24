'use client'

import { Badge, Center, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { pickDiffText } from './diff-content'
import RevisionDiffView from './RevisionDiffView'

/** 对比内容来源：按 revision id 拉取，或直接给定已就绪的对比文本 */
export type DiffSource =
  | { type: 'revision'; apiBase: string; id: number }
  | { type: 'text'; value: string }

/** 对比的一侧（含头部展示信息与内容来源） */
export interface DiffSide {
  /** 稳定标识：所指内容变化时必须随之变化，用于触发重新解析 */
  key: string
  /** 头部状态徽标；null 表示不显示 */
  badge: { label: string; color: string } | null
  /** 头部标题（可空） */
  title?: string
  /** 头部时间/说明（可空） */
  caption?: string
  source: DiffSource
}

interface Props {
  opened: boolean
  onClose: () => void
  /** 较旧版本（左侧） */
  older: DiffSide | null
  /** 较新版本（右侧） */
  newer: DiffSide | null
}

/** 加载状态绑定到所属的版本对 key，避免切换对比时残留上一对的内容 */
type LoadState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; left: string; right: string }
  | { status: 'error'; key: string }

/** 解析一侧的对比文本：text 源直接返回，revision 源按 id 拉取后挑选 */
async function resolveSource(source: DiffSource): Promise<string> {
  if (source.type === 'text') return source.value

  const res = await fetch(`${source.apiBase}/${source.id}`)
  const json = await res.json()
  // 区分「真正的空内容」与「接口失败」：失败时抛出，由上层进入错误态，
  // 而不是退化成空字符串伪装成一份「无差异」的对比
  if (!res.ok || !json.success) {
    throw new Error('FETCH_REVISION_FAILED')
  }
  return pickDiffText(json.data)
}

export default function RevisionDiffModal({ opened, onClose, older, newer }: Props) {
  const t = useTranslations('admin.revisionHistory')
  const [state, setState] = useState<LoadState | null>(null)

  // 用 ref 持有最新的 side：effect 仅以 key 为依赖触发重新解析，避免把每次 render
  // 都换新引用的 older/newer 放进依赖导致反复拉取
  const olderRef = useRef(older)
  const newerRef = useRef(newer)
  olderRef.current = older
  newerRef.current = newer

  const olderKey = older?.key
  const newerKey = newer?.key
  const currentKey =
    olderKey !== undefined && newerKey !== undefined ? `${olderKey}|${newerKey}` : null

  useEffect(() => {
    const o = olderRef.current
    const n = newerRef.current
    if (!opened || !o || !n) return

    const key = `${o.key}|${n.key}`
    let cancelled = false
    setState({ status: 'loading', key })

    Promise.all([resolveSource(o.source), resolveSource(n.source)])
      .then(([left, right]) => {
        if (!cancelled) setState({ status: 'ready', key, left, right })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', key })
      })

    return () => {
      cancelled = true
    }
  }, [opened, olderKey, newerKey])

  const renderHeader = (side: DiffSide | null, sideLabel: string) => (
    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
      <Badge size="xs" variant="outline" color="gray">
        {sideLabel}
      </Badge>
      {side?.badge && (
        <Badge size="xs" variant="light" color={side.badge.color}>
          {side.badge.label}
        </Badge>
      )}
      {side?.title && (
        <Text size="xs" fw={500} truncate style={{ flex: 1, minWidth: 0 }}>
          {side.title}
        </Text>
      )}
      {side?.caption && (
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {side.caption}
        </Text>
      )}
    </Group>
  )

  // 只采信「与当前版本对一致」的加载结果，杜绝切换对比时短暂渲染上一对的内容
  const current = state && state.key === currentKey ? state : null

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90vw"
      title={t('diffTitle')}
      padding="md"
      // 非全屏：宽高约为视口 90%，四周保留 Mantine 默认 5vw/5dvh 偏移以露出遮罩层；
      // content 固定高度后用 flex 让下方对比视图自适应撑满（90dvh 恰为其 max-height）
      styles={{
        content: { height: '90dvh', display: 'flex', flexDirection: 'column' },
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
