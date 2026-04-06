'use client'

import checkOutLinks from '@/app/posts/[...slug]/libs/checkOutLinks'
import CommentForm from '@/components/comment-form'
import PageLoading from '@/components/page-loading'
import TOC from '@/components/toc'
import { codeHighlightAliases, codeHighlightLanguages } from '@/lib/code-highlight'
import { IHeader } from '@/lib/getHeadersFromHTML'
import Spacer from '@/widgets/Spacer'
import clsx from 'clsx'
import dayjs from 'dayjs'
import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/github.css'
import katex from 'katex'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { IoChevronUp } from 'react-icons/io5'
import { IAccount, ICategory, IComment, IPost, ITag } from 'typings'
import Comment from './Comment'

for (const [name, language] of Object.entries(codeHighlightLanguages)) {
  hljs.registerLanguage(name, language)
}

for (const [languageName, aliasList] of Object.entries(codeHighlightAliases)) {
  hljs.registerAliases(aliasList, { languageName })
}

interface IProps {
  categories?: ICategory[]
  tags?: ITag[]
  post?: IPost
  account?: IAccount
  html?: string
  headers?: IHeader[]
  afterPostHtml?: string
}

export default function Post(props: IProps) {
  const { account, post, html, headers, afterPostHtml } = props
  const router = useRouter()
  const [comments, setComments] = useState<IComment[]>(post?.comments || [])
  // const [html, setHTML] = useState<string>('')
  // const [headers, setHeaders] = useState<IHeader[]>([])
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false)
  const [showToc2, setShowToc2] = useState<boolean>(false)
  const refContent = useRef<HTMLDivElement>(null)
  const refToc1 = useRef<HTMLDivElement>(null)
  const refToc2 = useRef<HTMLDivElement>(null)

  if (!post) {
    return <PageLoading />
  }

  useEffect(() => {
    setComments(post?.comments || [])
  }, [post.id])

  // useEffect(() => {
  //   let { html, headers } = getHeadersFromHTML(post?.html || '')
  //   setHTML(html)
  //   setHeaders(headers)
  // }, [post.html])

  useEffect(() => {
    const el = refContent.current
    if (!el) {
      return
    }

    checkOutLinks(el)
  }, [post.id])

  useEffect(() => {
    // 先清除所有已高亮的元素
    document.querySelectorAll('pre code').forEach((block) => {
      block.removeAttribute('data-highlighted')
    })
    hljs.highlightAll()

    // 渲染 Tiptap 数学公式节点（data-latex 属性）
    const el = refContent.current
    if (el) {
      el.querySelectorAll<HTMLElement>(
        '[data-type="inline-math"], [data-type="block-math"]',
      ).forEach((node) => {
        const latex = node.getAttribute('data-latex')
        if (!latex || node.hasAttribute('data-math-rendered')) return
        try {
          katex.render(latex, node, {
            displayMode: node.getAttribute('data-type') === 'block-math',
            throwOnError: false,
          })
          node.setAttribute('data-math-rendered', 'true')
        } catch (e) {
          console.error('KaTeX render error:', e)
        }
      })
    }

    // 渲染 $...$ 分隔符格式的公式（兼容 Markdown 内容）
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
    })
  }, [html, showBackToTop, showToc2])

  useEffect(() => {
    document.querySelectorAll('.post-detail-content table').forEach((tb) => {
      const el = document.createElement('div')
      el.className = 'post-detail-table-wrapper'
      tb.parentNode?.insertBefore(el, tb)
      el.appendChild(tb)
    })

    document.querySelectorAll('.post-detail-content img').forEach((img) => {
      const parent: HTMLElement = img.parentNode as HTMLElement
      if (!parent) return

      if (
        parent.tagName.toLowerCase() === 'center' ||
        (parent.className && parent.className.indexOf('post-detail-content') >= 0)
      ) {
        const p = document.createElement('p')
        parent.insertBefore(p, img)
        p.className = 'post-detail-img'
        p.appendChild(img)
      }
    })
  }, [post.id])

  useEffect(() => {
    const onScroll = () => {
      const scroll_top = document.documentElement.scrollTop || document.body.scrollTop
      setShowBackToTop(scroll_top > 300)

      const toc1 = refToc1.current
      if (!toc1) return

      const rect = toc1.getBoundingClientRect()
      setShowToc2(rect.bottom < 0)
    }

    window.addEventListener('scroll', onScroll, false)

    return () => {
      window.removeEventListener('scroll', onScroll, false)
    }
  }, [])

  const refreshComments = async () => {
    if (!post?.slug) return
    const res = await fetch('/api/comments?slug=' + encodeURIComponent(post.slug))
    const d = await res.json()
    if (d && d.success) {
      setComments(d.data)
    }
  }

  return (
    <div className="post-detail">
      <h1 className="post-detail-title">{post.title}</h1>
      <div className="post-detail-date post-detail-info">
        {dayjs(post.pubTime).format('YYYY-MM-DD')}
      </div>
      <TOC headers={headers || []} ref={refToc1} />
      <div
        className="post-detail-content post-content"
        ref={refContent}
        dangerouslySetInnerHTML={{ __html: html || '' }}
      />

      {afterPostHtml && (
        <div className="post-after-content" dangerouslySetInnerHTML={{ __html: afterPostHtml }} />
      )}

      <div className="post-detail-props">
        {post.category && (
          <span>
            <strong>分类：</strong>
            <Link href={`/posts/list?category=${encodeURIComponent(post.category.name)}`}>
              {post.category.name}
            </Link>
          </span>
        )}

        <span>
          <strong>标签：</strong>
          {post.tags.map((t) => (
            <Link key={t.id} href={`/posts/list?tag=${encodeURIComponent(t.name)}`}>
              {t.name}
            </Link>
          ))}
        </span>

        <Spacer />

        {account?.isStaff && (
          <span>
            <Link href={`/admin/posts/${post.id}`} target={'_blank'}>
              [文章管理]
            </Link>
          </span>
        )}
      </div>

      <div className="post-detail-neighbors">
        <div
          className={clsx('post-detail-prev', !post?.previous && 'is-disabled')}
          onClick={async () => {
            if (!post?.previous) return
            router.push(post.previous.url)
          }}
        >
          <span className="post-detail-label">前一篇</span>
          {post.previous ? <Link href={post.previous.url}>{post.previous.title}</Link> : '无'}
        </div>
        <div
          className={clsx('post-detail-next', !post?.next && 'is-disabled')}
          onClick={async () => {
            if (!post?.next) return
            router.push(post.next.url)
          }}
        >
          <span className="post-detail-label">后一篇</span>
          {post.next ? <Link href={post.next.url}>{post.next.title}</Link> : '无'}
        </div>
      </div>

      <div className="post-detail-related">
        <h2>相关文章：</h2>
        {post.related.length > 0 ? (
          <ul>
            {post.related.map((i, idx) => (
              <li key={idx}>
                <Link href={i.url}>{i.title}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="post-detail-no-records">暂无相关文章</div>
        )}
      </div>

      <div className="post-comments">
        <h2>评论：</h2>
        {comments.length === 0 ? (
          <div className="post-detail-no-records">暂无评论</div>
        ) : (
          comments.map((i) => <Comment data={i} key={i.id} refreshComments={refreshComments} />)
        )}
      </div>

      {post.canComment ? (
        <div className="post-comment-form">
          <h2>发表评论：</h2>
          <div className="post-detail-info">电子邮件地址不会被公开。必填项已用 * 标注。</div>

          <CommentForm
            contentId={post.id}
            parentId={0}
            onSuccess={(d) => {
              if (d && d.status === 'approved') {
                refreshComments().catch((e) => console.error(e))
              }
            }}
          />
        </div>
      ) : (
        <div className="post-comment-closed">评论已关闭。</div>
      )}

      {showToc2 && (
        <div className="post-detail-toc-wrapper">
          <TOC
            headers={headers || []}
            ref={refToc2}
            className={clsx('post-detail-toc', 'animate__animated animate__fadeIn')}
          />
        </div>
      )}

      {showBackToTop && (
        <div className="back-to-top-wrapper">
          <button
            title={'回到顶部'}
            className={clsx('back-to-top', 'animate__animated animate__fadeIn')}
            onClick={() => {
              window.scrollTo(0, 0)
            }}
          >
            <IoChevronUp />
          </button>
        </div>
      )}
    </div>
  )
}
