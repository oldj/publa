# Publa

Publa 是一个基于 Next.js 的博客系统，使用 Drizzle ORM，支持 SQLite（本地文件 / Turso）与 PostgreSQL。

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:8084`，首次启动会自动执行数据库迁移并进入初始化引导。

## 部署

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_FAMILY` | 否 | `sqlite` | 数据库类型，可选 `sqlite` / `postgres` |
| `DATABASE_URL` | 否 | `file:{cwd}/data/publa.db` | 数据库连接字符串。SQLite 本地部署可省略；Turso 或 PostgreSQL 必填 |
| `DATABASE_AUTH_TOKEN` | 否 | - | Turso 数据库认证 Token，仅 Turso 需要 |
| `JWT_SECRET` | 否 | 自动生成 | JWT 签名密钥。未配置时自动生成随机密钥并持久化到数据库，重启不丢失。也可手动指定：`openssl rand -base64 32` |
| `CRON_SECRET` | 视情况 | - | 保护定时任务 API 的密钥。自托管 Docker 部署不需要（使用进程内调度）；Vercel 部署必填 |

> 本地开发时无需配置任何环境变量，所有值均有开发环境默认值。

### Docker 部署（SQLite）

最简单的部署方式，无需外部数据库。

```bash
docker build -t publa .
docker run -d \
  -p 8084:8084 \
  -v publa-data:/app/data \
  publa
```

`/app/data` 目录存放 SQLite 数据库文件，务必挂载持久化卷。

### Docker 部署（Turso）

使用 Turso 云数据库，适合需要远程数据库的场景。

1. 在 [Turso](https://turso.tech) 创建数据库并获取连接信息：

```bash
turso db show <数据库名> --url
turso db tokens create <数据库名>
```

2. 启动容器：

```bash
docker run -d \
  -p 8084:8084 \
  -e DATABASE_URL=libsql://<db_name>-<org_name>.turso.io \
  -e DATABASE_AUTH_TOKEN=<your_token> \
  publa
```

> `DATABASE_FAMILY` 无需设置，默认值即为 `sqlite`，兼容 Turso。使用远程数据库时不需要挂载本地数据卷。

### Docker 部署（PostgreSQL）

```bash
docker run -d \
  -p 8084:8084 \
  -e DATABASE_FAMILY=postgres \
  -e DATABASE_URL=postgres://user:pass@host:5432/publa \
  publa
```

### 部署到 Vercel

Vercel 部署需要使用 Turso 或外部 PostgreSQL 作为数据库（不支持本地 SQLite 文件）。

#### 环境变量

在 Vercel 项目的 **Settings → Environment Variables** 中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | Turso 连接 URL（`libsql://...`）或 PostgreSQL 连接字符串 |
| `DATABASE_AUTH_TOKEN` | Turso 必填 | Turso 数据库认证 Token |
| `JWT_SECRET` | 否 | 未配置时自动生成并持久化到数据库，冷启动后自动恢复。也可手动指定：`openssl rand -base64 32` |
| `CRON_SECRET` | 是 | 保护定时任务接口，防止未授权访问 |

> `DATABASE_FAMILY`、`NODE_ENV`、`VERCEL` 由 Vercel 自动处理，无需手动配置。

#### 定时任务

项目通过 `vercel.json` 配置 Vercel Cron Jobs：

- `/api/cron/1d` — 每天 04:05 UTC 执行

Vercel 调用 cron 路由时会携带 `Authorization` 头，需要 `CRON_SECRET` 环境变量与之匹配。

### 附件存储

附件（图片等）需要上传到云存储服务，在后台管理界面中配置。支持：

- AWS S3（或 S3 兼容服务，如 MinIO）
- Cloudflare R2
- 阿里云 OSS
- 腾讯云 COS

存储配置通过后台界面管理，不需要环境变量。

## 数据库配置

### SQLite（默认）

不需要任何配置，默认使用本地 SQLite 文件 `data/publa.db`，启动时自动创建。

也可以显式写出：

```env
DATABASE_FAMILY=sqlite
DATABASE_URL=file:./data/publa.db
```

### Turso 云数据库

```env
DATABASE_FAMILY=sqlite
DATABASE_URL=libsql://your_db_name-your_org_name.turso.io
DATABASE_AUTH_TOKEN=your_token
```

### PostgreSQL

```env
DATABASE_FAMILY=postgres
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/publa
```

启动后自动执行迁移，无需手动操作。

## 修改数据库 Schema 的流程

建议在修改 schema 前先停止正在运行的 `npm run dev`。开发服务器启动时会自动执行已有迁移，如果一边改 schema、一边反复热重载，容易把本地 `data/publa.db` 迁到中间状态，排查起来会很乱。

### 1. 修改 schema 定义

修改统一的 schema 定义文件 `src/server/db/schema/define.ts`。SQLite 和 PostgreSQL 共用同一份 schema。

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
- 是否存在重复前缀、重复 tag、或"回插旧迁移"

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
