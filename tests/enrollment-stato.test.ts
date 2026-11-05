import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/brevo', () => ({ upsertContact: vi.fn(), trackEvent: vi.fn() }))
vi.mock('@modules/enrollment/db', () => ({ updateEnrollmentStatus: vi.fn(), logEvent: vi.fn(), getEnrollmentById: vi.fn() }))

import { trackEvent, upsertContact } from '@modules/brevo'
import * as db from '@modules/enrollment/db'
import { ENROLLED_LIST_ID, syncStatusChange } from '@modules/enrollment/brevo-sync'
import { STATUS_CHANGES, changeStatus, checkRequest, isTargetStatus } from '@modules/enrollment/status'
import type { Enrollment } from '@modules/enrollment/types'

const ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'test+iscrizione@miia.it',
  corso: 'corso-interior-design-primo-livello',
  stato: 'recesso',
} as Enrollment

/** Firmata il 20/10 (in Italia), recesso fino al 3/11. */
const SIGNED = { ...ROW, stato: 'firmata', firmata_il: '2026-10-20T08:00:00Z', fine_recesso: '2026-11-03' } as Enrollment
const OK = { canale: 'email', data: '2026-11-02' }

beforeEach(() => {
  vi.mocked(upsertContact).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(trackEvent).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(db.updateEnrollmentStatus).mockReset()
  vi.mocked(db.logEvent).mockReset()
  vi.mocked(db.getEnrollmentById).mockReset().mockResolvedValue(SIGNED)
})

describe('stato dopo la firma', () => {
  it('ammette solo i passaggi previsti', () => {
    expect(STATUS_CHANGES.recesso).toEqual(['firmata'])
    expect(STATUS_CHANGES.annullata).toEqual(['firmata', 'definitiva'])
    expect(isTargetStatus('definitiva')).toBe(true)
    expect(isTargetStatus('bozza')).toBe(false)
    expect(isTargetStatus('toString')).toBe(false)
  })

  it('recesso: stato in Brevo, fuori dalla lista 18 e evento di annullamento', async () => {
    await syncStatusChange(ROW, 'recesso')
    expect(vi.mocked(upsertContact).mock.calls[0][0]).toEqual({
      email: ROW.email,
      attributes: { ISCRIZIONE_STATO: 3 },
      unlinkListIds: [ENROLLED_LIST_ID],
    })
    expect(vi.mocked(trackEvent).mock.calls[0][0]).toEqual({
      eventName: 'submit_cancellation_form',
      email: ROW.email,
      properties: { corso: 'corso-interior-design-primo-livello' },
    })
  })

  it('definitiva: solo lo stato, nessun evento', async () => {
    await syncStatusChange(ROW, 'definitiva')
    expect(vi.mocked(upsertContact).mock.calls[0][0]).toMatchObject({ attributes: { ISCRIZIONE_STATO: 4 }, unlinkListIds: undefined })
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('cambio non ammesso dallo stato attuale: nessuna scrittura', async () => {
    vi.mocked(db.getEnrollmentById).mockResolvedValue({ ...SIGNED, stato: 'recesso' })
    const result = await changeStatus(ROW.id, 'recesso', 'admin@miia.it', OK)
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(db.updateEnrollmentStatus).not.toHaveBeenCalled()
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('se Brevo non risponde il cambio resta e il registro lo segna', async () => {
    vi.mocked(db.updateEnrollmentStatus).mockResolvedValue(ROW)
    vi.mocked(upsertContact).mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await changeStatus(ROW.id, 'recesso', 'admin@miia.it', { ...OK, nota: 'risposta inviata' })
    expect(result.ok).toBe(true)
    expect(db.updateEnrollmentStatus).toHaveBeenCalledWith(ROW.id, ['firmata'], 'recesso')
    expect(db.logEvent).toHaveBeenCalledWith(ROW.id, 'recesso', null, null, {
      da: 'admin@miia.it',
      canale: 'email',
      data_richiesta: '2026-11-02',
      nota: 'risposta inviata',
      brevo: false,
    })
  })
})

describe('tempi e modalità della richiesta', () => {
  const today = '2026-11-05'
  it('recesso entro i 14 giorni, per iscritto', () => {
    expect(checkRequest(SIGNED, 'recesso', OK, today)).toBeNull()
    expect(checkRequest(SIGNED, 'recesso', { canale: 'pec', data: '2026-11-03' }, today)).toBeNull()
  })
  it('recesso fuori tempo: suggerisce l’annullamento', () => {
    expect(checkRequest(SIGNED, 'recesso', { canale: 'email', data: '2026-11-04' }, today)).toMatch(/fuori dai 14 giorni.*03\/11\/2026.*Annulla/)
    expect(checkRequest(SIGNED, 'annullata', { canale: 'email', data: '2026-11-04' }, today)).toBeNull()
  })
  it('canale e giorno obbligatori e sensati', () => {
    expect(checkRequest(SIGNED, 'recesso', { canale: 'accademia', data: '2026-11-02' }, today)).toMatch(/come è arrivata/)
    expect(checkRequest(SIGNED, 'annullata', { canale: 'accademia', data: '2026-11-02' }, today)).toBeNull()
    expect(checkRequest(SIGNED, 'recesso', { canale: 'email' }, today)).toMatch(/giorno/)
    expect(checkRequest(SIGNED, 'recesso', { canale: 'email', data: '2026-11-06' }, today)).toMatch(/futuro/)
    expect(checkRequest(SIGNED, 'recesso', { canale: 'email', data: '2026-10-19' }, today)).toMatch(/prima della firma/)
  })
  it('definitiva senza richiesta', () => {
    expect(checkRequest(SIGNED, 'definitiva', {}, today)).toBeNull()
    expect(checkRequest(SIGNED, 'definitiva', {}, '2026-11-03')).toMatch(/recesso è aperto/)
    expect(checkRequest({ ...SIGNED, stato: 'annullata' }, 'definitiva', {}, today)).toMatch(/non può passare/)
  })
})

describe('API admin del cambio stato', () => {
  it('rifiuta chi non è admin', async () => {
    const { default: handler } = await import('@pages/api/admin/iscrizione-stato')
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
    await handler({ method: 'POST', cookies: {}, body: { id: ROW.id, stato: 'recesso' } } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(db.updateEnrollmentStatus).not.toHaveBeenCalled()
  })
})
