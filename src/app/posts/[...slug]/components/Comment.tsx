'use client'

import checkOutLinks from '@/app/posts/[...slug]/libs/checkOutLinks'
import CommentForm from '@/components/comment-form'
import dayjs from 'dayjs'
import React, { useEffect, useRef, useState } from 'react'
import { IComment } from 'typings'
import styles from '../post.module.scss'

interface ICommentProps {
  data: IComment
  refreshComments: () => void
}

export default function Comment(props: ICommentProps) {
  let { data, refreshComments } = props
  const [show_reply, setShowReply] = useState(false)
  const ref_content = useRef<HTMLDivElement>(null)

  const toggleReply = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    setShowReply(!show_reply)
  }

  useEffect(() => {
    let el = ref_content.current
    if (!el) {
      return
    }

    checkOutLinks(el)
  }, [data.id])

  return (
    <div className={styles.comment}>
      <div className={styles.username}>
        {data.url ? (
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            {data.username}
          </a>
        ) : (
          data.username
        )}
      </div>
      <div className={styles.info}>在 {dayjs(data.addTime).format('YYYY-MM-DD HH:mm')} 写道：</div>
      <div
        className={styles.comment_content}
        ref={ref_content}
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
      <div className={styles.info}>
        <a href="" onClick={toggleReply}>
          {show_reply ? '收起' : '回复'}
        </a>
      </div>

      {show_reply ? (
        <div className={styles.comment_reply_form}>
          <CommentForm
            contentId={data.contentId}
            parentId={data.id}
            onSuccess={(d) => {
              toggleReply()

              if (d && d.status === 'approved') {
                refreshComments()
              }
            }}
          />
        </div>
      ) : null}

      {data.children && data.children.length > 0 ? (
        <div className={styles.children}>
          {data.children.map((i) => (
            <Comment data={i} key={i.id} refreshComments={refreshComments} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
