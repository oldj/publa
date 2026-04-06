'use client'

import checkOutLinks from '@/app/posts/[...slug]/libs/checkOutLinks'
import CommentForm from '@/components/comment-form'
import dayjs from 'dayjs'
import React, { useEffect, useRef, useState } from 'react'
import { IComment } from 'typings'

interface ICommentProps {
  data: IComment
  refreshComments: () => void
}

export default function Comment(props: ICommentProps) {
  let { data, refreshComments } = props
  const [showReply, setShowReply] = useState(false)
  const refContent = useRef<HTMLDivElement>(null)

  const toggleReply = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    setShowReply(!showReply)
  }

  useEffect(() => {
    let el = refContent.current
    if (!el) {
      return
    }

    checkOutLinks(el)
  }, [data.id])

  return (
    <div className="post-comment">
      <div className="post-comment-username">
        {data.url ? (
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            {data.username}
          </a>
        ) : (
          data.username
        )}
      </div>
      <div className="post-detail-info">
        在 {dayjs(data.addTime).format('YYYY-MM-DD HH:mm')} 写道：
      </div>
      <div
        className="post-comment-content"
        ref={refContent}
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
      <div className="post-detail-info">
        <a href="" onClick={toggleReply}>
          {showReply ? '收起' : '回复'}
        </a>
      </div>

      {showReply ? (
        <div className="post-comment-reply-form">
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
        <div className="post-comment-children">
          {data.children.map((i) => (
            <Comment data={i} key={i.id} refreshComments={refreshComments} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
