import type { NextApiRequest, NextApiResponse } from 'next'
import { describe, expect, it } from 'vitest'
import handler from '@pages/api/profilo'
import {
  areaPrevalente,
  fascia,
  leggiCookie,
  nuovoDettaglio,
  pulisciRiassunto,
  punteggio,
  registraLettura,
  registraModulo,
  registraPagina,
  riassumi,
  scriviCookie,
} from '@modules/profilo'

const at = (iso: string) => new Date(iso)

describe('profilo: pagine e visite', () => {
  it('conta una nuova visita solo dopo 30 minuti senza attività', () => {
    const d = nuovoDettaglio(at('2026-10-20T10:00:00Z'))
    registraPagina(d, '/corsi/interior-design', at('2026-10-20T10:00:00Z'))
    registraPagina(d, '/corsi/interior-design/', at('2026-10-20T10:10:00Z'))
    expect(d.visite.numero).toBe(1)
    registraPagina(d, '/', at('2026-10-20T11:00:00Z'))
    expect(d.visite.numero).toBe(2)
    expect(d.pagine['/corsi/interior-design'].viste).toBe(2)
  })

  it('ignora le pagine escluse ma conta la visita', () => {
    const d = nuovoDettaglio()
    registraPagina(d, '/iscrizione/dati?x=1')
    registraPagina(d, '/admin')
    expect(d.pagine).toEqual({})
    expect(d.visite.numero).toBe(1)
  })

  it('tiene solo le 50 pagine più recenti', () => {
    const d = nuovoDettaglio()
    for (let i = 0; i < 55; i++) registraPagina(d, `/blog/articolo-${i}`)
    const chiavi = Object.keys(d.pagine)
    expect(chiavi).toHaveLength(50)
    expect(chiavi[0]).toBe('/blog/articolo-5')
    expect(chiavi[49]).toBe('/blog/articolo-54')
  })
})

describe('profilo: punteggio, fascia e area', () => {
  it('somma visite, pagine con il loro peso e moduli', () => {
    const d = nuovoDettaglio()
    registraPagina(d, '/corsi/interior-design') // peso 2: 1 vista = 2
    registraLettura(d, '/corsi/interior-design') // peso 2: 1 lettura = 4
    registraPagina(d, '/blog/colori') // peso 1: 1
    registraModulo(d, 'download') // 10
    // 1 visita = 3
    expect(punteggio(d)).toBe(2 + 4 + 1 + 10 + 3)
  })

  it('assegna la fascia dalle soglie', () => {
    expect(fascia(0)).toBe('freddo')
    expect(fascia(15)).toBe('tiepido')
    expect(fascia(40)).toBe('caldo')
  })

  it("riconosce l'area prevalente dagli indirizzi", () => {
    const d = nuovoDettaglio()
    registraPagina(d, '/corsi/interior-design')
    registraPagina(d, '/corsi/fashion-design')
    registraLettura(d, '/corsi/fashion-design')
    expect(areaPrevalente(d)).toBe('moda')
    expect(areaPrevalente(nuovoDettaglio())).toBeUndefined()
  })
})

describe('profilo: riassunto per il cookie', () => {
  it('segna contatto, moduli inviati e open day', () => {
    const d = nuovoDettaglio(at('2026-10-20T10:00:00Z'))
    registraPagina(d, '/open-day/interior-design', at('2026-10-20T10:00:00Z'))
    registraModulo(d, 'open_day', '2026-11-16T19:00:00.000Z', at('2026-10-20T10:05:00Z'))
    registraModulo(d, 'download', undefined, at('2026-10-21T10:05:00Z'))
    const r = riassumi(d)
    expect(r).toMatchObject({ c: 1, m: 'o:2026-10-20,b:2026-10-21', od: '2026-11-16', a: 'interni', v: 1 })
  })

  it('il cookie si rilegge uguale', () => {
    const d = nuovoDettaglio()
    registraPagina(d, '/corsi/fashion-design')
    const r = riassumi(d)
    expect(leggiCookie(scriviCookie(r))).toEqual(r)
  })

  it('scarta voci sconosciute e valori fuori misura', () => {
    expect(pulisciRiassunto({ p: -1, v: 1, u: '2026-10-20' })).toBeNull()
    expect(pulisciRiassunto({ p: 1, v: 1, u: 'ieri' })).toBeNull()
    const r = pulisciRiassunto({
      c: 1,
      m: '<script>',
      p: 50,
      fx: 'freddo',
      a: 'cucina',
      t: 'interni-tecnico-cad',
      v: 2,
      u: '2026-10-20',
      email: 'x@y.it',
    })
    // La fascia la ricalcola il server dal punteggio.
    expect(r).toEqual({ c: 1, m: '', p: 50, fx: 'caldo', t: 'interni-tecnico-cad', v: 2, u: '2026-10-20' })
  })
})

function call(body: unknown, method = 'POST') {
  const req = { method, body } as NextApiRequest
  const res = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json() {
      return this
    },
    end() {
      return this
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value
      return this
    },
  }
  handler(req, res as unknown as NextApiResponse)
  return res
}

describe('/api/profilo', () => {
  it('scrive il cookie miia_profilo per 180 giorni', () => {
    const res = call(JSON.stringify({ c: 0, m: '', p: 5, fx: 'freddo', v: 1, u: '2026-10-20' }))
    expect(res.statusCode).toBe(204)
    const cookie = String(res.headers['Set-Cookie'])
    expect(cookie).toMatch(/^miia_profilo=/)
    expect(cookie).toContain(`Max-Age=${180 * 86400}`)
    expect(cookie).not.toContain('HttpOnly')
  })

  it('rifiuta profili non validi e metodi diversi da POST', () => {
    expect(call({ p: 'tanto' }).statusCode).toBe(400)
    expect(call(undefined, 'GET').statusCode).toBe(405)
  })
})
