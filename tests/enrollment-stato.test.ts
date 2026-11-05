import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/brevo', () => ({ upsertContact: vi.fn(), trackEvent: vi.fn() }))
vi.mock('@modules/enrollment/db', () => ({ updateEnrollmentStatus: vi.fn(), logEvent: vi.fn() }))

import { trackEvent, upsertContact } from '@modules/brevo'
import * as db from '@modules/enrollment/db'
import { ENROLLED_LIST_ID, syncStatusChange } from '@modules/enrollment/brevo-sync'
import { STATUS_CHANGES, changeStatus, isTargetStatus } from '@modules/enrollment/status'
import type { Enrollment } from '@modules/enrollment/types'

const ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'test+iscrizione@miia.it',
  corso: 'corso-interior-design-primo-livello',
  stato: 'recesso',
} as Enrollment

beforeEach(() => {
  vi.mocked(upsertContact).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(trackEvent).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(db.updateEnrollmentStatus).mockReset()
  vi.mocked(db.logEvent).mockReset()
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
      properties: { corso: 'Interior design, primo livello' },
    })
  })

  it('definitiva: solo lo stato, nessun evento', async () => {
    await syncStatusChange(ROW, 'definitiva')
    expect(vi.mocked(upsertContact).mock.calls[0][0]).toMatchObject({ attributes: { ISCRIZIONE_STATO: 4 }, unlinkListIds: undefined })
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('cambio non ammesso: nessuna scrittura in Brevo', async () => {
    vi.mocked(db.updateEnrollmentStatus).mockResolvedValue(null)
    const result = await changeStatus(ROW.id, 'recesso', 'admin@miia.it')
    expect(result.ok).toBe(false)
    expect(upsertContact).not.toHaveBeenCalled()
    expect(db.logEvent).not.toHaveBeenCalled()
  })

  it('se Brevo non risponde il cambio resta e il registro lo segna', async () => {
    vi.mocked(db.updateEnrollmentStatus).mockResolvedValue(ROW)
    vi.mocked(upsertContact).mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await changeStatus(ROW.id, 'recesso', 'admin@miia.it', 'email del 5/11')
    expect(result.ok).toBe(true)
    expect(db.updateEnrollmentStatus).toHaveBeenCalledWith(ROW.id, ['firmata'], 'recesso')
    expect(db.logEvent).toHaveBeenCalledWith(ROW.id, 'recesso', null, null, { da: 'admin@miia.it', nota: 'email del 5/11', brevo: false })
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
