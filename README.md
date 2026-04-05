# Publa

Publa 是一个基于 Next.js 的博客系统，使用 Drizzle ORM，当前支持 SQLite（本地文件 / Turso）与 PostgreSQL。

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:8084`，首次启动会按当前数据库类型自动执行对应迁移。

## 数据库配置

### SQLite（默认）

不需要任何配置，默认使用本地 SQLite 文件 `data/publa.db`，启动时自动创建。

也可以显式写出：

```env
DATABASE_FAMILY=sqlite
DATABASE_URL=file:./data/publa.db
```

### Turso 云数据库

1. 在 [Turso](https://turso.tech) 创建数据库
2. 获取连接 URL 和认证 Token：

```bash
turso db show 你的数据库名 --url
turso db tokens create 你的数据库名
```

3. 在 `.env` 中配置：

```env
DATABASE_FAMILY=sqlite
DATABASE_URL=libsql://your_db_name-your_org_name.turso.io
DATABASE_AUTH_TOKEN=your_token
```

启动服务后会自动执行迁移，无需手动操作。

### PostgreSQL

在 `.env` 中配置：

```env
DATABASE_FAMILY=postgres
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/publa
```

启动服务后会自动执行 `drizzle/postgres` 下的迁移。

## 修改数据库 Schema 的流程

建议在修改 schema 前先停止正在运行的 `npm run dev`。开发服务器启动时会自动执行已有迁移，如果一边改 schema、一边反复热重载，容易把本地 `data/publa.db` 迁到中间状态，排查起来会很乱。

### 1. 修改 schema 定义

按数据库类型分别修改：

- SQLite：`src/server/db/schema/sqlite.ts`
- PostgreSQL：`src/server/db/schema/postgres.ts`

如果这次变更属于业务表结构变更，通常需要同时更新两份 schema，保持字段、索引和约束一致。

### 2. 生成迁移脚本

不要手改历史迁移文件，也不要回改旧的 `meta/_journal.json` 或旧 snapshot。迁移必须只追加新文件。

常用命令如下：

```bash
# 只生成 SQLite 迁移
npm run db:generate:sqlite

# 只生成 PostgreSQL 迁移
npm run db:generate:pg

# 两套数据库都生成
npm run db:generate:all
```

生成后会在下面目录追加新的迁移文件和 snapshot：

- `drizzle/sqlite`
- `drizzle/postgres`

### 3. 检查迁移链

生成完成后，先检查迁移链是否仍然合法：

```bash
npm run db:check-migrations
```

这一步会校验：

- `meta/_journal.json` 是否可解析
- 迁移编号和时间是否保持递增
- `journal`、`.sql`、`_snapshot.json` 是否一一对应
- 是否存在重复前缀、重复 tag、或“回插旧迁移”

如果这里失败，不要继续启动应用，先修正迁移链。

### 4. 应用迁移并验证

确认迁移链正常后，再启动开发环境：

```bash
npm run dev
```

应用启动时会自动执行当前数据库类型对应的迁移。

如果你想手动验证，也可以直接执行：

```bash
npm run db:migrate:sqlite
npm run db:migrate:pg
```

建议至少补一轮对应的测试，确认读写路径没有被 schema 变更破坏。

## 部署到 Vercel

### 环境变量

在 Vercel 项目的 Settings → Environment Variables 中配置以下变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | Turso 数据库连接 URL，如 `libsql://xxx.turso.io` |
| `DATABASE_AUTH_TOKEN` | 是 | Turso 数据库认证 Token |
| `JWT_SECRET` | 是 | JWT 签名密钥，必须为强随机字符串（可用 `openssl rand -base64 32` 生成） |
| `CRON_SECRET` | 是 | 保护定时任务接口的密钥，防止未授权访问 |

> `DATABASE_FAMILY` 无需设置，Turso 属于 libsql，默认走 SQLite 驱动。
> `NODE_ENV` 和 `VERCEL` 由 Vercel 自动注入，无需手动配置。

### 定时任务

项目通过 `vercel.json` 配置 Vercel Cron Jobs，当前计划：

- `/api/cron/1d` — 每天 04:05 UTC 执行

Vercel 调用 cron 路由时会携带 `Authorization` 头，需要 `CRON_SECRET` 环境变量与之匹配才能通过鉴权。

### 注意事项

- 首次部署前务必配齐所有环境变量，否则构建或运行时会报错（如 `JWT_SECRET is not configured`）
- 数据库迁移在服务启动时自动执行，无需手动操作
- 本地开发时不需要配置 `JWT_SECRET` 和 `CRON_SECRET`，代码会使用默认值

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm test` | 运行测试 |
| `npm run db:generate` | 生成 SQLite 迁移文件 |
| `npm run db:generate:sqlite` | 生成 SQLite 迁移文件 |
| `npm run db:generate:pg` | 生成 PostgreSQL 迁移文件 |
| `npm run db:generate:all` | 同时生成 SQLite / PostgreSQL 迁移文件 |
| `npm run db:migrate:sqlite` | 应用 SQLite 迁移 |
| `npm run db:migrate:pg` | 应用 PostgreSQL 迁移 |
| `npm run db:check-migrations` | 检查迁移链是否连续且合法 |
| `npm run db:seed` | 初始化种子数据 |
| `npm run db:studio` | 打开 Drizzle Studio 数据库管理界面 |
