# AGENTS.md

本文件为 Codex (Codex.ai/code) 在本仓库中工作时提供指导。

这是一个博客站点，使用了 Next.js 框架。

## 语言

始终使用中文回复。
Git 提交信息也使用中文，动词开头，句号结尾。使用常规提交前缀，如 `feat(auth):`、`fix(ui):` 等，第一行写本次提交的简介，然后空一行，再以 Markdown 无序列表的形式列举改动详情。

## 行动要点

- 像一位高绩效的资深工程师。言简意赅，直截了当，注重执行
- 倾向于选择简单、易于维护、适合生产环境的解决方案。编写低复杂度、易于阅读、调试和修改的代码
- 对于小型功能，不要过度设计或添加复杂的抽象、额外的层或大型依赖项
- 保持 API 简洁，行为清晰，命名简洁。除非能明显提升结果，否则避免使用花哨的功能
- 添加必要的注释，以方便未来维护，注释使用中文
- 内部或底层抛出异常时统一使用英文

运用第一性原理 思考，拒绝经验主义和路径盲从，不要假设我完全清楚目标，保持审慎，从原始需求和问题出发，若目标模糊请停下和我讨论，若目标清晰但路径非最优，请直接建议更短、更低成本的办法。

所有回答必须分为两个部分：

- 直接执行：按照我当前的要求和逻辑，直接给出任务结果。
- 深度交互：基于底层逻辑对我的原始需求进行“审慎挑战”。包括但不限于：质疑我的动机是否偏离目标（XY问题）、分析当前路径的弊端、并给出更优雅的替代方案。

## 开发要点

- 所有 js/ts/json/css/scss 代码，需要使用 prettier 格式化，以保持格式一致
- `next dev` 默认仅放行 `127.0.0.1` 作为跨域开发源；需要额外放行时，通过环境变量 `ALLOWED_DEV_ORIGINS`（逗号分隔）追加，切勿把自定义域名硬编码进 `next.config.js`
- 所有数据库操作需要同时兼容 SQLite 和 PostgreSQL
- 服务层、数据库层、存储层等非 UI 层，禁止直接拼接或返回面向用户的自然语言文案。需要给 UI 展示的结果，应返回稳定的错误码、类型或结构化结果，再由页面、route handler 或其他边界层按 locale 翻译
- API 路由和其他 UI 边界层，禁止直接把底层 `error.message` 透传给前端。应记录服务端日志，并将错误映射为稳定的 `code` 与可翻译的 `message`

## API 响应格式

所有 API 路由返回的 JSON 必须遵循统一格式：

```ts
// 成功（有数据）
{ success: true, data: { ... } }

// 成功（无数据，如删除操作）
{ success: true }

// 失败
{ success: false, code: "ERROR_CODE", message?: "可选的可读描述" }
```

- `data` 可选，有业务数据时使用，所有业务字段放在 `data` 内，不要散落在顶层
- `code` 为简短的大写蛇形错误码字符串，如 `"UNAUTHORIZED"`、`"NOT_FOUND"`、`"VALIDATION_ERROR"`
- `message` 可选，用于提供更友好的错误描述
- 需要多语言展示的错误、提示、导入导出摘要等，不要在服务层直接拼接自然语言字符串；优先返回 `code`、`key`、`values` 等稳定结构，由 route handler 或页面在返回前完成翻译
- 除非明确约定为内部调试接口，禁止将底层异常原文、第三方 SDK 原始报错或数据库错误直接作为 `message` 返回给前端

## 数据库

数据库需要支持 SQLite 和 PostgreSQL，ORM 为 drizzle-orm。运行时通过 `DATABASE_URL` 前缀自动检测数据库类型（`postgres://` → PostgreSQL，其他 → SQLite），逻辑位于 `src/server/db/family.ts`。

涉及数据库的修改，要注意确保同时兼容 SQLite 和 PostgreSQL。

数据库迁移在 Next.js 启动时自动执行（`src/instrumentation.ts` → `src/server/db/index.ts` 的 `runMigrations()`），用户升级代码重启服务即可平滑升级数据库。

### Schema 架构

- `src/server/db/schema/define.ts`：方言无关的 Schema 定义模板（使用 DialectKit 工厂模式）
- `src/server/db/schema/sqlite.ts` / `postgres.ts`：方言特定的实例化文件
- 修改 Schema 时只需修改 `define.ts`，两个方言文件自动适配

### 修改 schema 的流程

1. 修改 `src/server/db/schema/define.ts`
2. 在终端交互式运行 `npm run db:generate:all`，同时生成 SQLite（`drizzle/sqlite/`）和 PostgreSQL（`drizzle/postgres/`）的迁移文件
3. **禁止**手写自定义迁移再覆盖同样的变更，会导致重复执行报错

### 相关脚本和配置

- `drizzle.sqlite.config.ts` / `drizzle.pg.config.ts`：两个方言的 drizzle-kit 配置
- `npm run db:generate:all`：生成两个方言的迁移文件
- `npm run db:seed`：插入默认设置、菜单和页面
- `npm run db:check-migrations`：验证迁移链完整性（测试前自动执行）

## 测试相关

添加 E2E 测试用例时，如有必要，可以为组件添加 `data-role="xxx"` 这样的属性以方便定位。如果一个组件已经有 `data-role` 属性，复用这个属性而不要修改它，以免破坏其他测试用例或样式。

E2E 测试中 Playwright 的 `test.beforeEach` / `test.afterEach` / `test.beforeAll` / `test.afterAll` 第一个参数是 fixtures 对象，Playwright 强制要求这里必须是显式的对象解构（不接受位置参数、也不支持 `{ ...rest }` rest spread）。当回调只需要第二个参数 `testInfo` 时，不要写 `async ({}, testInfo) => { ... }`——空对象解构会触发 ESLint 的 `no-empty-pattern` 错误。统一写成 `async ({ browserName: _browserName }, testInfo) => { ... }`，借一个用不到的 fixture 名占位，既满足 Playwright 又满足 ESLint。

## 站点角色

当前站点适用于个人或小型组织的博客站点场景，包含以下三个角色：

- `owner` （站长）在初始化时生成，拥有所有权限
- `admin` （管理员）拥有所有权限，但不可添加、修改、删除 `owner` 用户
- `editor` （编辑）可查看和编辑所有内容，包括文章、分类、标签、页面、评论、留言，但不可修改站点设置，也不可添加或修改其他用户的信息
