/**
 * PDF del contratto, generato alla firma (passo 6). È la copia fedele di ciò che
 * la persona ha visto e accettato: dati, edizione, importi, consensi e testi
 * delle condizioni nella versione accettata, più il blocco della firma.
 *
 * Impaginazione da contratto, in bianco e nero e compatta: logo e numero del
 * contratto in testa, articoli numerati, tabelle con filetti, condizioni accettate
 * in coda, piè di pagina con i dati legali e "Pagina X di Y". Il profilo
 * facoltativo non c'è: non fa parte del contratto (va solo in Brevo).
 */
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import type { ConditionItem, Conditions } from './conditions'
import { courseTitle } from './courses'
import { MODE_LABELS, documentLabel, euro, longDate, romeDateTime } from './labels'
import { LOGO_PNG_BASE64 } from './logo-pdf'
import type { Enrollment } from './types'
import { ACADEMY, contractNumber, withdrawalSentence } from './withdrawal'
import { WITHDRAWAL_DAYS } from './dates'

export interface ContractEdition {
  titolo: string
  sede: string
  giorni: string[]
  orari: string[]
  inizio: string
  fine: string | null
}

export interface ContractSignature {
  ora: Date
  telefono: string
  ip: string
  fine_recesso: string
}

export interface ContractInput {
  corso: string
  row: Enrollment
  edizione: ContractEdition
  quota_esame: number | null
  condizioni: Conditions
  firma: ContractSignature
}

// Solo bianco, nero e grigi: il contratto si stampa e si archivia.
const INK = rgb(0, 0, 0)
const GREY = rgb(0.38, 0.38, 0.38)
const RULE = rgb(0.8, 0.8, 0.8)
const TINT = rgb(0.94, 0.94, 0.94)
const PAGE = { width: 595.28, height: 841.89, margin: 50, top: 84, bottom: 60 }
const WIDTH = PAGE.width - PAGE.margin * 2

