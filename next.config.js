const next_configs = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1', 'local.oldj.net'],
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
  async redirects() {
    return [
      {
        source: '/feed',
        destination: '/rss.xml',
        permanent: true,
      },
      {
        source: '/blog/tag/:tag(.*)/',
        destination: '/posts/list/?tag=:tag',
        permanent: true,
      },
      {
        source: '/blog/category/:category(.*)/',
        destination: '/posts/list/?category=:category',
        permanent: true,
      },
      {
        source: '/blog/:slug(.*)',
        destination: '/posts/:slug',
        permanent: true,
      },
      {
        source: '/article/list',
        destination: '/posts/list',
        permanent: true,
      },
      {
        source: '/article/:slug(.*)',
        destination: '/posts/:slug',
        permanent: true,
      },
    ]
  },
}

module.exports = next_configs
