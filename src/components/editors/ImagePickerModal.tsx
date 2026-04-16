'use client'

import { notify } from '@/lib/notify'
import { Button, Group, Loader, Modal, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import styles from './ImagePickerModal.module.scss'

const MAX_SELECTION = 9

interface ImageItem {
  id: number
  publicUrl: string
  originalFilename: string
  mimeType: string
  width: number | null
  height: number | null
}

interface ImagePickerModalProps {
  opened: boolean
  onClose: () => void
  onInsert: (urls: string[]) => void
}

// 定义在组件外部，避免重渲染导致 VirtuosoGrid 重新挂载
const gridComponents = {
  List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ style, children, ...props }, ref) => (
      <div
        ref={ref}
        {...props}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          ...style,
        }}
      >
        {children}
      </div>
    ),
  ),
  Item: ({
    children,
    ...props
  }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div
      {...props}
      style={{
        padding: '0.375rem',
        width: '25%',
        display: 'flex',
        flex: 'none',
        alignContent: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  ),
}

export default function ImagePickerModal({ opened, onClose, onInsert }: ImagePickerModalProps) {
  const t = useTranslations('admin.editor.imagePickerModal')
  const tCommon = useTranslations('common')

  const [images, setImages] = useState<ImageItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [selected, setSelected] = useState<Map<number, string>>(new Map())
  const [uploading, setUploading] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 用 ref 作为加载守卫和页码追踪，避免闭包捕获过期状态
  const loadingRef = useRef(false)
  const pageRef = useRef(1)

  // 加载指定页的图片
  const loadPage = useCallback(async (targetPage: number) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await fetch(`/api/attachments?page=${targetPage}&mimeType=image/`)
      const json = await res.json()
      if (json.success) {
        const newItems: ImageItem[] = json.data.items.map((item: any) => ({
          id: item.id,
          publicUrl: item.publicUrl,
          originalFilename: item.originalFilename,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
        }))
        setImages((prev) => {
          // 按 id 去重，防止上传后再加载出现重复
          const existingIds = new Set(prev.map((i) => i.id))
          const unique = newItems.filter((i) => !existingIds.has(i.id))
          return [...prev, ...unique]
        })
        pageRef.current = json.data.page
        setHasMore(json.data.page < json.data.pageCount)
      }
    } finally {
      loadingRef.current = false
    }
  }, [])

  // Modal 打开时重置状态并加载第一页
  useEffect(() => {
    if (opened) {
      setImages([])
      pageRef.current = 1
      setHasMore(true)
      setSelected(new Map())
      setUploading(0)
      loadingRef.current = false
      loadPage(1)
    }
  }, [opened, loadPage])

  // 滚动到底部加载更多
  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingRef.current) {
      loadPage(pageRef.current + 1)
    }
  }, [hasMore, loadPage])

  // 切换选中状态
  const toggleSelect = useCallback(
    (image: ImageItem) => {
      setSelected((prev) => {
        const next = new Map(prev)
        if (next.has(image.id)) {
          next.delete(image.id)
        } else {
          if (next.size >= MAX_SELECTION) {
            notify({
              message: t('maxSelection', { max: MAX_SELECTION }),
              color: 'orange',
            })
            return prev
          }
          next.set(image.id, image.publicUrl)
        }
        return next
      })
    },
    [t],
  )

  // 上传文件
  const handleUpload = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files)
      setUploading((prev) => prev + fileArray.length)

      await Promise.allSettled(
        fileArray.map(async (file) => {
          try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch('/api/attachments', { method: 'POST', body: formData })
            const json = await res.json()
            if (!json.success) throw new Error(json.message || 'Upload failed')

            const newImage: ImageItem = {
              id: json.data.id,
              publicUrl: json.data.publicUrl,
              originalFilename: json.data.originalFilename,
              mimeType: json.data.mimeType,
              width: json.data.width,
              height: json.data.height,
            }

            // 添加到列表开头
            setImages((prev) => [newImage, ...prev])

            // 自动选中（不超过上限）
            setSelected((prev) => {
              if (prev.size >= MAX_SELECTION) return prev
              const next = new Map(prev)
              next.set(newImage.id, newImage.publicUrl)
              return next
            })
          } catch (err: any) {
            notify({
              message: t('uploadFailed', { message: err.message }),
              color: 'red',
            })
          } finally {
            setUploading((prev) => prev - 1)
          }
        }),
      )
    },
    [t],
  )

  // 点击上传按钮
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // 文件选择回调
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleUpload(files)
      }
      // 重置 input，允许重复选择同一文件
      e.target.value = ''
    },
    [handleUpload],
  )

  // 插入选中图片
  const handleInsert = useCallback(() => {
    const urls = Array.from(selected.values())
    onInsert(urls)
    onClose()
  }, [selected, onInsert, onClose])

  // 获取选中编号（1-9）
  const getSelectionIndex = useCallback(
    (id: number): number => {
      const keys = Array.from(selected.keys())
      const idx = keys.indexOf(id)
      return idx >= 0 ? idx + 1 : 0
    },
    [selected],
  )

  // 渲染 grid 项
  const renderItem = useCallback(
    (index: number) => {
      // 第一项：上传按钮
      if (index === 0) {
        return (
          <div className={styles.uploadTile} onClick={handleUploadClick}>
            {uploading > 0 ? <Loader size={24} /> : <IconPlus size={32} />}
          </div>
        )
      }

      // 图片项
      const image = images[index - 1]
      if (!image) return null

      const selIdx = getSelectionIndex(image.id)
      const isSelected = selIdx > 0

      return (
        <div
          className={`${styles.tile} ${isSelected ? styles.selected : ''}`}
          onClick={() => toggleSelect(image)}
        >
          <img src={image.publicUrl} alt={image.originalFilename} loading="lazy" />
          {isSelected && <div className={styles.badge}>{selIdx}</div>}
        </div>
      )
    },
    [images, uploading, handleUploadClick, getSelectionIndex, toggleSelect],
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Modal opened={opened} onClose={onClose} size="xl" title={t('title')} centered>
        <VirtuosoGrid
          className={styles.grid}
          style={{ height: 420 }}
          totalCount={images.length + 1}
          components={gridComponents}
          itemContent={renderItem}
          endReached={handleEndReached}
          increaseViewportBy={200}
        />

        <div className={styles.footer}>
          <Text size="sm" c="dimmed">
            {t('selectedCount', { count: selected.size, max: MAX_SELECTION })}
          </Text>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleInsert} disabled={selected.size === 0}>
              {t('insert')}
            </Button>
          </Group>
        </div>
      </Modal>
    </>
  )
}
