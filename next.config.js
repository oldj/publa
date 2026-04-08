const next_configs = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1', '*.oldj.net', '*.tominlab.com'],
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

module.exports = next_configs
