# 安装依赖
FROM node:24.14.1-alpine3.23 AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 构建
FROM node:24.14.1-alpine3.23 AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 生产依赖（用于补充 standalone 中缺失的 serverExternalPackages）
FROM node:24.14.1-alpine3.23 AS prod-deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 运行阶段
FROM node:24.14.1-alpine3.23 AS runner

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

# standalone 已包含大部分运行时依赖
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle

# 补充 standalone 未打包的 serverExternalPackages 及其依赖链
COPY --from=prod-deps /app/node_modules ./node_modules_prod
RUN for dir in node_modules_prod/*/; do \
  name=$(basename "$dir"); \
  [ ! -d "node_modules/$name" ] && cp -r "$dir" "node_modules/$name"; \
  done; \
  rm -rf node_modules_prod

# 数据目录（本地 SQLite + 上传文件）
RUN mkdir -p /app/data && chown -R app:app /app
VOLUME /app/data

USER app

ENV NODE_ENV=production
ENV PORT=8084
ENV DATABASE_URL=file:/app/data/publa.db

EXPOSE 8084

CMD ["node", "server.js"]
