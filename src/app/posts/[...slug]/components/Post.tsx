'use client'

import checkOutLinks from '@/app/posts/[...slug]/libs/checkOutLinks'
import { AdPostFooter } from '@/components/ads'
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
import { IAccount, IPost, ICategory, ITag, IComment } from 'typings'
import styles from '../post.module.scss'
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
}

export default function Post(props: IProps) {
  const { account, post, html, headers } = props
  const router = useRouter()
  const [comments, setComments] = useState<IComment[]>(post?.comments || [])
  // const [html, setHTML] = useState<string>('')
  // const [headers, setHeaders] = useState<IHeader[]>([])
  const [show_back_to_top, setShowBackToTop] = useState<boolean>(false)
  const [show_toc2, setShowToc2] = useState<boolean>(false)
  const ref_content = useRef<HTMLDivElement>(null)
  const ref_toc1 = useRef<HTMLDivElement>(null)
  const ref_toc2 = useRef<HTMLDivElement>(null)

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
    const el = ref_content.current
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
    const el = ref_content.current
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
  }, [html, show_back_to_top, show_toc2])

  useEffect(() => {
    document.querySelectorAll(`.${styles.content} table`).forEach((tb) => {
      const el = document.createElement('div')
      el.className = styles.table_wrapper
      tb.parentNode?.insertBefore(el, tb)
      el.appendChild(tb)
    })

    document.querySelectorAll(`.${styles.content} img`).forEach((img) => {
      const parent: HTMLElement = img.parentNode as HTMLElement
      if (!parent) return

      if (
        parent.tagName.toLowerCase() === 'center' ||
        (parent.className && parent.className.indexOf(styles.content) >= 0)
      ) {
        const p = document.createElement('p')
        parent.insertBefore(p, img)
        p.className = styles.p_img
        p.appendChild(img)
      }
    })
  }, [post.id])

  useEffect(() => {
    const onScroll = () => {
      const scroll_top = document.documentElement.scrollTop || document.body.scrollTop
      setShowBackToTop(scroll_top > 300)

      const toc1 = ref_toc1.current
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
    <div className={styles.root}>
      <h1 className={styles.post_title}>{post.title}</h1>
      <div className={clsx(styles.post_pub_date, styles.info)}>
        {dayjs(post.pubTime).format('YYYY-MM-DD')}
      </div>
      <TOC headers={headers || []} ref={ref_toc1} />
      <div
        className={`${styles.content} post-content`}
        ref={ref_content}
        dangerouslySetInnerHTML={{ __html: html || '' }}
      />
      {/*<div className={styles.post_copyright}>*/}
      {/*  <a rel="license" href="https://creativecommons.org/licenses/by-nc/4.0/">*/}
      {/*    <img alt="知识共享许可协议" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png"/>*/}
      {/*  </a>*/}
      {/*  <br/>*/}
      {/*  本作品采用<a rel="license" href="https://creativecommons.org/licenses/by-nc/4.0/">知识共享署名-非商业性使用 4.0 国际许可协议</a>进行许可。*/}
      {/*</div>*/}

      <AdPostFooter />

      <div className={styles.post_props}>
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

      <div className={styles.neighbors}>
        <div
          className={clsx(styles.prev, !post?.previous && styles.disabled)}
          onClick={async () => {
            if (!post?.previous) return
            router.push(post.previous.url)
          }}
        >
          <span className={styles.label}>前一篇</span>
          {post.previous ? (
            <Link href={post.previous.url}>{post.previous.title}</Link>
          ) : (
            '无'
          )}
        </div>
        <div
          className={clsx(styles.next, !post?.next && styles.disabled)}
          onClick={async () => {
            if (!post?.next) return
            router.push(post.next.url)
          }}
        >
          <span className={styles.label}>后一篇</span>
          {post.next ? <Link href={post.next.url}>{post.next.title}</Link> : '无'}
        </div>
      </div>

      <div className={styles.related}>
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
          <div className={styles.norecords}>暂无相关文章</div>
        )}
      </div>

      <div className={styles.comments}>
        <h2>评论：</h2>
        {comments.length === 0 ? (
          <div className={styles.norecords}>暂无评论</div>
        ) : (
          comments.map((i) => <Comment data={i} key={i.id} refreshComments={refreshComments} />)
        )}
      </div>

      {post.canComment ? (
        <div className={styles.comment_form}>
          <h2>发表评论：</h2>
          <div className={styles.info}>电子邮件地址不会被公开。必填项已用 * 标注。</div>

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
        <div className={styles.comment_closed}>评论已关闭。</div>
      )}

      {show_toc2 && (
        <div className={styles.toc2_wrapper}>
          <TOC
            headers={headers || []}
            ref={ref_toc2}
            className={clsx(styles.toc2, 'animate__animated animate__fadeIn')}
          />
        </div>
      )}

      {show_back_to_top && (
        <div className={styles.back_to_top_wrapper}>
          <button
            title={'回到顶部'}
            className={clsx(styles.back_to_top, 'animate__animated animate__fadeIn')}
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
