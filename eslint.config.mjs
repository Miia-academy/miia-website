import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', '.storyblok/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Storyblok data is still typed loosely: reported, cleaned up area by area
      '@typescript-eslint/no-explicit-any': 'warn',
      // Italian text is full of apostrophes, which React renders correctly
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
]

export default eslintConfig
