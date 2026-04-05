# 数据导入导出格式说明 (v2.0)

系统支持两种数据包：**内容数据** 和 **设置数据**，均为 JSON 格式。

---

## 一、接口概览

### 权限要求

- 以下接口均要求当前用户角色为 `owner` 或 `admin`
- 未登录或权限不足时，返回认证模块的标准 `401` / `403` JSON 响应

### `GET /api/import-export`

导出数据，返回 **JSON 附件文件**，不是 `{ success, data }` 包裹结构。

#### 查询参数

| 参数 | 类型   | 必填 | 说明                                                         |
| ---- | ------ | ---- | ------------------------------------------------------------ |
| type | string | 否   | 当值为 `settings` 时导出设置数据；缺省或其他值均导出内容数据 |

#### 返回行为

- `type=settings` 时返回设置数据，下载文件名形如 `blog-settings-2026-04-04-120000.json`
- 其他情况返回内容数据，下载文件名形如 `blog-content-2026-04-04-120000.json`
- `Content-Type` 为 `application/json`

### `POST /api/import-export`

导入数据，请求体为 JSON。当前仅支持**覆盖导入**。

#### 成功响应

```json
{
  "success": true,
  "data": {
    "results": ["分类: 2 条", "内容: 10 条"]
  }
}
```

`results` 为导入摘要数组，元素内容会随本次实际导入的数据类型变化。

#### 失败响应

| HTTP 状态码 | code               | 说明                                                |
| ----------- | ------------------ | --------------------------------------------------- |
| `400`       | `INVALID_FORMAT`   | 请求体不是合法 JSON                                 |
| `400`       | `VALIDATION_ERROR` | 数据包缺少必要字段、版本不支持，或 `meta.type` 非法 |
| `400`       | `IMPORT_FAILED`    | 导入过程中出现业务或数据约束错误                    |

### `GET /api/import-export/format`

读取当前文档源文件，并返回 Markdown 原文与渲染后的 HTML。

---

## 二、数据包通用规则

- 顶层必须包含 `meta.type` 和 `meta.version`
- 当前仅支持 `meta.version = "2.0"`
- `meta.type = "content"` 时，格式校验强制要求 `categories`、`tags`、`contents` 为数组
- `meta.type = "settings"` 时，格式校验强制要求 `settings` 为数组
- 其余数组字段可选；覆盖导入时，缺失的可选数组对应的表数据会被清空
- 全量导出所有记录（包含软删除记录），`deletedAt` 字段保留以还原完整状态

---

## 三、内容数据

包含文章、页面、分类、标签、历史记录、评论、留言、附件记录等内容相关数据。

```json
{
  "meta": {
    "type": "content",
    "version": "2.0",
    "exportedAt": "2026-01-01T00:00:00.000Z"
  },
  "categories": [],
  "tags": [],
  "contents": [],
  "contentTags": [],
  "contentRevisions": [],
  "slugHistories": [],
  "comments": [],
  "guestbookMessages": [],
  "attachments": []
}
```

### meta

| 字段       | 类型   | 必填 | 说明                         |
| ---------- | ------ | ---- | ---------------------------- |
| type       | string | 是   | 固定值 `"content"`           |
| version    | string | 是   | 数据格式版本，当前为 `"2.0"` |
| exportedAt | string | 是   | 导出时间，ISO 8601 格式      |

### categories（分类）

| 字段           | 类型   | 必填 | 说明                               |
| -------------- | ------ | ---- | ---------------------------------- |
| id             | number | 是   | 分类 ID                            |
| name           | string | 是   | 分类名称                           |
| slug           | string | 是   | URL 标识（唯一）                   |
| description    | string | 否   | 分类描述                           |
| sortOrder      | number | 否   | 排序序号，默认 `0`，数字越小越靠前 |
| seoTitle       | string | 否   | SEO 标题                           |
| seoDescription | string | 否   | SEO 描述                           |

### tags（标签）

