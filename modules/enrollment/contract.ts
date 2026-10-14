/**
 * PDF del contratto, generato alla firma (passo 6). È la copia fedele di ciò che
 * la persona ha visto e accettato: dati, edizione, importi, consensi e testi
 * delle condizioni nella versione accettata, più il blocco della firma.
 */
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ConditionItem, Conditions } from './conditions'
import { DOCUMENT_LABELS, MODE_LABELS, SCOPO_LABELS, euro, longDate, romeDateTime } from './labels'
import { COMPUTER_LABELS, ORE_LABELS, SOURCE_LABELS, TITOLO_LABELS } from './profile'
import type { Enrollment } from './types'

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
const GREY = rgb(0.4, 0.4, 0.4)
const INK = rgb(0.137, 0.137, 0.145)
const PAGE = { width: 595.28, height: 841.89, margin: 56 }

/** I font standard del PDF coprono solo i caratteri WinAnsi: gli altri si sostituiscono. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/\t/g, '    ')
    .replace(/[^\n\x20-\x7E -ÿ€]/g, '')
}

class Writer {
  private page!: PDFPage
  private y = 0
  private count = 0
  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    private footer: string
  ) {
    this.newPage()
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height])
    this.count += 1
    this.y = PAGE.height - PAGE.margin
    this.page.drawText(pdfSafe(`${this.footer} · pagina ${this.count}`), {
      x: PAGE.margin,
      y: PAGE.margin / 2,
      size: 8,
      font: this.regular,
      color: GREY,
    })
  }

  private ensure(height: number) {
    if (this.y - height < PAGE.margin) this.newPage()
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
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

  text(text: string, { size = 10, bold = false, color = INK, indent = 0, gap = 4 } = {}) {
    const font = bold ? this.bold : this.regular
    const width = PAGE.width - PAGE.margin * 2 - indent
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(size + 3)
      this.page.drawText(line, { x: PAGE.margin + indent, y: this.y - size, size, font, color })
      this.y -= size + 3
    }
    this.y -= gap
  }

  heading(text: string) {
    this.ensure(40)
    this.y -= 10
    this.text(text, { size: 13, bold: true, color: GREEN, gap: 6 })
  }

  /** Righe "etichetta: valore"; quelle senza valore si saltano. */
  rows(rows: Array<[string, string | null | undefined]>) {
    for (const [label, value] of rows) {
      if (!value) continue
      const labelWidth = 150
      const lines = this.wrap(value, this.regular, 10, PAGE.width - PAGE.margin * 2 - labelWidth)
      this.ensure(13 * lines.length)
      this.page.drawText(pdfSafe(label), { x: PAGE.margin, y: this.y - 10, size: 10, font: this.regular, color: GREY })
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.margin + labelWidth, y: this.y - 10, size: 10, font: this.regular, color: INK })
        this.y -= 13
      }
      this.y -= 2
    }
  }

  /** Testo lungo delle condizioni: paragrafi separati da una riga vuota. */
  longText(text: string) {
    for (const paragraph of text.split(/\n{2,}/)) this.text(paragraph, { size: 9, gap: 6 })
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Risposta data a una voce, con l'ora: "Sì, il 14 ottobre 2026 alle 10:30". */
function consentAnswer(voci: Record<string, unknown>, item: ConditionItem): string {
  const entry = voci[item.chiave] as { valore?: unknown; ora?: string } | undefined
  if (!entry) return 'nessuna risposta'
  const value =
    item.tipo === 'si_no'
      ? entry.valore === 'si'
        ? `Sì (${item.etichetta})`
        : entry.valore === 'no'
          ? `No (${item.etichetta_no})`
          : 'nessuna risposta'
      : entry.valore === true
        ? 'Sì'
        : 'No'
  return entry.ora ? `${value}, il ${romeDateTime(new Date(entry.ora))}` : value
}

export function courseName(corso: string): string {
  const name = corso.replace(/^corso-/, '').replace(/-/g, ' ')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export async function buildContractPdf(input: ContractInput): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { row, edizione: ed, condizioni: c, firma } = input
  const doc = await PDFDocument.create()
  doc.setTitle(`Iscrizione ${courseName(input.corso)} - ${row.nome} ${row.cognome}`)
  doc.setAuthor('Made in Italy Academy')
  doc.setCreationDate(firma.ora)
  doc.setModificationDate(firma.ora)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const w = new Writer(doc, regular, bold, `Iscrizione ${row.id}`)

  const d = row.dati || {}
  const az = d.azienda && typeof d.azienda === 'object' ? (d.azienda as Record<string, string>) : null
  const p = row.profilo || {}
  const consensi = row.consensi || {}

  w.text('Made in Italy Academy', { size: 10, bold: true, color: GREEN })
  w.text(`Iscrizione al corso ${courseName(input.corso)}`, { size: 18, bold: true, gap: 2 })
  w.text(`Contratto firmato elettronicamente il ${romeDateTime(firma.ora)}`, { size: 10, color: GREY, gap: 10 })

  w.heading('Dati della persona iscritta')
  w.rows([
    ['Nome e cognome', `${row.nome} ${row.cognome}`],
    ['Nascita', str(d.data_nascita) ? `${longDate(str(d.data_nascita))}, ${str(d.luogo_nascita)}` : ''],
    ['Codice fiscale', str(d.codice_fiscale)],
    ['Residenza', str(d.via) ? `${str(d.via)}, ${str(d.cap)} ${str(d.comune)} (${str(d.provincia)})` : ''],
    ['Email', row.email],
    ['Cellulare', row.telefono],
    ['Documento', str(d.documento_tipo) ? `${DOCUMENT_LABELS[str(d.documento_tipo)] || str(d.documento_tipo)} n. ${str(d.documento_numero)}` : ''],
    ['Foto dei documenti', d.documenti === 'dopo' ? 'da caricare dopo la firma' : 'caricate'],
  ])
  if (az) {
    w.heading('Fatturazione')
    w.rows([
      ['Ragione sociale', az.ragione_sociale],
      ['Indirizzo', `${az.via}, ${az.cap}`],
      ['Partita IVA', az.partita_iva],
      ['Codice fiscale', az.codice_fiscale],
      ['PEC', az.pec],
      ['Codice SDI', az.sdi],
    ])
  }

  w.heading('Corso ed edizione')
  w.rows([
    ['Corso', courseName(input.corso)],
    ['Edizione', ed.titolo || ed.sede],
    ['Sede', ed.sede],
    ['Giorni e orari', [ed.giorni.join(' e '), ed.orari.join(', ')].filter(Boolean).join(', ')],
    ['Inizio', longDate(ed.inizio)],
    ['Fine', ed.fine ? longDate(ed.fine) : ''],
    ['Cosa ti aspetti', SCOPO_LABELS[str(p.scopo)] || ''],
  ])

  const total = row.pagamento_totale === null ? null : Number(row.pagamento_totale)
  const rata = row.pagamento_rata === null ? null : Number(row.pagamento_rata)
  w.heading('Retta e pagamento')
  w.rows([
    ['Modalità', row.pagamento_modalita ? MODE_LABELS[row.pagamento_modalita] : ''],
    ['Importo della rata', row.pagamento_modalita !== 'unica' && rata !== null ? euro(rata) : ''],
    ['Totale della retta', total !== null ? euro(total) : ''],
    ['Prezzo', row.offerta_open_day ? 'Prezzo open day' : 'Prezzo di listino'],
    ["Contributo d'esame", input.quota_esame !== null ? euro(input.quota_esame) : ''],
  ])

  if (p.saltato !== true && Object.keys(p).some((k) => k !== 'scopo')) {
    const sources = Array.isArray(p.come_ci_hai_conosciuto) ? (p.come_ci_hai_conosciuto as string[]) : []
    w.heading('Profilo (facoltativo)')
    w.rows([
      ['Titolo di studi', [TITOLO_LABELS[str(p.titolo_studi) as keyof typeof TITOLO_LABELS], str(p.anno_studi)].filter(Boolean).join(', ')],
      ['Ultima formazione', [str(p.ultima_formazione), str(p.anno_formazione)].filter(Boolean).join(', ')],
      ['Lavoro', p.non_lavoro ? 'Non lavora ancora' : [str(p.occupazione), str(p.ruolo)].filter(Boolean).join(', ')],
      ['Ore a settimana', ORE_LABELS[str(p.ore_settimana) as keyof typeof ORE_LABELS]],
      ['Computer', COMPUTER_LABELS[str(p.computer) as keyof typeof COMPUTER_LABELS]],
      ['Come ci ha conosciuto', sources.map((s) => SOURCE_LABELS[s as keyof typeof SOURCE_LABELS] || s).join(', ')],
    ])
  }

  w.heading('Consensi')
  const voci = (consensi.voci && typeof consensi.voci === 'object' ? consensi.voci : {}) as Record<string, unknown>
  for (const item of c.voci) {
    w.text(`${item.titolo}${item.obbligatorio ? '' : ' (facoltativo)'}`, { bold: true, gap: 1 })
    if (item.tipo === 'spunta') w.text(`"${item.etichetta}"`, { size: 9, color: GREY, gap: 1 })
    w.text(consentAnswer(voci, item), { gap: 6 })
  }
  w.text(`Versione dei testi: ${c.versione} (impronta ${c.impronta})`, { size: 9, color: GREY })

  w.heading('Firma elettronica')
  w.text(
    `Firmato il ${romeDateTime(firma.ora)} inserendo il codice di 6 cifre inviato via SMS al numero ${firma.telefono}, ` +
      `dopo la verifica dell'indirizzo email ${row.email}. Indirizzo IP: ${firma.ip}.`
  )
  w.text(`Diritto di recesso: si può annullare l'iscrizione senza costi fino al ${longDate(firma.fine_recesso)} compreso.`, { bold: true })

  // Testi accettati, nella versione mostrata alla persona.
  for (const item of c.voci) {
    if (!item.descrizione && !item.testo_completo) continue
    w.heading(item.riferimento ? `${item.titolo} (${item.riferimento})` : item.titolo)
    if (item.descrizione) w.longText(item.descrizione)
    if (item.testo_completo) w.longText(item.testo_completo)
  }

  const bytes = await doc.save()
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
}
