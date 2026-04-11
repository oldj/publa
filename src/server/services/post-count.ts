import { db } from '@/server/db'
import { categories, contents, contentTags, tags } from '@/server/db/schema'
import { and, count, eq, isNull } from 'drizzle-orm'

type DbOrTx = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

/**
 * 全量重算所有分类和标签的 postCount。
 * 只计算 type='post' 且 status='published' 且未软删除的文章。
 * 对博客级数据规模（分类十几、标签几百）为毫秒级开销。
 */
export async function recountCategoriesAndTags(tx: DbOrTx = db) {
  // 分类：把所有分类计数置 0，再按已发布文章重新聚合回写
  await tx.update(categories).set({ postCount: 0 })

  const categoryRows = await tx
    .select({
      categoryId: contents.categoryId,
      cnt: count(),
    })
    .from(contents)
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        isNull(contents.deletedAt),
      ),
    )
    .groupBy(contents.categoryId)

  for (const row of categoryRows) {
    if (row.categoryId == null) continue
    await tx
      .update(categories)
      .set({ postCount: row.cnt })
      .where(eq(categories.id, row.categoryId))
  }

  // 标签：同理置 0 后按 content_tags join 统计
  await tx.update(tags).set({ postCount: 0 })

  const tagRows = await tx
    .select({
      tagId: contentTags.tagId,
      cnt: count(),
    })
    .from(contentTags)
    .innerJoin(contents, eq(contents.id, contentTags.contentId))
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        isNull(contents.deletedAt),
      ),
    )
    .groupBy(contentTags.tagId)

  for (const row of tagRows) {
    await tx
      .update(tags)
      .set({ postCount: row.cnt })
      .where(eq(tags.id, row.tagId))
  }
}