| 字段           | 类型   | 必填 | 说明             |
| -------------- | ------ | ---- | ---------------- |
| id             | number | 是   | 标签 ID          |
| name           | string | 是   | 标签名称         |
| slug           | string | 是   | URL 标识（唯一） |
| seoTitle       | string | 否   | SEO 标题         |
| seoDescription | string | 否   | SEO 描述         |

### contents（内容：文章+页面）

全量导出 `contents` 表中所有记录（包含软删除），通过 `type` 字段区分文章和页面。

| 字段           | 类型    | 必填 | 说明                                                      |
| -------------- | ------- | ---- | --------------------------------------------------------- |
| id             | number  | 是   | 内容 ID                                                   |
| type           | string  | 是   | 内容类型：`post`（文章）、`page`（页面）                  |
| title          | string  | 是   | 标题                                                      |
| slug           | string  | 否   | URL 标识（唯一，文章使用）                                |
| path           | string  | 否   | URL 路径（唯一，页面使用）                                |
| authorId       | number  | 否   | 作者用户 ID；缺失或引用不存在用户时，回填为当前导入用户   |
| contentType    | string  | 否   | 内容类型：`richtext`、`markdown`、`html`，默认 `richtext` |
| contentRaw     | string  | 是   | 原始内容                                                  |
| contentHtml    | string  | 是   | 渲染后的 HTML                                             |
| contentText    | string  | 否   | 纯文本内容；缺失时自动从 contentHtml 或 contentRaw 推导   |
| excerpt        | string  | 否   | 手动摘要                                                  |
| excerptAuto    | string  | 否   | 自动摘要                                                  |
| status         | string  | 是   | 状态：`draft`、`scheduled`、`published`                   |
| categoryId     | number  | 否   | 所属分类 ID                                               |
| coverImageId   | number  | 否   | 封面图片附件 ID                                           |
| allowComment   | boolean | 否   | 是否允许评论，默认 `true`                                 |
| showComments   | boolean | 否   | 是否显示评论，默认 `true`                                 |
| viewCount      | number  | 否   | 浏览量，默认 `0`                                          |
| pinned         | boolean | 否   | 是否置顶，默认 `false`                                    |
| template       | string  | 否   | 模板：`default`、`blank`（页面使用）                      |
| seoTitle       | string  | 否   | SEO 标题                                                  |
| seoDescription | string  | 否   | SEO 描述                                                  |
| canonicalUrl   | string  | 否   | 规范链接                                                  |
| createdAt      | string  | 是   | 创建时间                                                  |
| updatedAt      | string  | 否   | 更新时间                                                  |
| publishedAt    | string  | 否   | 发布时间                                                  |
| deletedAt      | string  | 否   | 软删除时间；未删除时为 `null`                             |

### contentTags（内容-标签关联）

| 字段      | 类型   | 必填 | 说明    |
| --------- | ------ | ---- | ------- |
| contentId | number | 是   | 内容 ID |
| tagId     | number | 是   | 标签 ID |

### contentRevisions（历史记录）

| 字段        | 类型   | 必填 | 说明                                                    |
| ----------- | ------ | ---- | ------------------------------------------------------- |
| id          | number | 是   | 历史记录 ID                                             |
| targetType  | string | 是   | 目标类型：`post`、`page`                                |
| targetId    | number | 是   | 目标内容 ID                                             |
| title       | string | 否   | 标题                                                    |
| excerpt     | string | 否   | 摘要                                                    |
| contentType | string | 否   | 内容类型：`richtext`、`markdown`、`html`                |
| contentRaw  | string | 否   | 原始内容                                                |
| contentHtml | string | 否   | 渲染后的 HTML                                           |
| contentText | string | 否   | 纯文本内容                                              |
| status      | string | 否   | 状态：`draft`、`published`                              |
| createdAt   | string | 是   | 创建时间                                                |
| updatedAt   | string | 否   | 更新时间                                                |
| createdBy   | number | 是   | 创建者用户 ID；引用不存在用户时，回填为当前导入用户     |

### slugHistories（Slug 变更历史）

