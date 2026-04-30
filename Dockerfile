# 安装依赖
FROM node:24.14.1-alpine3.23 AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 构建（在 alpine 容器内构建，确保原生二进制是 linux-musl 平台）
FROM node:24.14.1-alpine3.23 AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行阶段
FROM node:24.14.1-alpine3.23 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8084
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# 先建用户与数据目录，避免后续 RUN chown -R 复制整层
RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /app/data \
 && chown app:app /app /app/data

# standalone 自带运行时所需 node_modules（含 nodemailer / resend，
# 由 next.config.js 的 outputFileTracingIncludes 显式声明）。
# 用 --chown 避免后续整层 chown -R 引发的 CoW 复制。
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/drizzle ./drizzle

VOLUME /app/data

USER app

EXPOSE 8084

CMD ["node", "server.js"]
