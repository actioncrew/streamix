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
      { text: 'Changelog', link: '/CHANGELOG' },
      { text: 'API Reference', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/actioncrew/streamix' }
    ],

    // Sidebar configuration
    sidebar: {
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Enumerations', link: '/api/#enumerations' },
            { text: 'Functions', link: '/api/#functions' },
            { text: 'Interfaces', link: '/api/#interfaces' },
            { text: 'Type Aliases', link: '/api/#type-aliases' },
            { text: 'Variables', link: '/api/#variables' }
          ]
        }
      ],
      '/': [
        {
          text: 'Articles',
          items: [
            { text: 'README', link: '/' },
            { text: 'Generators', link: '/GENERATORS.md' },
            { text: 'Coroutines', link: '/COROUTINES.md' },
            { text: 'Subjects', link: '/SUBJECTS.md' },
            { text: 'Changelog', link: '/CHANGELOG.md' }
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
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
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