| 字段      | 类型   | 必填 | 说明    |
| --------- | ------ | ---- | ------- |
| id        | number | 是   | 记录 ID |
| contentId | number | 是   | 内容 ID |
| slug      | string | 是   | 旧 slug |
| createdAt | string | 是   | 创建时间|

### comments（评论）

| 字段          | 类型   | 必填 | 说明                                    |
| ------------- | ------ | ---- | --------------------------------------- |
| id            | number | 是   | 评论 ID                                 |
| contentId     | number | 是   | 所属内容 ID                             |
| parentId      | number | 否   | 父评论 ID（嵌套回复）                   |
| userId        | number | 否   | 登录用户 ID                             |
| authorName    | string | 是   | 评论者名称                              |
| authorEmail   | string | 否   | 评论者邮箱                              |
| authorWebsite | string | 否   | 评论者网站                              |
| content       | string | 是   | 评论内容                                |
| ipAddress     | string | 否   | IP 地址                                 |
| userAgent     | string | 否   | 浏览器 UA                               |
| status        | string | 是   | 状态：`pending`、`approved`、`rejected` |
| moderatedBy   | number | 否   | 审核人用户 ID                           |
| moderatedAt   | string | 否   | 审核时间                                |
| createdAt     | string | 是   | 创建时间                                |
| deletedAt     | string | 否   | 软删除时间；未删除时为 `null`           |

### guestbookMessages（留言）

| 字段          | 类型   | 必填 | 说明                   |
| ------------- | ------ | ---- | ---------------------- |
| id            | number | 是   | 留言 ID                |
| authorName    | string | 是   | 留言者名称             |
| authorEmail   | string | 否   | 留言者邮箱             |
| authorWebsite | string | 否   | 留言者网站             |
| content       | string | 是   | 留言内容               |
| ipAddress     | string | 否   | IP 地址                |
| userAgent     | string | 否   | 浏览器 UA              |
| status        | string | 是   | 状态：`unread`、`read` |
| createdAt     | string | 是   | 创建时间               |
| deletedAt     | string | 否   | 软删除时间；未删除时为 `null` |

### attachments（附件记录）

> 注意：仅导出附件的元数据记录，不包含附件文件本身。

| 字段             | 类型   | 必填 | 说明                                |
| ---------------- | ------ | ---- | ----------------------------------- |
| id               | number | 是   | 附件 ID                             |
| filename         | string | 是   | 文件名                              |
| originalFilename | string | 是   | 原始文件名                          |
| mimeType         | string | 是   | MIME 类型                           |
| size             | number | 是   | 文件大小（字节）                    |
| width            | number | 否   | 图片宽度                            |
| height           | number | 否   | 图片高度                            |
| storageProvider  | string | 是   | 存储服务商：`s3`、`r2`、`oss`、`cos`|
| storageKey       | string | 是   | 存储路径                            |
| uploadedBy       | number | 否   | 上传者用户 ID                       |
| createdAt        | string | 是   | 创建时间                            |
| deletedAt        | string | 否   | 软删除时间；未删除时为 `null`       |

---

## 四、设置数据

包含用户、系统设置、菜单、跳转规则等配置相关数据。

```json
{
  "meta": {
    "type": "settings",
    "version": "2.0",
    "exportedAt": "2026-01-01T00:00:00.000Z"
  },
  "users": [],
  "settings": [],
  "menus": [],
  "redirectRules": []
}
```

### users（用户）

| 字段      | 类型   | 必填 | 说明                                                            |
| --------- | ------ | ---- | --------------------------------------------------------------- |
| id        | number | 否   | 用户 ID；导入已存在用户时按 `username` 匹配，不依赖该字段       |
| username  | string | 是   | 用户名（唯一）                                                  |
| email     | string | 否   | 邮箱                                                            |
| role      | string | 否   | 角色：`owner`、`admin`、`editor`；新建用户缺省时默认为 `editor` |
| avatarUrl | string | 否   | 头像 URL                                                        |
| createdAt | string | 否   | 创建时间                                                        |
| updatedAt | string | 否   | 更新时间                                                        |

