import { GetServerSideProps } from 'next'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import { getJwtSecret } from '@modules/jwt-secret'
import { Button } from '@components/ui/button'
import { listSignedEnrollments, type SignedEnrollmentRow } from '@modules/enrollment/db'
import { courseTitle } from '@modules/enrollment/courses'
import { romeDate } from '@modules/enrollment/dates'
import { MODE_LABELS, euro } from '@modules/enrollment/labels'
import { CHANNEL_LABELS, REQUEST_CHANNELS, STATUS_CHANGES, type TargetStatus } from '@modules/enrollment/status'

const ACTIONS: { stato: TargetStatus; label: string; spiega: string }[] = [
  { stato: 'recesso', label: 'Recesso', spiega: 'Entro i 14 giorni, solo per iscritto. La persona esce dalle automazioni dell’iscrizione e il posto si libera.' },
  { stato: 'annullata', label: 'Annulla', spiega: 'Fuori dal recesso, o deciso dall’accademia. La persona esce dalle automazioni dell’iscrizione e il posto si libera.' },
  { stato: 'definitiva', label: 'Definitiva', spiega: 'Recesso scaduto e iscrizione confermata.' },
]

const ACTIVE = ['firmata', 'definitiva']

const date = (value: string | null) =>
  value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('it-IT') : ''

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)
}

/** Dove si trova il recesso per un'iscrizione firmata. */
function withdrawalNote(row: SignedEnrollmentRow, today: string): string {
  if (row.stato !== 'firmata' || !row.fine_recesso) return ''
  const left = daysBetween(today, row.fine_recesso)
  if (left < 0) return 'recesso scaduto: da segnare definitiva'
  return left === 0 ? 'ultimo giorno di recesso' : `recesso: ancora ${left} giorni`
}

function Summary({ rows, today }: { rows: SignedEnrollmentRow[]; today: string }) {
  const s = useMemo(() => {
    const active = rows.filter((r) => ACTIVE.includes(r.stato))
    const inWindow = rows.filter((r) => r.stato === 'firmata' && r.fine_recesso && r.fine_recesso >= today).length
    const value = active.reduce((sum, r) => sum + Number(r.pagamento_totale || 0), 0)
    const byMode: Record<string, number> = {}
    const byCourse: Record<string, { n: number; value: number }> = {}
    for (const r of active) {
      const mode = r.pagamento_modalita ? MODE_LABELS[r.pagamento_modalita] : 'non indicata'
      byMode[mode] = (byMode[mode] || 0) + 1
      const key = `${courseTitle(r.corso)}${r.sede ? ` – ${r.sede}` : ''}`
      byCourse[key] = { n: (byCourse[key]?.n || 0) + 1, value: (byCourse[key]?.value || 0) + Number(r.pagamento_totale || 0) }
    }
    const count = (stato: string) => rows.filter((r) => r.stato === stato).length
    return {
      active: active.length,
      inWindow,
      toConfirm: rows.filter((r) => r.stato === 'firmata' && r.fine_recesso && r.fine_recesso < today).length,
      definitive: count('definitiva'),
      recessi: count('recesso'),
      annullate: count('annullata'),
      offerta: active.filter((r) => r.offerta_open_day).length,
      value,
      byMode,
      byCourse,
    }
  }, [rows, today])

  const tile = (label: string, value: React.ReactNode, hint?: string) => (
    <div className="rounded border border-neutral-200 bg-white p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  )

  return (
    <section className="space-y-4" aria-label="Riepilogo">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile('Iscritti', s.active, `${s.definitive} definitive, ${s.inWindow} nel recesso`)}
        {tile('Valore di massima', euro(s.value), 'totali firmati e definitivi, esame escluso')}
        {tile('Recessi e annullate', `${s.recessi} + ${s.annullate}`)}
        {tile('Da segnare definitive', s.toConfirm, 'recesso scaduto')}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-neutral-200 bg-white p-4 text-sm">
          <div className="mb-2 font-medium">Per corso e sede</div>
          {Object.entries(s.byCourse).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-0.5">
              <span>{k}</span>
              <span className="text-neutral-600">
                {v.n} · {euro(v.value)}
              </span>
            </div>
          ))}
          {!s.active && <div className="text-neutral-500">Nessun iscritto.</div>}
        </div>
        <div className="rounded border border-neutral-200 bg-white p-4 text-sm">
          <div className="mb-2 font-medium">Pagamento</div>
          {Object.entries(s.byMode).map(([k, n]) => (
            <div key={k} className="flex justify-between py-0.5">
              <span>{k}</span>
              <span className="text-neutral-600">{n}</span>
            </div>
          ))}
          <div className="flex justify-between py-0.5">
            <span>con l’offerta open day</span>
            <span className="text-neutral-600">{s.offerta}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function ChangeForm({
  row,
  action,
  today,
  onDone,
  onCancel,
}: {
  row: SignedEnrollmentRow
  action: (typeof ACTIONS)[number]
  today: string
  onDone: (stato: SignedEnrollmentRow['stato']) => void
  onCancel: () => void
}) {
  const channels = REQUEST_CHANNELS[action.stato] as readonly string[]
  const [canale, setCanale] = useState(channels[0] || '')
  const [data, setData] = useState(today)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/iscrizione-stato', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, stato: action.stato, canale, data, nota }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Errore')
      onDone(body.stato)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded bg-neutral-50 p-4">
      <p className="text-sm">
        <strong>{action.label}</strong>: {action.spiega}
      </p>
      {channels.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col gap-1">
            Come è arrivata la richiesta
            <select className="rounded border border-neutral-300 p-2" value={canale} onChange={(e) => setCanale(e.target.value)}>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Giorno della richiesta {canale === 'raccomandata' && '(data di spedizione)'}
            <input type="date" max={today} className="rounded border border-neutral-300 p-2" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Nota per il registro (facoltativa)
        <input className="rounded border border-neutral-300 p-2" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} />
      </label>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" color="dark" isLoading={busy}>
          Conferma {action.label.toLowerCase()}
        </Button>
        <Button size="sm" variant="light" onPress={onCancel}>
          Lascia stare
        </Button>
      </div>
    </form>
  )
}

