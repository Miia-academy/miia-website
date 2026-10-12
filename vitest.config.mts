import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    // Stessi alias di tsconfig.json
    alias: {
      '@modules': dir('./modules'),
      '@components': dir('./components'),
      '@config': dir('./config'),
      '@pages': dir('./pages'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    unstubEnvs: true,
  },
})
