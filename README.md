# Publa

Publa 是一个基于 Next.js 的动态博客系统，使用 Drizzle ORM，支持 SQLite（本地文件 / Turso）与 PostgreSQL。

## 快速开始

要求 Node.js 24+。

```bash
npm install
npm run dev
```

首次启动会自动执行数据库迁移。然后：

- 访问 `http://localhost:8084` 打开博客首页
- 访问 `http://localhost:8084/setup` 创建站长账号（首次使用必须完成）

默认使用本地 SQLite，无需任何配置。如需使用其他数据库，在 `.env` 中配置：

```env
# Turso
DATABASE_URL=libsql://your_db_name-your_org_name.turso.io
DATABASE_AUTH_TOKEN=your_token

# PostgreSQL（postgres:// 和 postgresql:// 均可）
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/publa
```

## 部署

数据库迁移在服务启动时自动执行，无需手动操作。

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 否 | 见说明 | 数据库连接字符串。SQLite 本地部署可省略；Turso 或 PostgreSQL 必填。数据库类型从 URL 前缀自动识别（`postgres://` 或 `postgresql://` → PostgreSQL，其余 → SQLite）。默认值：本机开发指向 `<项目根>/data/publa.db`；Docker 镜像中指向 `/app/data/publa.db`（已声明为 VOLUME） |
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

### Docker 镜像

每次推送 `release-vX.Y.Z` 标签时，GitHub Actions 会自动构建并发布多架构镜像（`linux/amd64`、`linux/arm64`）到 GitHub Container Registry：

```
ghcr.io/oldj/publa:<version>   # 例如 0.1.34、1.2.3-beta.4
ghcr.io/oldj/publa:latest      # 最新稳定版（不包含预发布版本）
```

公共仓库可直接 `docker pull`，无需登录。下文示例中也可以将镜像替换为本地自行构建版本：

```bash
docker build -t publa .
# 之后把 ghcr.io/oldj/publa:latest 替换为 publa 即可
```

> **生产部署建议**：将镜像 tag 固定到具体版本号（如 `ghcr.io/oldj/publa:0.1.34`），避免重启容器时意外拉到新版本而引入未预期的变更。`:latest` 仅推荐用于试用、本地体验或愿意自动跟进最新稳定版的场景。

### Docker — SQLite

最简单的部署方式，无需外部数据库。

```bash
docker run -d \
  -p 8084:8084 \
  -v publa-data:/app/data \
  ghcr.io/oldj/publa:latest
```

`/app/data` 目录存放 SQLite 数据库文件，务必挂载持久化卷。

### Docker — Turso

```bash
docker run -d \
  -p 8084:8084 \
  -e DATABASE_URL=libsql://<db_name>-<org_name>.turso.io \
  -e DATABASE_AUTH_TOKEN=<your_token> \
  ghcr.io/oldj/publa:latest
```

> 使用远程数据库时不需要挂载本地数据卷。

### Docker — PostgreSQL

```bash
docker run -d \
  -p 8084:8084 \
  -e DATABASE_URL=postgres://user:pass@host:5432/publa \
  ghcr.io/oldj/publa:latest
```

> 表结构会在首次启动时自动迁移，但目标 database 需要预先存在。例如 `createdb publa`，或在 PostgreSQL 中执行 `CREATE DATABASE publa;`。

### Vercel

Vercel 部署需要使用 Turso 或外部 PostgreSQL 作为数据库（不支持本地 SQLite 文件）。

在 **Settings → Environment Variables** 中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | Turso 连接 URL（`libsql://...`）或 PostgreSQL 连接字符串（`postgres://` / `postgresql://`） |
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
| `npm run lint` | 运行 ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run test:unit` | 运行单元测试（Vitest） |
| `npm run test:e2e` | 运行 E2E 测试（Playwright，首次需先执行 `npx playwright install`） |
| `npm test` | 一次性跑 lint + 单元测试 + E2E |
| `npm run db:generate:sqlite` | 生成 SQLite 迁移文件 |
| `npm run db:generate:pg` | 生成 PostgreSQL 迁移文件 |
| `npm run db:generate:all` | 同时生成 SQLite / PostgreSQL 迁移文件 |
| `npm run db:migrate:sqlite` | 应用 SQLite 迁移 |
| `npm run db:migrate:pg` | 应用 PostgreSQL 迁移 |
| `npm run db:check-migrations` | 检查迁移链是否连续且合法 |
| `npm run db:seed` | 初始化种子数据 |
| `npm run db:studio` | 打开 Drizzle Studio 数据库管理界面 |

## License

[MIT](LICENSE) © oldj