export default function AdminEnrollments({ rows, today }: { rows: SignedEnrollmentRow[]; today: string }) {
  const [list, setList] = useState(rows)
  const [open, setOpen] = useState<{ id: string; stato: TargetStatus } | null>(null)

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin/profilo" className="text-sm text-neutral-500 underline">
            Pannello operativo
          </Link>
          <h1 className="type-title-3 mt-2 tracking-tight text-neutral-900">Iscrizioni</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Quando arriva una richiesta di recesso (email a iscrizione@miia.it, PEC o raccomandata), rispondi alla persona e
            poi segnala qui: la pagina controlla i 14 giorni, e database e Brevo si aggiornano insieme.
          </p>
        </div>

        <Summary rows={list} today={today} />

        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 text-neutral-600">
              <tr>
                <th className="p-3">Persona</th>
                <th className="p-3">Corso</th>
                <th className="p-3">Pagamento</th>
                <th className="p-3">Firmata</th>
                <th className="p-3">Stato</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => {
                const action = open?.id === row.id ? ACTIONS.find((a) => a.stato === open.stato) : undefined
                return (
                  <React.Fragment key={row.id}>
                    <tr className="border-t border-neutral-100 align-top">
                      <td className="p-3">
                        <div className="font-medium">{[row.nome, row.cognome].filter(Boolean).join(' ')}</div>
                        <div className="text-neutral-500">{row.email}</div>
                      </td>
                      <td className="p-3">
                        {courseTitle(row.corso)}
                        {row.sede && <div className="text-neutral-500">{row.sede}</div>}
                      </td>
                      <td className="p-3">
                        {row.pagamento_totale ? euro(Number(row.pagamento_totale)) : ''}
                        <div className="text-neutral-500">
                          {row.pagamento_modalita ? MODE_LABELS[row.pagamento_modalita] : ''}
                          {row.offerta_open_day ? ' · open day' : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        {date(row.firmata_il)}
                        <div className="text-neutral-500">{withdrawalNote(row, today)}</div>
                      </td>
                      <td className="p-3 font-medium">{row.stato}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {ACTIONS.filter(
                            (a) =>
                              (STATUS_CHANGES[a.stato] as readonly string[]).includes(row.stato) &&
                              // Definitiva solo a recesso chiuso
                              (a.stato !== 'definitiva' || !row.fine_recesso || row.fine_recesso < today)
                          ).map((a) => (
                            <Button key={a.stato} size="sm" variant="bordered" onPress={() => setOpen({ id: row.id, stato: a.stato })}>
                              {a.label}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {action && (
                      <tr>
                        <td colSpan={6} className="px-3 pb-3">
                          <ChangeForm
                            row={row}
                            action={action}
                            today={today}
                            onCancel={() => setOpen(null)}
                            onDone={(stato) => {
                              setList((all) => all.map((r) => (r.id === row.id ? { ...r, stato } : r)))
                              setOpen(null)
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {!list.length && (
                <tr>
                  <td className="p-3 text-neutral-500" colSpan={6}>
                    Nessuna iscrizione firmata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']
  if (!token) return { redirect: { destination: '/admin/login', permanent: false } }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload
    if (decoded.tipo_utente !== 'Admin') return { redirect: { destination: '/', permanent: false } }
  } catch {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }
  const rows = await listSignedEnrollments()
  return { props: { rows: JSON.parse(JSON.stringify(rows)), today: romeDate() } }
}
