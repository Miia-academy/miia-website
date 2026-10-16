/**
 * PDF del contratto, generato alla firma (passo 6). È la copia fedele di ciò che
 * la persona ha visto e accettato: dati, edizione, importi, consensi e testi
 * delle condizioni nella versione accettata, più il blocco della firma.
 *
 * Impaginazione da contratto: intestazione con le parti e il numero del contratto
 * su ogni pagina, articoli numerati, tabelle con filetti, condizioni accettate in
 * allegato, piè di pagina con i dati legali e "Pagina X di Y".
 */
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ConditionItem, Conditions } from './conditions'
import { courseTitle } from './courses'
import { MODE_LABELS, documentLabel, SCOPO_LABELS, euro, longDate, romeDateTime } from './labels'
import {
  AREA_LABELS,
  COMPUTER_LABELS,
  ORE_LABELS,
  SETTORE_LABELS,
  SITUAZIONE_LABELS,
  SOURCE_LABELS,
  TITOLO_LABELS,
} from './profile'
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

const GREEN = rgb(0, 0.549, 0.271)
const GREY = rgb(0.37, 0.39, 0.38)
const RULE = rgb(0.84, 0.85, 0.84)
const TINT = rgb(0.953, 0.953, 0.949)
const INK = rgb(0.118, 0.118, 0.11)
const PAGE = { width: 595.28, height: 841.89, margin: 56, top: 96, bottom: 72 }
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
    private number: string
  ) {
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height])
    this.pages.push(this.page)
    this.y = PAGE.height - PAGE.top
    // Intestazione: accademia a sinistra, numero del contratto a destra, filetto verde.
    const top = PAGE.height - 48
    this.page.drawText('MADE IN ITALY ACADEMY', { x: PAGE.margin, y: top, size: 9, font: this.bold, color: GREEN })
    this.page.drawText(ACADEMY.ragione_sociale, { x: PAGE.margin, y: top - 12, size: 8, font: this.regular, color: GREY })
    const right = pdfSafe(`Contratto di iscrizione n. ${this.number}`)
    this.page.drawText(right, {
      x: PAGE.width - PAGE.margin - this.bold.widthOfTextAtSize(right, 9),
      y: top,
      size: 9,
      font: this.bold,
      color: INK,
    })
    this.page.drawLine({
      start: { x: PAGE.margin, y: top - 22 },
      end: { x: PAGE.width - PAGE.margin, y: top - 22 },
      thickness: 1.2,
      color: GREEN,
    })
  }

  /** Piè di pagina con i dati legali e "Pagina X di Y", scritto alla fine quando si conoscono le pagine. */
  footers() {
    const total = this.pages.length
    const legal = pdfSafe(`${ACADEMY.ragione_sociale} · ${ACADEMY.indirizzo} · P. IVA ${ACADEMY.partita_iva}`)
    this.pages.forEach((page, i) => {
      page.drawLine({ start: { x: PAGE.margin, y: 46 }, end: { x: PAGE.width - PAGE.margin, y: 46 }, thickness: 0.5, color: RULE })
      page.drawText(legal, { x: PAGE.margin, y: 34, size: 7.5, font: this.regular, color: GREY })
      const label = `Pagina ${i + 1} di ${total}`
      page.drawText(label, {
        x: PAGE.width - PAGE.margin - this.regular.widthOfTextAtSize(label, 7.5),
        y: 34,
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

  text(text: string, { size = 10, bold = false, color = INK, indent = 0, gap = 4, width }: TextOptions = {}) {
    const font = bold ? this.bold : this.regular
    const lineHeight = size * 1.4
    for (const line of this.wrap(text, font, size, width ?? WIDTH - indent)) {
      this.ensure(lineHeight)
      this.page.drawText(line, { x: PAGE.margin + indent, y: this.y - size, size, font, color })
      this.y -= lineHeight
    }
    this.y -= gap
  }

  /** Titolo d'articolo: "Art. 3   Corso ed edizione", con un filetto sotto. */
  article(label: string, title: string) {
    this.ensure(64)
    this.y -= 14
    const safeLabel = pdfSafe(label)
    this.page.drawText(safeLabel, { x: PAGE.margin, y: this.y - 11, size: 10, font: this.bold, color: GREEN })
    this.page.drawText(pdfSafe(title), { x: PAGE.margin + 52, y: this.y - 11, size: 11.5, font: this.bold, color: INK })
    this.y -= 19
    this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 0.5, color: RULE })
    this.y -= 8
  }

  /** Tabella "etichetta | valore" con filetti; le righe senza valore si saltano. */
  rows(rows: Array<[string, string | null | undefined]>, labelWidth = 150) {
    for (const [label, value] of rows) {
      if (!value) continue
      const labelLines = this.wrap(label, this.regular, 9, labelWidth - 10)
      const lines = this.wrap(value, this.regular, 10, WIDTH - labelWidth)
      const height = Math.max(lines.length * 14, labelLines.length * 12.6) + 8
      this.ensure(height)
      labelLines.forEach((l, i) =>
        this.page.drawText(l, { x: PAGE.margin, y: this.y - 13 - i * 12.6, size: 9, font: this.regular, color: GREY })
      )
      lines.forEach((l, i) =>
        this.page.drawText(l, { x: PAGE.margin + labelWidth, y: this.y - 13 - i * 14, size: 10, font: this.regular, color: INK })
      )
      this.y -= height
      this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 0.4, color: RULE })
    }
    this.y -= 6
  }

  /** Tabella a più colonne con intestazione (es. i consensi). */
  table(head: string[], widths: number[], body: string[][]) {
    const draw = (cells: string[], header: boolean) => {
      const font = header ? this.bold : this.regular
      const size = header ? 8.5 : 9.5
      const wrapped = cells.map((c, i) => this.wrap(c, font, size, widths[i] - 10))
      const height = Math.max(...wrapped.map((w) => w.length)) * (size * 1.4) + 9
      this.ensure(height)
      if (header) {
        this.page.drawRectangle({ x: PAGE.margin, y: this.y - height, width: WIDTH, height, color: TINT })
      }
      let x = PAGE.margin
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) =>
          this.page.drawText(l, { x: x + 5, y: this.y - 6 - size - j * size * 1.4, size, font, color: header ? GREY : INK })
        )
        x += widths[i]
      })
      this.y -= height
      this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 0.4, color: RULE })
    }
    draw(head, true)
    for (const row of body) draw(row, false)
    this.y -= 8
  }

  /** Riquadro con il bordo verde a sinistra, per la frase del recesso e la firma. */
  callout(lines: Array<{ text: string; bold?: boolean; size?: number }>) {
    const inner = WIDTH - 18
    const wrapped = lines.map((l) => ({ ...l, lines: this.wrap(l.text, l.bold ? this.bold : this.regular, l.size ?? 10, inner) }))
    const height = wrapped.reduce((h, l) => h + l.lines.length * (l.size ?? 10) * 1.45 + 3, 0) + 14
    this.ensure(height)
    this.page.drawRectangle({ x: PAGE.margin, y: this.y - height, width: WIDTH, height, color: TINT })
    this.page.drawRectangle({ x: PAGE.margin, y: this.y - height, width: 3, height, color: GREEN })
    let y = this.y - 9
    for (const l of wrapped) {
      const size = l.size ?? 10
      for (const line of l.lines) {
        this.page.drawText(line, { x: PAGE.margin + 14, y: y - size, size, font: l.bold ? this.bold : this.regular, color: INK })
        y -= size * 1.45
      }
      y -= 3
    }
    this.y -= height + 8
  }

  /** Testo lungo delle condizioni: paragrafi separati da una riga vuota. */
  longText(text: string) {
    for (const paragraph of text.split(/\n{2,}/)) this.text(paragraph, { size: 9, gap: 5 })
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
  const w = new Writer(doc, regular, bold, numero)

  const d = row.dati || {}
  const az = d.azienda && typeof d.azienda === 'object' ? (d.azienda as Record<string, string>) : null
  const p = row.profilo || {}
  const consensi = row.consensi || {}
  const voci = (consensi.voci && typeof consensi.voci === 'object' ? consensi.voci : {}) as Record<string, unknown>
  const fullName = `${row.nome} ${row.cognome}`

  // --- Frontespizio ---
  w.text('CONTRATTO DI ISCRIZIONE', { size: 20, bold: true, gap: 2 })
  w.text(`Corso ${corso}`, { size: 13, color: GREEN, bold: true, gap: 2 })
  w.text(`Contratto n. ${numero} · firmato elettronicamente il ${romeDateTime(firma.ora)}`, { size: 9.5, color: GREY, gap: 14 })
  w.text('Tra', { size: 10, bold: true, gap: 2 })
  w.text(
    `${ACADEMY.ragione_sociale}, con sede in ${ACADEMY.indirizzo}, P. IVA ${ACADEMY.partita_iva}, PEC ${ACADEMY.pec}, ` +
      `di seguito "l'Accademia",`,
    { gap: 4 }
  )
  w.text('e', { size: 10, bold: true, gap: 2 })
  w.text(`${fullName}, i cui dati sono riportati all'art. 1, di seguito "la persona iscritta",`, { gap: 4 })
  w.text('si conviene e si stipula quanto segue.', { gap: 4 })

  // --- Art. 1 ---
  w.article('Art. 1', 'Dati della persona iscritta')
  w.rows([
    ['Nome e cognome', fullName],
    ['Data e luogo di nascita', str(d.data_nascita) ? `${longDate(str(d.data_nascita))}, ${str(d.luogo_nascita)}` : ''],
    ['Codice fiscale', str(d.codice_fiscale)],
    ['Residenza', str(d.via) ? `${str(d.via)}, ${str(d.cap)} ${str(d.comune)} (${str(d.provincia)})` : ''],
    ['Email', row.email],
    ['Cellulare', row.telefono],
    ['Documento di identità', documentLabel(d)],
    ['Copia del documento', d.documenti === 'dopo' ? 'da consegnare dopo la firma' : 'caricata online'],
  ])

  // --- Art. 2 ---
  w.article('Art. 2', 'Intestazione della fattura')
  if (az) {
    w.rows([
      ['Ragione sociale', az.ragione_sociale],
      ['Indirizzo', [az.via, az.cap].filter(Boolean).join(', ')],
      ['Partita IVA', az.partita_iva],
      ['Codice fiscale', az.codice_fiscale],
      ['PEC', az.pec],
      ['Codice destinatario (SDI)', az.sdi],
    ])
  } else {
    w.text("La fattura è intestata alla persona iscritta, con i dati dell'art. 1.")
  }

  // --- Art. 3 ---
  w.article('Art. 3', 'Corso ed edizione')
  w.rows([
    ['Corso', corso],
    ['Edizione', ed.titolo || ed.sede],
    ['Sede', ed.sede],
    ['Giorni e orari', [ed.giorni.join(' e '), ed.orari.join(', ')].filter(Boolean).join(', ')],
    ['Data di inizio', longDate(ed.inizio)],
    ['Data di fine prevista', ed.fine ? longDate(ed.fine) : ''],
    ['Obiettivo dichiarato', SCOPO_LABELS[str(p.scopo)] || ''],
  ])

  // --- Art. 4 ---
  const total = row.pagamento_totale === null ? null : Number(row.pagamento_totale)
  const rata = row.pagamento_rata === null ? null : Number(row.pagamento_rata)
  const mode = row.pagamento_modalita
  w.article('Art. 4', 'Retta e modalità di pagamento')
  w.rows([
    ['Modalità scelta', mode ? MODE_LABELS[mode] : ''],
    ['Importo di ogni rata', mode && mode !== 'unica' && rata !== null ? euro(rata) : ''],
    ['Totale della retta', total !== null ? euro(total) : ''],
    ['Tariffa applicata', row.offerta_open_day ? "Prezzo riservato a chi ha partecipato all'open day" : 'Prezzo di listino'],
    ["Contributo d'esame", input.quota_esame !== null ? `${euro(input.quota_esame)} IVA inclusa, a parte` : ''],
  ])
  w.text('Alla firma del presente contratto non è dovuto alcun pagamento.', { size: 9.5, color: GREY })

  // --- Art. 5 ---
  w.article('Art. 5', 'Diritto di recesso')
  w.text(
    `La persona iscritta può recedere dal contratto senza alcun costo entro ${WITHDRAWAL_DAYS} giorni dalla firma, ` +
      `cioè entro il ${longDate(firma.fine_recesso)} compreso. Per recedere è sufficiente inviare la seguente dichiarazione:`,
    { gap: 6 }
  )
  w.callout([{ text: `"${withdrawalSentence(corso, ed.sede)}"`, bold: true }])
  w.text('La dichiarazione può essere inviata con una delle seguenti modalità:', { gap: 2 })
  w.text(`- risposta all'email di conferma dell'iscrizione, oppure email a ${ACADEMY.email};`, { indent: 10, gap: 1 })
  w.text(`- posta elettronica certificata (PEC) a ${ACADEMY.pec};`, { indent: 10, gap: 1 })
  w.text(`- raccomandata a ${ACADEMY.ragione_sociale}, ${ACADEMY.indirizzo}.`, { indent: 10, gap: 4 })

  // --- Art. 6 ---
  w.article('Art. 6', 'Consensi espressi')
  w.table(
    ['Voce', 'Risposta', 'Data e ora'],
    [150, WIDTH - 150 - 120, 120],
    c.voci.map((item) => [`${item.titolo}${item.obbligatorio ? '' : ' (facoltativo)'}`, consentValue(voci, item), consentTime(voci, item)])
  )

  // --- Art. 7 ---
  w.article('Art. 7', 'Condizioni generali')
  w.text(
    `La persona iscritta dichiara di aver letto e accettato le condizioni riportate nell'Allegato A, ` +
      `nella versione ${c.versione} (impronta ${c.impronta}), mostrate prima della firma.`
  )

  // --- Art. 8 ---
  w.article('Art. 8', 'Sottoscrizione con firma elettronica')
  w.rows(
    [
      ['Firmato da', fullName],
      ['Data e ora', `${romeDateTime(firma.ora)} (ora italiana)`],
      [
        'Modalità',
        `Codice monouso di 6 cifre inviato via SMS al numero ${firma.telefono}, ` +
          `dopo la verifica dell'indirizzo email ${row.email} con un codice inviato per email.`,
      ],
      ['Indirizzo IP', firma.ip],
      ['Riferimento iscrizione', row.id],
    ],
    150
  )

  // --- Allegato A: testi delle condizioni ---
  const texts = c.voci.filter((item) => item.descrizione || item.testo_completo)
  if (texts.length) {
    w.newPage()
    w.text('ALLEGATO A', { size: 10, bold: true, color: GREEN, gap: 2 })
    w.text('Testi delle condizioni accettate', { size: 15, bold: true, gap: 2 })
    w.text(`Versione ${c.versione}, impronta ${c.impronta}.`, { size: 9, color: GREY, gap: 6 })
    texts.forEach((item, i) => {
      w.article(`A.${i + 1}`, item.riferimento ? `${item.titolo} (${item.riferimento})` : item.titolo)
      if (item.descrizione) w.longText(item.descrizione)
      if (item.testo_completo) w.longText(item.testo_completo)
    })
  }

  // --- Allegato B: profilo facoltativo ---
  if (p.saltato !== true && Object.keys(p).some((k) => k !== 'scopo' && k !== 'saltato')) {
    const sources = Array.isArray(p.come_ci_hai_conosciuto) ? (p.come_ci_hai_conosciuto as string[]) : []
    const label = (labels: Record<string, string>, v: unknown) => labels[str(v)] || ''
    w.newPage()
    w.text('ALLEGATO B', { size: 10, bold: true, color: GREEN, gap: 2 })
    w.text('Profilo della persona iscritta', { size: 15, bold: true, gap: 2 })
    w.text('Informazioni facoltative date durante l\'iscrizione. Non fanno parte delle condizioni contrattuali.', {
      size: 9,
      color: GREY,
      gap: 8,
    })
    w.rows([
      ['Titolo di studi', [label(TITOLO_LABELS, p.titolo_studi), str(p.anno_studi)].filter(Boolean).join(', ')],
      ['Area di studio', label(AREA_LABELS, p.area_studi)],
      ['Scuola o università', str(p.istituto)],
      ['Ultima formazione', [str(p.ultima_formazione), str(p.anno_formazione)].filter(Boolean).join(', ')],
      ['Situazione lavorativa', label(SITUAZIONE_LABELS, p.situazione_lavoro)],
      ['Settore', label(SETTORE_LABELS, p.settore)],
      ['Azienda e ruolo', [str(p.azienda), str(p.ruolo)].filter(Boolean).join(', ')],
      ['Ore a settimana', label(ORE_LABELS, p.ore_settimana)],
      ['Uso del computer', label(COMPUTER_LABELS, p.computer)],
      ['Come ci ha conosciuto', sources.map((s) => label(SOURCE_LABELS, s) || s).join(', ')],
    ])
  }

  w.footers()
  const bytes = await doc.save()
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
}
