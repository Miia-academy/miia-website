import { GetServerSideProps } from 'next'
import Link from 'next/link'
import React, { useState } from 'react'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import { getJwtSecret } from '@modules/jwt-secret'
import { Button } from '@components/ui/button'
import { listSignedEnrollments, type SignedEnrollmentRow } from '@modules/enrollment/db'
import { courseTitle } from '@modules/enrollment/courses'
import { romeDate } from '@modules/enrollment/dates'
import { STATUS_CHANGES, type TargetStatus } from '@modules/enrollment/status'

const ACTIONS: { stato: TargetStatus; label: string; conferma: string }[] = [
  { stato: 'recesso', label: 'Recesso', conferma: 'Segno il recesso? La persona esce dalle automazioni dell’iscrizione e il posto si libera.' },
  { stato: 'annullata', label: 'Annulla', conferma: 'Annullo l’iscrizione? La persona esce dalle automazioni dell’iscrizione e il posto si libera.' },
  { stato: 'definitiva', label: 'Definitiva', conferma: 'Segno l’iscrizione come definitiva?' },
]

const date = (value: string | null) => (value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('it-IT') : '')

export default function AdminEnrollments({ rows, today }: { rows: SignedEnrollmentRow[]; today: string }) {
  const [list, setList] = useState(rows)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function change(row: SignedEnrollmentRow, action: (typeof ACTIONS)[number]) {
    if (!window.confirm(`${action.conferma}\n\n${row.nome || ''} ${row.cognome || ''} – ${courseTitle(row.corso)}`)) return
    const nota = window.prompt('Nota per il registro (facoltativa), es. "email del 5/11"') || ''
    setBusy(row.id)
    setError('')
    try {
      const res = await fetch('/api/admin/iscrizione-stato', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, stato: action.stato, nota }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Errore')
      setList((all) => all.map((r) => (r.id === row.id ? { ...r, stato: data.stato } : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin/profilo" className="text-sm text-neutral-500 underline">
            Pannello operativo
          </Link>
          <h1 className="type-title-3 mt-2 tracking-tight text-neutral-900">Iscrizioni firmate</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Quando arriva una richiesta di recesso o di annullamento (email a iscrizione@miia.it, PEC o raccomandata),
            rispondi alla persona e poi segnala qui: database e Brevo si aggiornano insieme.
          </p>
        </div>
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 text-neutral-600">
              <tr>
                <th className="p-3">Persona</th>
                <th className="p-3">Corso</th>
                <th className="p-3">Firmata</th>
                <th className="p-3">Recesso fino al</th>
                <th className="p-3">Stato</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100 align-top">
                  <td className="p-3">
                    <div className="font-medium">{[row.nome, row.cognome].filter(Boolean).join(' ')}</div>
                    <div className="text-neutral-500">{row.email}</div>
                  </td>
                  <td className="p-3">
                    {courseTitle(row.corso)}
                    {row.sede && <div className="text-neutral-500">{row.sede}</div>}
                  </td>
                  <td className="p-3">{date(row.firmata_il)}</td>
                  <td className={`p-3 ${row.fine_recesso && row.fine_recesso < today ? 'text-neutral-400' : ''}`}>
                    {date(row.fine_recesso)}
                  </td>
                  <td className="p-3 font-medium">{row.stato}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {ACTIONS.filter((a) => (STATUS_CHANGES[a.stato] as readonly string[]).includes(row.stato)).map((a) => (
                        <Button key={a.stato} size="sm" variant="bordered" isDisabled={busy === row.id} onPress={() => change(row, a)}>
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
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
