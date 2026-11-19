/**
 * Checks on files uploaded as base64 by the site's forms (company logo, student CV and portfolio).
 * The type is decided from the file content, never from the name or the type sent by the browser.
 */

export type UploadKind = 'png' | 'jpeg' | 'webp' | 'pdf' | 'zip'

const SIGNATURES: Record<UploadKind, { mime: string; ext: string; matches: (b: Buffer) => boolean }> = {
  png: {
    mime: 'image/png',
    ext: 'png',
    matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  jpeg: {
    mime: 'image/jpeg',
    ext: 'jpg',
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  webp: {
    mime: 'image/webp',
    ext: 'webp',
    matches: (b) =>
      b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  pdf: {
    mime: 'application/pdf',
    ext: 'pdf',
    matches: (b) => b.length > 5 && b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  zip: {
    mime: 'application/zip',
    ext: 'zip',
    matches: (b) => b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  },
}

export const IMAGE_KINDS: UploadKind[] = ['png', 'jpeg', 'webp']

export class InvalidUpload extends Error {}

export interface ParsedUpload {
  buffer: Buffer
  mime: string
  ext: string
}

/**
 * Decodes a base64 upload (with or without the data: prefix) and checks size and type.
 * Returns null when nothing was uploaded; throws InvalidUpload with a message for the user otherwise.
 */
export function parseUpload(
  base64: unknown,
  { kinds, maxBytes, label, formats }: { kinds: UploadKind[]; maxBytes: number; label: string; formats: string }
): ParsedUpload | null {
  if (!base64) return null
  if (typeof base64 !== 'string') throw new InvalidUpload(`Il file del ${label} non è valido.`)

  const buffer = Buffer.from(base64.replace(/^data:[^;]*;base64,/, ''), 'base64')
  if (buffer.length === 0) throw new InvalidUpload(`Il file del ${label} è vuoto.`)
  if (buffer.length > maxBytes) {
    throw new InvalidUpload(`Il ${label} supera la dimensione massima di ${Math.round(maxBytes / 1_000_000)} MB.`)
  }

  const kind = kinds.find((k) => SIGNATURES[k].matches(buffer))
  if (!kind) throw new InvalidUpload(`Formato del ${label} non valido: usa ${formats}.`)

  return { buffer, mime: SIGNATURES[kind].mime, ext: SIGNATURES[kind].ext }
}

/** File name safe for the bucket, with the extension of the real type. */
export function safeFileName(name: unknown, ext: string): string {
  const base = typeof name === 'string' ? name.toLowerCase().replace(/\.[^.]*$/, '') : ''
  const clean = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${clean || 'file'}.${ext}`
}
