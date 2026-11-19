import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@components/ui/button'
import { useEffect, useState } from 'react'
import { useDataContext } from '@modules/context'
import { bannerArea, bannerLink, fillText, pickForSlot, textVariables, type BannerStory, type Slot } from '@modules/banner'
import { markInPage, markUsed, removeFromPage } from '@modules/bannerMemory'
import { bannerContext, useCalendar } from './siteBanner'
import BannerForm from './bannerForm'

const COLORS = {
  chiaro: 'bg-default-100 text-neutral-900',
  scuro: 'bg-neutral-900 text-white',
  verde: 'bg-primary text-white',
}

interface Choice {
  story: BannerStory
  title: string
  text: string
  area?: string
}

/**
 * Fixed place for a banner inside the page (decision of 21/10): home after
 * "Cosa offriamo", end of articles, end of projects. The first valid banner of the
 * list chosen in "Banner di tutto il sito" appears; if none is valid, nothing.
 * It is decided in the browser, so the page always arrives without it and the block is added after.
 */
export default function SlotBanner({ slot }: { slot: Slot }) {
  const router = useRouter()
  const { banner: data } = useDataContext()
  const calendar = useCalendar()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [filling, setFilling] = useState(false)
  const [sent, setSent] = useState(false)
  const path = router.asPath.split(/[?#]/)[0]

  useEffect(() => {
    setChoice(null)
    setFilling(false)
    setSent(false)
    if (!data?.slots?.[slot]?.length) return
    let uuid: string | null = null
    // After the page is tracked and before window and panel are chosen.
    const timer = window.setTimeout(() => {
      const ctx = bannerContext(path, calendar, [])
      const story = pickForSlot(data, slot, ctx)
      if (!story) return
      const values = textVariables(story.content, ctx)
      uuid = story.uuid
      markInPage(story.uuid)
      setChoice({
        story,
        title: fillText(story.content.title, values) ?? '',
        text: fillText(story.content.text, values) ?? '',
        area: bannerArea(story.content) || ctx.visitor?.area,
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      if (uuid) removeFromPage(uuid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, slot, path])

  if (!choice) return null

  const b = choice.story.content
  const form = b.form && typeof b.form === 'object' && b.form.content ? b.form.content : null
  const link = bannerLink(b)
  const dark = b.color === 'scuro' || b.color === 'verde'
  const image = b.image?.filename ? b.image : null
  const used = () => markUsed(choice.story.uuid)

  return (
    <section className="mx-auto w-full max-w-[1280px] p-6" aria-label={choice.title}>
      <div
        className={`grid overflow-hidden rounded-2xl ${COLORS[b.color || 'chiaro']} ${
          image && !filling ? 'md:grid-cols-[1fr_34%]' : ''
        }`}
      >
        {image && !filling && (
          <img
            src={`${image.filename}/m/800x500/smart`}
            alt={image.alt || ''}
            className="h-40 w-full object-cover md:order-2 md:h-full"
          />
        )}
        <div className="grid content-center gap-3 p-6 md:p-10">
          <h2 className={`font-serif font-bold leading-tight ${filling ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{choice.title}</h2>
          {filling && form ? (
            <div className="max-w-2xl">
              <BannerForm
                form={form}
                area={choice.area}
                dark={dark}
                onSent={() => {
                  used()
                  setSent(true)
                }}
                onClose={() => setChoice(null)}
              />
            </div>
          ) : (
            <>
              {choice.text && <p className="max-w-2xl opacity-85">{choice.text}</p>}
              <div>
                {form && !sent ? (
                  <Button color={b.color === 'verde' ? 'default' : 'primary'} onPress={() => setFilling(true)}>
                    {form.label || 'Compila il modulo'}
                  </Button>
                ) : link ? (
                  <Button as={NextLink} href={link} color={b.color === 'verde' ? 'default' : 'primary'} onPress={used}>
                    {b.action?.[0]?.label || 'Scopri di più'}
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
