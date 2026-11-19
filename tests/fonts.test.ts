import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// next/font CSS (the @font-face of Montserrat and Playfair) reaches the page only from
// modules the browser loads: _document runs on the server only, so the fonts live in _app.
describe('fonts', () => {
  it('_app sets --font-sans and --font-serif from next/font', () => {
    const app = readFileSync('pages/_app.tsx', 'utf8')
    expect(app).toMatch(/from '@config\/fonts'/)
    expect(app).toMatch(/--font-sans: \$\{fontSans\.style\.fontFamily\}/)
    expect(app).toMatch(/--font-serif: \$\{fontSerif\.style\.fontFamily\}/)
  })
})
