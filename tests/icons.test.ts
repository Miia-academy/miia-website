import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICONS, buildIconCss } from '../scripts/icons.mjs'

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

const code = ['components', 'pages'].flatMap(sourceFiles).map((path) => readFileSync(path, 'utf8'))

describe('iconoir subset', () => {
  it('lists every icon written as a class in code', () => {
    const used = code.flatMap((source) => [...source.matchAll(/iconoir-([a-z0-9-]+[a-z0-9])\b/g)].map((m) => m[1]))
    // nav-arrow-${...} in menu.tsx
    const partial = used.filter((name) => name === 'nav-arrow')
    const full = used.filter((name) => name !== 'nav-arrow')
    expect(full.filter((name) => !ICONS.includes(name))).toEqual([])
    if (partial.length) expect(ICONS).toEqual(expect.arrayContaining(['nav-arrow-up', 'nav-arrow-down']))
  })

  it('lists every icon passed as a role or list item icon', () => {
    const used = code.flatMap((source) => [...source.matchAll(/icon(?:: |=)['"]([a-z0-9-]+)['"]/g)].map((m) => m[1]))
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter((name) => !ICONS.includes(name))).toEqual([])
  })

  it('matches the generated stylesheet', () => {
    expect(readFileSync('styles/iconoir.css', 'utf8')).toBe(buildIconCss())
  })
})
