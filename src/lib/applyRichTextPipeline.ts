import wrapBlockImages from './wrapBlockImages'
import wrapBlockMath from './wrapBlockMath'
import wrapBlockTables from './wrapBlockTables'

/** 富文本服务端处理流水线：图片包裹 → 表格包裹 → 公式渲染 */
export default function applyRichTextPipeline(html: string): string {
  return wrapBlockMath(wrapBlockTables(wrapBlockImages(html)))
}