/** I font standard del PDF coprono solo i caratteri WinAnsi: gli altri si sostituiscono. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/\t/g, '    ')
    .replace(/[^\n\x20-\x7E -ÿ€]/g, '')
}

type TextOptions = { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number; width?: number }

class Writer {
  private page!: PDFPage
  private y = 0
  readonly pages: PDFPage[] = []

  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    private number: string,
    private signedAt: string,
    private logo: PDFImage
  ) {
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height])
    this.pages.push(this.page)
    this.y = PAGE.height - PAGE.top
    // Intestazione: logo a sinistra, numero e data del contratto a destra, filetto nero.
    const top = PAGE.height - 34
    this.page.drawImage(this.logo, { x: PAGE.margin, y: top - 30, width: 114, height: 30 })
    const right = (text: string, y: number, font: PDFFont, size: number, color = INK) => {
      const safe = pdfSafe(text)
      this.page.drawText(safe, { x: PAGE.width - PAGE.margin - font.widthOfTextAtSize(safe, size), y, size, font, color })
    }
    right(`Contratto di iscrizione n. ${this.number}`, top - 10, this.bold, 9)
    right(`Firmato il ${this.signedAt}`, top - 22, this.regular, 8, GREY)
    this.page.drawLine({
      start: { x: PAGE.margin, y: top - 38 },
      end: { x: PAGE.width - PAGE.margin, y: top - 38 },
      thickness: 0.8,
      color: INK,
    })
  }

  /** Piè di pagina con i dati legali e "Pagina X di Y", scritto alla fine quando si conoscono le pagine. */
  footers() {
    const total = this.pages.length
    const legal = pdfSafe(`${ACADEMY.ragione_sociale} · ${ACADEMY.indirizzo} · P. IVA ${ACADEMY.partita_iva}`)
    this.pages.forEach((page, i) => {
      page.drawLine({ start: { x: PAGE.margin, y: 40 }, end: { x: PAGE.width - PAGE.margin, y: 40 }, thickness: 0.5, color: RULE })
      page.drawText(legal, { x: PAGE.margin, y: 29, size: 7.5, font: this.regular, color: GREY })
      const label = `Pagina ${i + 1} di ${total}`
      page.drawText(label, {
        x: PAGE.width - PAGE.margin - this.regular.widthOfTextAtSize(label, 7.5),
        y: 29,
        size: 7.5,
        font: this.regular,
        color: GREY,
      })
    })
  }

  private ensure(height: number) {
    if (this.y - height < PAGE.bottom) this.newPage()
  }

  space(points: number) {
    this.y -= points
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = []
    for (const paragraph of pdfSafe(text).split('\n')) {
      let line = ''
      for (const word of paragraph.split(/ +/)) {
        const next = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(next, size) <= width) line = next
        else {
          if (line) lines.push(line)
          // Parole più lunghe della riga (es. un IBAN): si spezzano.
          let rest = word
          while (font.widthOfTextAtSize(rest, size) > width) {
            let cut = rest.length - 1
            while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1
            lines.push(rest.slice(0, cut))
            rest = rest.slice(cut)
          }
          line = rest
        }
      }
      lines.push(line)
    }
    return lines
  }

  text(text: string, { size = 9.5, bold = false, color = INK, indent = 0, gap = 3, width }: TextOptions = {}) {
    const font = bold ? this.bold : this.regular
    const lineHeight = size * 1.35
    for (const line of this.wrap(text, font, size, width ?? WIDTH - indent)) {
      this.ensure(lineHeight)
      this.page.drawText(line, { x: PAGE.margin + indent, y: this.y - size, size, font, color })
      this.y -= lineHeight
    }
    this.y -= gap
  }

  /** Titolo d'articolo: "1. Corso ed edizione", con un filetto sotto. */
  article(label: string, title: string) {
    this.ensure(48)
    this.y -= 9
    this.page.drawText(pdfSafe(`${label ? `${label}  ` : ''}${title}`.toUpperCase()), { x: PAGE.margin, y: this.y - 9, size: 9, font: this.bold, color: INK })
    this.y -= 14
    this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 0.6, color: INK })
    this.y -= 3
  }

  /** Tabella "etichetta | valore" con filetti; le righe senza valore si saltano. */
  rows(rows: Array<[string, string | null | undefined]>, labelWidth = 150) {
    for (const [label, value] of rows) {
      if (!value) continue
      const labelLines = this.wrap(label, this.regular, 8.5, labelWidth - 10)
      const lines = this.wrap(value, this.regular, 9.5, WIDTH - labelWidth)
      const height = Math.max(lines.length * 12.5, labelLines.length * 11.5) + 5
      this.ensure(height)
      labelLines.forEach((l, i) =>
        this.page.drawText(l, { x: PAGE.margin, y: this.y - 11 - i * 11.5, size: 8.5, font: this.regular, color: GREY })
      )
      lines.forEach((l, i) =>
        this.page.drawText(l, { x: PAGE.margin + labelWidth, y: this.y - 11 - i * 12.5, size: 9.5, font: this.regular, color: INK })
      )
      this.y -= height
      this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 0.4, color: RULE })
    }
    this.y -= 4
  }

  /** Tabella a più colonne con intestazione (es. i consensi). */
  table(head: string[], widths: number[], body: string[][]) {
    const draw = (cells: string[], header: boolean) => {
      const font = header ? this.bold : this.regular
      const size = header ? 8 : 9
      const wrapped = cells.map((c, i) => this.wrap(c, font, size, widths[i] - 10))
      const height = Math.max(...wrapped.map((w) => w.length)) * (size * 1.35) + 6
      this.ensure(height)
      if (header) {
        this.page.drawRectangle({ x: PAGE.margin, y: this.y - height, width: WIDTH, height, color: TINT })
      }
      let x = PAGE.margin
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) =>
          this.page.drawText(l, { x: x + 5, y: this.y - 4 - size - j * size * 1.35, size, font, color: header ? GREY : INK })
        )
        x += widths[i]
      })
      this.y -= height
      this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 0.4, color: RULE })
    }
    draw(head, true)
    for (const row of body) draw(row, false)
    this.y -= 5
  }

  /** Testo lungo delle condizioni: paragrafi separati da una riga vuota. */
  longText(text: string) {
    for (const paragraph of text.split(/\n{2,}/)) this.text(paragraph, { size: 8, gap: 3 })
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Risposta data a una voce: "Sì (autorizzo...)" o "No". */
function consentValue(voci: Record<string, unknown>, item: ConditionItem): string {
  const entry = voci[item.chiave] as { valore?: unknown } | undefined
  if (!entry) return 'Nessuna risposta'
  if (item.tipo === 'si_no') {
    if (entry.valore === 'si') return `Sì: ${item.etichetta}`
    if (entry.valore === 'no') return `No: ${item.etichetta_no}`
    return 'Nessuna risposta'
  }
  return entry.valore === true ? `Sì: ${item.etichetta}` : 'No'
}

function consentTime(voci: Record<string, unknown>, item: ConditionItem): string {
  const entry = voci[item.chiave] as { ora?: string } | undefined
  if (!entry?.ora) return ''
  // "15/10/2026 12:59", ora italiana: corto per stare in colonna.
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  })
    .format(new Date(entry.ora))
    .replace(',', '')
}

