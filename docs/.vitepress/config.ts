import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/streamix/',
  title: 'Streamix',
  description: 'Documentation for reactive library',

  // Clean URLs
  cleanUrls: true,

  // Theme configuration
  themeConfig: {
    // Site navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/actioncrew/streamix' }
    ],

    // Sidebar configuration
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Basic Usage', link: '/guide/basic-usage' },
            { text: 'Advanced Usage', link: '/guide/advanced-usage' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Classes', link: '/api/classes/' },
            { text: 'Interfaces', link: '/api/interfaces/' },
            { text: 'Functions', link: '/api/functions/' },
            { text: 'Types', link: '/api/types/' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/actioncrew/streamix' }
    ],

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Oleksii Shepel'
    },

    // Search
    search: {
      provider: 'local'
    },

    // Last updated
    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    }
  },

  // Markdown configuration
  markdown: {
    theme: 'github-dark',
    lineNumbers: true
  },

  // Head tags for SEO and PWA
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3c82f6' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'My Project' }]
  ]
})
