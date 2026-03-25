import { defineConfig, type HeadConfig } from 'vitepress'

const siteUrl = 'https://ftery0.github.io/claude-account-switch'

function guideSidebar(prefix = '') {
  return [
    {
      text: prefix ? '가이드' : 'Guide',
      items: [
        { text: prefix ? '빠른 시작' : 'Quick Start', link: `${prefix}/guide/` },
        { text: prefix ? '설치' : 'Installation', link: `${prefix}/guide/installation` },
        { text: prefix ? '명령어 레퍼런스' : 'Commands', link: `${prefix}/guide/commands` },
        { text: prefix ? '셸 통합' : 'Shell Integration', link: `${prefix}/guide/shell-integration` },
        { text: prefix ? '작동 방식' : 'How It Works', link: `${prefix}/guide/how-it-works` },
      ],
    },
    {
      text: prefix ? '플랫폼별 설정' : 'Platform Setup',
      items: [
        { text: 'macOS', link: `${prefix}/guide/setup-macos` },
        { text: 'Linux', link: `${prefix}/guide/setup-linux` },
        { text: 'Windows', link: `${prefix}/guide/setup-windows` },
      ],
    },
  ]
}

export default defineConfig({
  title: 'claude-account-switch',
  description: 'Multi-account profile manager for Claude Code',
  cleanUrls: true,
  base: '/claude-account-switch/',

  sitemap: {
    hostname: 'https://ftery0.github.io/claude-account-switch/',
  },

  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'claude-account-switch' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og-image.png` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.png` }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/' },
        ],
        sidebar: {
          '/guide/': guideSidebar(),
        },
      },
    },
    ko: {
      label: '한국어',
      lang: 'ko',
      description: 'Claude Code를 위한 멀티 계정 프로필 관리 도구',
      themeConfig: {
        nav: [
          { text: '가이드', link: '/ko/guide/' },
        ],
        sidebar: {
          '/ko/guide/': guideSidebar('/ko'),
        },
        outline: { label: '목차' },
        docFooter: { prev: '이전', next: '다음' },
        lastUpdated: { text: '마지막 수정' },
      },
    },
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ftery0/claude-account-switch' },
    ],
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/ftery0/claude-account-switch/edit/main/website/:path',
    },
  },

  transformHead({ pageData, siteData }) {
    const head: HeadConfig[] = []
    const pagePath = pageData.relativePath
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '')

    // Canonical URL
    const canonical = `${siteUrl}/${pagePath}`
    head.push(['link', { rel: 'canonical', href: canonical }])

    // Hreflang: EN ↔ KO
    const isKo = pagePath.startsWith('ko/')
    const enPath = isKo ? pagePath.replace(/^ko\//, '') : pagePath
    const koPath = isKo ? pagePath : `ko/${pagePath}`

    head.push(['link', { rel: 'alternate', hreflang: 'en', href: `${siteUrl}/${enPath}` }])
    head.push(['link', { rel: 'alternate', hreflang: 'ko', href: `${siteUrl}/${koPath}` }])
    head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}/${enPath}` }])

    // OG meta per page
    const title = pageData.frontmatter.title || pageData.title || siteData.title
    const description = pageData.frontmatter.description || pageData.description || siteData.description
    head.push(['meta', { property: 'og:title', content: title }])
    head.push(['meta', { property: 'og:description', content: description }])
    head.push(['meta', { property: 'og:url', content: canonical }])

    return head
  },

  transformHtml(code, id, ctx) {
    // Inject JSON-LD from frontmatter
    const jsonLd = ctx.pageData.frontmatter.jsonLd
    if (jsonLd) {
      const script = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
      return code.replace('</head>', `${script}\n</head>`)
    }
  },
})
