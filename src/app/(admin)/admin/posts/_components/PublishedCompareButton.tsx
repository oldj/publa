'use client'

import { notify } from '@/lib/notify'
import { Button } from '@mantine/core'
import { IconGitCompare } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { pickDiffText, type DiffContentFields } from './diff-content'
import RevisionDiffModal, { type DiffSide } from './RevisionDiffModal'

interface PublishedRevisionMeta {
  id: number
  status: string
  updatedAt: string
  title: string
}

interface Props {
  /** 版本接口前缀，如 `/api/posts/123/revisions` */
  apiBase: string
  /** 取当前编辑器内容 */
  getCurrentContent: () => DiffContentFields
}

/**
 * 「对比当前内容与最近发布版」按钮：由发布面板在「已发布且有未发布改动」时渲染。
 * 点击后拉取最近一次正式发布版本，与当前编辑器内容做只读对比（左旧右新）。
 */
export default function PublishedCompareButton({ apiBase, getCurrentContent }: Props) {
  const t = useTranslations('admin.revisionHistory')
  const tCommon = useTranslations('common')
  const [opened, setOpened] = useState(false)
  const [pair, setPair] = useState<{ older: DiffSide; newer: DiffSide } | null>(null)
  const [loading, setLoading] = useState(false)
  // 每次点击自增，保证「当前内容」侧的 key 变化，触发对比视图按最新内容重新解析
  const seqRef = useRef(0)

  const handleOpen = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(apiBase)
      const json = await res.json()
      // 接口失败（鉴权失败、NOT_FOUND、5xx 等走统一错误 JSON）提示加载失败，
      // 不能与「确实没有已发布版本」混为一谈
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        notify({ color: 'red', message: t('diffLoadFailed') })
        return
      }
      const lastPublished: PublishedRevisionMeta | undefined = json.data.find(
        (r: PublishedRevisionMeta) => r.status === 'published',
      )
      if (!lastPublished) {
        // 成功取回列表但确实没有已发布版本
        notify({ color: 'red', message: t('diffNoPublished') })
        return
      }

      seqRef.current += 1
      setPair({
        older: {
          key: `rev:${lastPublished.id}`,
          badge: { label: t('published'), color: 'green' },
          title: lastPublished.title || undefined,
          caption: dayjs(lastPublished.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
          source: { type: 'revision', apiBase, id: lastPublished.id },
        },
        newer: {
          key: `current:${seqRef.current}`,
          badge: { label: t('diffCurrent'), color: 'orange' },
          source: { type: 'text', value: pickDiffText(getCurrentContent()) },
        },
      })
      setOpened(true)
    } catch {
      // 传输层异常（网络故障、非 JSON 响应等）：给出统一网络错误提示，
      // 与 PostEditor/PageEditor 其余 fetch handler 的处理保持一致
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="light"
        size="compact-xs"
        leftSection={<IconGitCompare size={14} />}
        onClick={handleOpen}
        loading={loading}
        // 在 Stack（align: stretch）中左对齐、按内容宽度，避免被拉伸成整行
        style={{ alignSelf: 'flex-start' }}
      >
        {t('compare')}
      </Button>
      <RevisionDiffModal
        opened={opened}
        onClose={() => setOpened(false)}
        older={pair?.older ?? null}
        newer={pair?.newer ?? null}
      />
    </>
  )
}
