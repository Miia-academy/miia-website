import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useDataContext } from '@modules/context'
import { linkBanner, riempi, scegliPerPosto, variabili, type BannerStory, type Posto } from '@modules/banner'
import { segnaInPagina, segnaUsato, togliDaPagina } from '@modules/bannerMemoria'
import { contesto, useCalendario } from './bannerSito'
import BannerForm from './bannerForm'

const colori = {
  chiaro: 'bg-default-100 text-neutral-900',
  scuro: 'bg-neutral-900 text-white',
  verde: 'bg-primary text-white',
}

interface Scelta {
  story: BannerStory
  titolo: string
  testo: string
  area?: string
}

/**
 * Posto fisso per un banner dentro la pagina (decisione del 21/10): home dopo
 * "Cosa offriamo", fondo degli articoli, fondo dei progetti. Compare il primo banner
 * valido della lista scelta in "Banner di tutto il sito"; se nessuno vale, niente.
 * Si decide nel browser, quindi la pagina arriva sempre senza e il blocco si aggiunge dopo.
 */
export default function BannerPosto({ posto }: { posto: Posto }) {
  const router = useRouter()
  const { banner: dati } = useDataContext()
  const calendario = useCalendario()
  const [scelta, setScelta] = useState<Scelta | null>(null)
  const [compila, setCompila] = useState(false)
  const [inviato, setInviato] = useState(false)
  const path = router.asPath.split(/[?#]/)[0]

  useEffect(() => {
    setScelta(null)
    setCompila(false)
    setInviato(false)
    if (!dati?.posti?.[posto]?.length) return
    let uuid: string | null = null
    // Dopo il tracciamento della pagina e prima della scelta di finestra e pannello.
    const timer = window.setTimeout(() => {
      const ctx = contesto(path, calendario, [])
      const story = scegliPerPosto(dati, posto, ctx)
      if (!story) return
      const valori = variabili(story.content, ctx)
      uuid = story.uuid
      segnaInPagina(story.uuid)
      setScelta({
        story,
        titolo: riempi(story.content.titolo, valori) ?? '',
        testo: riempi(story.content.testo, valori) ?? '',
        area: (story.content.pubblico || []).find((v) => v === 'interni' || v === 'moda') || ctx.persona?.area,
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      if (uuid) togliDaPagina(uuid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, posto, path])

  if (!scelta) return null

  const b = scelta.story.content
  const modulo = b.modulo && typeof b.modulo === 'object' && b.modulo.content ? b.modulo.content : null
  const link = linkBanner(b)
  const scuro = b.colore === 'scuro' || b.colore === 'verde'
  const immagine = b.immagine?.filename ? b.immagine : null
  const usato = () => segnaUsato(scelta.story.uuid)

  return (
    <section className="mx-auto w-full max-w-[1280px] p-6" aria-label={scelta.titolo}>
      <div
        className={`grid overflow-hidden rounded-2xl ${colori[b.colore || 'chiaro']} ${
          immagine && !compila ? 'md:grid-cols-[1fr_34%]' : ''
        }`}
      >
        {immagine && !compila && (
          <img
            src={`${immagine.filename}/m/800x500/smart`}
            alt={immagine.alt || ''}
            className="h-40 w-full object-cover md:order-2 md:h-full"
          />
        )}
        <div className="grid content-center gap-3 p-6 md:p-10">
          <h2 className={`font-serif font-bold leading-tight ${compila ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{scelta.titolo}</h2>
          {compila && modulo ? (
            <div className="max-w-2xl">
              <BannerForm
                form={modulo}
                area={scelta.area}
                scuro={scuro}
                onInviato={() => {
                  usato()
                  setInviato(true)
                }}
                onChiudi={() => setScelta(null)}
              />
            </div>
          ) : (
            <>
              {scelta.testo && <p className="max-w-2xl opacity-85">{scelta.testo}</p>}
              <div>
                {modulo && !inviato ? (
                  <Button color={b.colore === 'verde' ? 'default' : 'primary'} onPress={() => setCompila(true)}>
                    {modulo.label || 'Compila il modulo'}
                  </Button>
                ) : link ? (
                  <Button as={NextLink} href={link} color={b.colore === 'verde' ? 'default' : 'primary'} onPress={usato}>
                    {b.azione?.[0]?.label || 'Scopri di più'}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
