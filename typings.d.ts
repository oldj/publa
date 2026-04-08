/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

export interface IAccount {
  username: string
  email?: string
  isStaff?: boolean
}

export interface ICategory {
  id: number
  name: string
  count: number
}

export interface ITag {
  id: number
  name: string
  count: number
}

export interface IComment {
  id: number
  username: string
  url: string
  addTime: string
  html: string
  contentId: number
  parentId: number
  children: IComment[]
}

export interface IPost {
  id: number
  title: string
  html: string
  url: string
  slug?: string
  coverImage?: string
  pubTime?: string
  seoTitle?: string
  seoDescription?: string
  category: ICategory | null
  tags: ITag[]
  previous: {
    title: string
    url: string
  }
  next: {
    title: string
    url: string
  }
  comments: IComment[]
  canComment: boolean
  canShowComments: boolean
  related: { title: string; url: string }[]
}

export interface IItemPage<T> {
  page: number
  pageCount: number
  pageSize: number
  itemCount: number
  items: T[]
}