> 注意：出于安全考虑，用户密码不会被导出。导入时，已存在的用户（按用户名匹配）不会修改密码；不存在的用户将生成随机密码。当前操作用户即使出现在导入包中，也不会被降级为更低权限角色。

### settings（系统设置）

| 字段  | 类型   | 必填 | 说明       |
| ----- | ------ | ---- | ---------- |
| key   | string | 是   | 设置项键名 |
| value | string | 是   | 设置项值   |

> 注意：出于安全考虑，存储服务商的密钥字段（如 `storageS3AccessKey`、`storageS3SecretKey` 等）不会被导出，导入时也会被忽略，并保留当前系统中已有的敏感值。

### menus（菜单）

| 字段      | 类型   | 必填 | 说明                                      |
| --------- | ------ | ---- | ----------------------------------------- |
| id        | number | 是   | 菜单 ID                                   |
| title     | string | 是   | 菜单标题                                  |
| url       | string | 是   | 链接地址                                  |
| parentId  | number | 否   | 父菜单 ID                                 |
| sortOrder | number | 否   | 排序序号，默认 `0`                        |
| target    | string | 否   | 链接目标：`_self`、`_blank`，默认 `_self` |
| createdAt | string | 是   | 创建时间                                  |

### redirectRules（跳转规则）

| 字段         | 类型   | 必填 | 说明                                              |
| ------------ | ------ | ---- | ------------------------------------------------- |
| id           | number | 否   | 规则 ID；正整数时会尝试保留                       |
| sortOrder    | number | 否   | 排序序号，导入时会按该顺序重新整理                |
| pathRegex    | string | 是   | 用于匹配 pathname 的正则表达式                    |
| redirectTo   | string | 是   | 跳转目标，支持站内路径或完整 `http` / `https` URL |
| redirectType | string | 是   | 跳转类型：`301`、`302`、`307`、`308`              |
| memo         | string | 否   | 备注                                              |

---

## 五、导入说明

### 跨包依赖

内容数据中的 `contents.authorId`、`contentRevisions.createdBy`、`attachments.uploadedBy`、`comments.userId`、`comments.moderatedBy` 等字段引用用户表。**恢复完整站点时，建议先导入设置数据（建立用户），再导入内容数据。** 对于缺失的用户引用：`authorId` 和 `createdBy` 会回填为当前导入用户；`uploadedBy`、`userId`、`moderatedBy` 等可空字段在引用的用户不存在时会被置为 `null`。

### 内容数据导入

- 当前仅支持**覆盖导入**
- 导入时会先清空现有内容相关数据（包括文章和页面），再按数据包重新写入
- 清空范围：`contentTags`、`comments`、`contentRevisions`、`slugHistories`、`contents`（全部类型）、`categories`、`tags`、`guestbookMessages`、`attachments`
- 可选数组（`contentTags`、`contentRevisions`、`slugHistories`、`comments`、`guestbookMessages`、`attachments`）如果在导入包中省略，这些数据会被清空
- `authorId` 和 `createdBy` 缺失或引用不存在用户时，回填为当前导入用户
- `uploadedBy`、`userId`、`moderatedBy` 引用不存在用户时，置为 `null`
- `contentText` 缺失时，优先从 `contentHtml` 自动生成，其次退回 `contentRaw`
- 评论导入前会自动拓扑排序，保证父评论先于子评论写入

### 设置数据导入

- `settings` 为格式校验必填字段，提供后会先清空现有设置，再导入非敏感设置，并恢复敏感设置
- `users`、`menus`、`redirectRules` 在格式校验阶段均为可选字段
- `menus` 存在时，会清空现有菜单后重新导入；导入时自动拓扑排序处理父子关系；省略时保留现有菜单
- `redirectRules` 存在时，会清空现有跳转规则后按 `sortOrder` 重建；省略时保留现有规则
- `users` 存在时，按 `username` 执行更新或新建，不会删除现有用户
- 如果 `redirectRules` 中存在非法正则、非法跳转目标或非法跳转类型，整个设置导入会失败
