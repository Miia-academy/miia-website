import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  // JSX dei componenti come in Next (senza import React)
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Stessi alias di tsconfig.json
    alias: {
      '@modules': dir('./modules'),
      '@components': dir('./components'),
      '@config': dir('./config'),
      '@pages': dir('./pages'),
      '@public': dir('./public'),
      '@styles': dir('./styles'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    unstubEnvs: true,
  },
})
