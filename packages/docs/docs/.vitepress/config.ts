import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'KataCut',
  description: 'Documentation for the KataCut CLI and architecture',
  srcDir: '.',
  outDir: 'dist',
  lang: 'ru-RU',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/overview' },
      { text: 'Commands', link: '/commands/install' },
      { text: 'Reference', link: '/reference/config' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/guide/overview' },
            { text: 'Scopes & Clients', link: '/guide/scopes-and-clients' }
          ]
        }
      ],
      '/commands/': [
        {
          text: 'CLI Commands',
          items: [
            { text: 'install (i)', link: '/commands/install' },
            { text: 'lock', link: '/commands/lock' },
            { text: 'doctor', link: '/commands/doctor' },
            { text: 'ci', link: '/commands/ci' },
            { text: 'mcp', link: '/commands/mcp' },
            { text: 'init', link: '/commands/init' },
            { text: 'sync (legacy)', link: '/commands/sync' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Config (katacut.config.*)', link: '/reference/config' },
            { text: 'Lockfile (katacut.lock.json)', link: '/reference/lockfile' },
            { text: 'Exit Codes', link: '/reference/exit-codes' }
          ]
        }
      ]
    },
    logo: undefined,
    outline: [2, 3]
  }
});