export async function buildContractPdf(input: ContractInput): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { row, edizione: ed, condizioni: c, firma } = input
  const corso = courseTitle(input.corso)
  const numero = contractNumber(row.id, firma.ora)
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`Contratto di iscrizione n. ${numero} - ${corso} - ${row.nome} ${row.cognome}`))
  doc.setAuthor(ACADEMY.ragione_sociale)
  doc.setSubject(pdfSafe(`Iscrizione al corso ${corso}`))
  doc.setCreationDate(firma.ora)
  doc.setModificationDate(firma.ora)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'))
  const w = new Writer(doc, regular, bold, numero, romeDateTime(firma.ora), logo)

  const d = row.dati || {}
  const az = d.azienda && typeof d.azienda === 'object' ? (d.azienda as Record<string, string>) : null
  const consensi = row.consensi || {}
  const voci = (consensi.voci && typeof consensi.voci === 'object' ? consensi.voci : {}) as Record<string, unknown>
  const fullName = `${row.nome} ${row.cognome}`

  w.text('Contratto di iscrizione', { size: 17, bold: true, gap: 1 })
  w.text(`Corso ${corso}`, { size: 12, gap: 6 })

  w.article('1.', 'Accademia')
  w.rows([
    ['Ragione sociale', ACADEMY.ragione_sociale],
    ['Sede', ACADEMY.indirizzo],
    ['Partita IVA', ACADEMY.partita_iva],
    ['PEC', ACADEMY.pec],
  ])

  w.article('2.', 'Persona iscritta')
  w.rows([
    ['Nome e cognome', fullName],
    ['Data e luogo di nascita', str(d.data_nascita) ? `${longDate(str(d.data_nascita))}, ${str(d.luogo_nascita)}` : ''],
    ['Codice fiscale', str(d.codice_fiscale)],
    ['Residenza', str(d.via) ? `${str(d.via)}, ${str(d.cap)} ${str(d.comune)} (${str(d.provincia)})` : ''],
    ['Email e cellulare', [row.email, row.telefono].filter(Boolean).join(' · ')],
    ['Documento di identità', documentLabel(d)],
    ['Copia del documento', d.documenti === 'dopo' ? 'da consegnare dopo la firma' : 'caricata online'],
    [
      'Fattura intestata a',
      az
        ? [
            az.ragione_sociale,
            [az.via, az.cap].filter(Boolean).join(', '),
            `P. IVA ${az.partita_iva}`,
            az.codice_fiscale ? `C.F. ${az.codice_fiscale}` : '',
            az.pec ? `PEC ${az.pec}` : '',
            az.sdi ? `SDI ${az.sdi}` : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : 'persona iscritta',
    ],
  ])

  w.article('3.', 'Corso ed edizione')
  w.rows([
    ['Corso', corso],
    ['Edizione e sede', [ed.titolo, ed.sede].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ')],
    ['Giorni e orari', [ed.giorni.join(' e '), ed.orari.join(', ')].filter(Boolean).join(', ')],
    ['Periodo', ed.fine ? `dal ${longDate(ed.inizio)} al ${longDate(ed.fine)}` : `dal ${longDate(ed.inizio)}`],
  ])

  const total = row.pagamento_totale === null ? null : Number(row.pagamento_totale)
  const rata = row.pagamento_rata === null ? null : Number(row.pagamento_rata)
  const mode = row.pagamento_modalita
  w.article('4.', 'Retta e pagamento')
  w.rows([
    [
      'Retta',
      mode && total !== null
        ? mode === 'unica' || rata === null
          ? `${MODE_LABELS[mode]}, ${euro(total)}`
          : `${MODE_LABELS[mode]} da ${euro(rata)}, totale ${euro(total)}`
        : '',
    ],
    ['Tariffa', row.offerta_open_day ? "prezzo riservato a chi ha partecipato all'open day" : 'prezzo di listino'],
    ["Contributo d'esame", input.quota_esame !== null ? `${euro(input.quota_esame)} IVA inclusa, a parte` : ''],
    ['Inizio dei pagamenti', `primo giorno del corso, ${longDate(ed.inizio)}; alla firma non è dovuto alcun importo`],
  ])

  w.article('5.', 'Diritto di recesso')
  w.text(
    `La persona iscritta può recedere senza alcun costo entro ${WITHDRAWAL_DAYS} giorni dalla firma, cioè entro il ` +
      `${longDate(firma.fine_recesso)} compreso, inviando la dichiarazione "${withdrawalSentence(corso, ed.sede)}" ` +
      `con una di queste modalità: risposta all'email di conferma o email a ${ACADEMY.email}; PEC a ${ACADEMY.pec}; ` +
      `raccomandata a ${ACADEMY.ragione_sociale}, ${ACADEMY.indirizzo}.`
  )

  w.article('6.', 'Consensi')
  w.table(
    ['Voce', 'Risposta', 'Data e ora'],
    [160, WIDTH - 160 - 92, 92],
    c.voci.map((item) => [`${item.titolo}${item.obbligatorio ? '' : ' (facoltativo)'}`, consentValue(voci, item), consentTime(voci, item)])
  )
  w.text(
    `Le condizioni accettate sono riportate integralmente in coda al contratto (versione ${c.versione}, impronta ${c.impronta}).`,
    { size: 8.5, color: GREY }
  )

  w.article('7.', 'Firma elettronica')
  w.rows([
    ['Firmato da', fullName],
    ['Data e ora', `${romeDateTime(firma.ora)} (ora italiana)`],
    [
      'Modalità',
      `codice monouso di 6 cifre inviato via SMS al ${firma.telefono}, dopo la verifica dell'email ${row.email} con un codice`,
    ],
    ['Indirizzo IP', firma.ip],
    ['Riferimento', row.id],
  ])

  // Testi delle condizioni accettate, di seguito e in corpo piccolo.
  const texts = c.voci.filter((item) => item.descrizione || item.testo_completo)
  if (texts.length) {
    w.article('', 'Condizioni accettate')
    for (const item of texts) {
      w.text(item.riferimento ? `${item.titolo} (${item.riferimento})` : item.titolo, { size: 8.5, bold: true, gap: 1 })
      if (item.descrizione) w.longText(item.descrizione)
      if (item.testo_completo) w.longText(item.testo_completo)
      w.space(3)
    }
  }

  w.footers()
  const bytes = await doc.save()
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
}
