const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// 开发模式允许的 Origin（仅 next dev 下生效）：
// 默认保留本机回环地址；通过 ALLOWED_DEV_ORIGINS（逗号分隔）追加自定义域名。
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const allowedDevOrigins = ['127.0.0.1', ...extraDevOrigins]

const next_configs = {
  output: 'standalone',
  allowedDevOrigins,
  serverExternalPackages: [
    'svg-captcha',
    'ali-oss',
    'cos-nodejs-sdk-v5',
    'markdown-it',
    'markdown-it-imsize',
    'markdown-it-mathjax',
    'drizzle-orm',
    '@libsql/client',
    'pg',
  ],
  // 通过 await import() 调用、nft 无法静态追踪的运行时依赖，
  // 在此显式声明，确保进入 standalone 输出。
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/nodemailer/**/*', './node_modules/resend/**/*'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/feed',
        destination: '/rss.xml',
        permanent: true,
      },
    ]
  },
}

module.exports = withNextIntl(next_configs)
