# 公共基础阶段
FROM node:24.14.1-alpine3.23 AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 安装依赖
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 构建（在 alpine 容器内构建，确保原生二进制是 linux-musl 平台）
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行阶段
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=8084
ENV HOSTNAME=0.0.0.0

# 先建用户与数据目录，避免后续 RUN chown -R 复制整层
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/data \
  && chown app:app /app /app/data

# standalone 构建产物包含通过静态导入追踪到的邮件依赖。
# 用 --chown 避免后续整层 chown -R 引发的 CoW 复制。
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/drizzle ./drizzle

VOLUME /app/data

USER app

EXPOSE 8084

CMD ["node", "server.js"]
