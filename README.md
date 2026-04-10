# Publa

Publa 是一个基于 Next.js 的博客系统，使用 Drizzle ORM，支持 SQLite（本地文件 / Turso）与 PostgreSQL。

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:8084`，首次启动会自动执行数据库迁移并进入初始化引导。

默认使用本地 SQLite，无需任何配置。如需使用其他数据库，在 `.env` 中配置：

```env
# Turso
DATABASE_URL=libsql://your_db_name-your_org_name.turso.io
DATABASE_AUTH_TOKEN=your_token

# PostgreSQL
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/publa
```

## 部署

数据库迁移在服务启动时自动执行，无需手动操作。

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 否 | `file:{cwd}/data/publa.db` | 数据库连接字符串。SQLite 本地部署可省略；Turso 或 PostgreSQL 必填。数据库类型从 URL 前缀自动识别（`postgres://` → PostgreSQL，其余 → SQLite） |
| `DATABASE_AUTH_TOKEN` | 否 | - | Turso 数据库认证 Token，仅 Turso 需要 |
| `JWT_SECRET` | 视情况 | - | JWT 签名密钥。生成方式：`openssl rand -base64 32`。详见下方说明 |
| `CRON_SECRET` | 视情况 | - | 保护定时任务 API 的密钥。自托管部署不需要（使用进程内调度）；Vercel 部署必填 |
| `ADMIN_PATH` | 否 | `admin` | 自定义后台管理路径。详见下方说明 |

**关于 `JWT_SECRET`：**

- **本地开发**：无需配置，使用内置默认值
- **Docker 自托管**：可不配置，首次启动时自动生成随机密钥并持久化到数据库，后续重启自动加载，不影响已登录用户。如需要指定值也可手动配置
- **Vercel**：**必须配置**！Vercel 的中间件运行在 Edge Runtime（与服务端 Node.js 隔离的环境），无法读取数据库中自动生成的密钥，只能通过环境变量获取

**关于 `ADMIN_PATH`：**

默认后台地址为 `/admin`，通过设置 `ADMIN_PATH` 可自定义为任意路径，减少自动化扫描和机器人攻击：

```env
ADMIN_PATH=my-secret-panel
```

设置后，后台入口变为 `/my-secret-panel`，直接访问 `/admin` 将返回 404。API 路由 `/api/admin/*` 不受影响。

注意事项：
- 值为单段路径，不含斜杠（如 `backstage`、`my-admin-1234`）
- 不能使用保留路径（`api`、`setup`、`posts`、`category`、`tag` 等）
- 修改后需要重启服务生效
- 不设置或设置为 `admin` 时行为与默认完全一致

### Docker — SQLite

最简单的部署方式，无需外部数据库。

```bash
docker build -t publa .
docker run -d \
  -p 8084:8084 \
  -v publa-data:/app/data \
  publa
```

`/app/data` 目录存放 SQLite 数据库文件，务必挂载持久化卷。

### Docker — Turso

```bash
docker run -d \
  -p 8084:8084 \
  -e DATABASE_URL=libsql://<db_name>-<org_name>.turso.io \
  -e DATABASE_AUTH_TOKEN=<your_token> \
  publa
```

> 使用远程数据库时不需要挂载本地数据卷。

### Docker — PostgreSQL

```bash
docker run -d \
  -p 8084:8084 \
  -e DATABASE_URL=postgres://user:pass@host:5432/publa \
  publa
```

### Vercel

Vercel 部署需要使用 Turso 或外部 PostgreSQL 作为数据库（不支持本地 SQLite 文件）。

在 **Settings → Environment Variables** 中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | Turso 连接 URL（`libsql://...`）或 PostgreSQL 连接字符串 |
| `DATABASE_AUTH_TOKEN` | Turso 必填 | Turso 数据库认证 Token |
| `JWT_SECRET` | 是 | JWT 签名密钥，`openssl rand -base64 32` 生成 |
| `CRON_SECRET` | 是 | 保护定时任务接口，防止未授权访问 |

> `NODE_ENV`、`VERCEL` 由 Vercel 自动处理，无需手动配置。

定时任务通过 `vercel.json` 配置 Vercel Cron Jobs：

- `/api/cron/1d` — 每天 04:05 UTC 执行

Vercel 调用 cron 路由时会携带 `Authorization` 头，需要 `CRON_SECRET` 环境变量与之匹配。

## 附件存储

附件（图片等）需要上传到云存储服务，在后台管理界面中配置，不需要环境变量。支持：

- AWS S3（或 S3 兼容服务，如 MinIO）
- Cloudflare R2
- 阿里云 OSS
- 腾讯云 COS

## 开发指南

### 修改数据库 Schema

建议在修改 schema 前先停止正在运行的 `npm run dev`，避免热重载将本地数据库迁到中间状态。

**1. 修改 schema 定义**

修改统一的 schema 定义文件 `src/server/db/schema/define.ts`。SQLite 和 PostgreSQL 共用同一份 schema。

**2. 生成迁移脚本**

不要手改历史迁移文件，也不要回改旧的 `meta/_journal.json` 或旧 snapshot。迁移必须只追加新文件。

```bash
# 只生成 SQLite 迁移
npm run db:generate:sqlite

# 只生成 PostgreSQL 迁移
npm run db:generate:pg

# 两套数据库都生成
npm run db:generate:all
```

生成后会在 `drizzle/sqlite` 和 `drizzle/postgres` 目录追加新的迁移文件和 snapshot。

**3. 检查迁移链**

```bash
npm run db:check-migrations
```

校验 `_journal.json`、迁移编号、`.sql` 与 `_snapshot.json` 的一致性。如果失败，先修正迁移链再继续。

**4. 应用迁移并验证**

```bash
npm run dev
```

启动时自动执行迁移。也可以手动执行 `npm run db:migrate:sqlite` 或 `npm run db:migrate:pg`。

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm test` | 运行测试 |
| `npm run db:generate:sqlite` | 生成 SQLite 迁移文件 |
| `npm run db:generate:pg` | 生成 PostgreSQL 迁移文件 |
| `npm run db:generate:all` | 同时生成 SQLite / PostgreSQL 迁移文件 |
| `npm run db:migrate:sqlite` | 应用 SQLite 迁移 |
| `npm run db:migrate:pg` | 应用 PostgreSQL 迁移 |
| `npm run db:check-migrations` | 检查迁移链是否连续且合法 |
| `npm run db:seed` | 初始化种子数据 |
| `npm run db:studio` | 打开 Drizzle Studio 数据库管理界面 |
