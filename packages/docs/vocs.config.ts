import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'ICE Documentation',
  description: 'A powerful CLI and SDK for Internet Computer developers',
  
  sidebar: [
    {
      text: 'Introduction',
      items: [
        { text: 'What is ICE?', link: '/introduction/what-is-ice' },
        { text: 'Getting Started', link: '/introduction/getting-started' },
      ],
    },
    {
      text: 'Core Concepts',
      items: [
        { text: 'Canister Management', link: '/core-concepts/canister-management' },
        { text: 'TypeScript Configuration', link: '/core-concepts/typescript-configuration' },
        { text: 'Task Automation', link: '/core-concepts/task-automation' },
        { text: 'Boilerplate Generation', link: '/core-concepts/boilerplate-generation' },
      ],
    },
    {
      text: 'API Reference',
      items: [
        { text: 'CLI Commands', link: '/api/cli-commands' },
        { text: 'Configuration Options', link: '/api/configuration-options' },
      ],
    },
    {
      text: 'Advanced Topics',
      items: [
        { text: 'Testing with ICE', link: '/advanced/testing' },
        { text: 'Extensibility', link: '/advanced/extensibility' },
      ],
    },
  ],
})