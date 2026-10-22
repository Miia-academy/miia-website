import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BANNER } from '@config/tracking'
import { useDataContext } from '@modules/context'
import { getDocentiNames, joinNames } from '@modules/events'
import { editionKey, useSignedCounts } from '@components/enrollment/use-seats'
import { editionAvailability } from '@modules/enrollment/editions'
import {
  bannerArea,
  bannerLink,
  bannerReport,
  calendarFrom,
  fillText,
  nextOpenDay,
  pickBanner,
  textVariables,
  visitorFromDetail,
  visitorFromSummary,
  type BannerContext,
  type BannerMode,
  type BannerStory,
  type Calendar,
} from '@modules/banner'
import { hasConsent, PURPOSE } from '@modules/consent'
import { consensoSimulato, inAnteprima, leggiDettaglio, leggiProfilo } from '@modules/tracking'
import {
  bannersInPage,
  forcedBanner,
  FORCE_EVENT,
  markClosed,
  markSeen,
  markUsed,
  readMemory,
} from '@modules/bannerMemory'
import BannerForm from './bannerForm'

/** Last banner evaluation, read by the ?debug=profilo box. */
let lastReport: ReturnType<typeof bannerReport> = []
export const readBannerReport = () => lastReport

interface Choice {
  story: BannerStory
  mode: BannerMode
  title: string
  text: string
  openDayDate?: string
}

export const COLORS = {
  chiaro: 'bg-white text-neutral-900',
  scuro: 'bg-neutral-900 text-white',
  verde: 'bg-primary text-white',
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BANNER.phoneWidth - 1}px)`)
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return phone
}

/** The site calendar: open days with their teachers and next editions with the seats left. */
export function useCalendar(): Calendar {
  const { events, courses } = useDataContext()
  const today = new Date().toISOString().slice(0, 10)
  const future = useMemo(() => courses.filter((c) => c.starts && c.starts.slice(0, 10) >= today), [courses, today])
  const keys = useMemo(() => future.map((c) => editionKey(c.uuid, c.starts)), [future])
  const signed = useSignedCounts(keys)
  return useMemo(() => {
    const withSeats = future.map((c, i) => {
      const capacity = Number(String(c.seats ?? '').trim())
      if (!c.seats || !Number.isFinite(capacity)) return { ...c, seats: undefined }
      const signedCount = signed?.[keys[i] || ''] ?? 0
      return { ...c, seats: editionAvailability(capacity, signedCount).posti_liberi ?? undefined }
    })
    const withTeachers = events.map((e) => ({ ...e, teacherNames: joinNames(getDocentiNames(e)) }))
    return calendarFrom(withTeachers, withSeats)
  }, [events, future, signed, keys])
}

export function bannerContext(path: string, calendar: Calendar, pageBanners: string[]): BannerContext {
  const consent = hasConsent(PURPOSE.marketing) || consensoSimulato()
  const detail = consent ? leggiDettaglio() : null
  const summary = consent && !detail ? leggiProfilo() : null
  return {
    path,
    now: new Date(),
    consent,
    visitor: detail ? visitorFromDetail(detail) : summary ? visitorFromSummary(summary) : null,
    calendar,
    memory: readMemory(),
    pageBanners,
  }
}

/**
 * Pop-up banners (window, panel, notice) across the site.
 * Picks the first valid banner for the visitor and the page, shows it at the
 * chosen moment (right away, after N seconds or after scrolling N% of the page), one per page.
 */
export default function SiteBanner({ pageBanners = [] }: { pageBanners?: string[] }) {
  const router = useRouter()
  const { banner: data } = useDataContext()
  const calendar = useCalendar()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [visible, setVisible] = useState(false)
  const [forced, setForced] = useState(0)
  const pageKey = pageBanners.join(',')
  const path = router.asPath.split(/[?#]/)[0]

  // Banner choice on every page: after the page is tracked (effect in _app).
  useEffect(() => {
    setVisible(false)
    setChoice(null)
    if (!data) return
    let active = true
    const timer = window.setTimeout(() => {
      if (!active) return
      const ctx = bannerContext(path, calendar, pageKey ? pageKey.split(',') : [])
      // A banner already in the page as a section does not appear as window or panel too.
      ctx.memory.seenThisVisit = [...ctx.memory.seenThisVisit, ...bannersInPage()]
      lastReport = bannerReport(data, ctx)
      const force = inAnteprima() ? forcedBanner() || new URLSearchParams(window.location.search).get('banner') : null
      const forcedStory = force ? data.all.find((s) => s.uuid === force || s.slug.endsWith('/' + force)) : null
      const found = forcedStory
        ? { story: forcedStory, mode: (forcedStory.content.mode === 'sezione' ? 'pannello' : forcedStory.content.mode || 'pannello') as BannerMode }
        : pickBanner(data, ctx)
      if (!found) return
      const content = found.story.content
      const values = textVariables(content, ctx)
      const title = fillText(content.title, values)
      const text = fillText(content.text, values)
      const usesOpenDay = /\{(data_open_day|giorni_open_day)\}/.test(`${content.title} ${content.text}`)
      const od = usesOpenDay ? nextOpenDay(ctx.calendar, ctx.now, ctx.visitor?.area) || nextOpenDay(ctx.calendar, ctx.now) : undefined
      setChoice({
        ...found,
        title: title ?? content.title ?? '',
        text: text ?? content.text ?? '',
        openDayDate: od?.date,
      })
    }, 50)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
    // The calendar only changes when the seats arrive: no need to choose again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, path, pageKey, forced])

  // "Mostra" button of the ?debug=profilo box.
  useEffect(() => {
    const reload = () => setForced((n) => n + 1)
    window.addEventListener(FORCE_EVENT, reload)
    return () => window.removeEventListener(FORCE_EVENT, reload)
  }, [])

  // When the banner appears.
  useEffect(() => {
    if (!choice) return
    const b = choice.story.content
    const n = Number(b.trigger_value) || 0
    const show = () => {
      markSeen(choice.story.uuid)
      setVisible(true)
    }
    if (forcedBanner() || b.trigger === 'subito' || !b.trigger) {
      show()
      return
    }
    if (b.trigger === 'secondi') {
      const t = window.setTimeout(show, n * 1000)
      return () => window.clearTimeout(t)
    }
    const check = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      if (height <= 0 || (window.scrollY / height) * 100 >= n) {
        window.removeEventListener('scroll', check)
        show()
      }
    }
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [choice])

  const close = useCallback(() => {
    if (choice) markClosed(choice.story.uuid)
    setVisible(false)
  }, [choice])

  const used = useCallback(() => {
    if (choice) markUsed(choice.story.uuid)
  }, [choice])

  if (!choice || !visible) return null

  return (
    <BannerView
      key={choice.story.uuid}
      choice={choice}
      onClose={close}
      onUsed={used}
      onDone={() => setVisible(false)}
    />
  )
}

interface BannerViewProps {
  choice: Choice
  onClose: () => void
  onUsed: () => void
  onDone: () => void
}

function BannerView({ choice, onClose, onUsed, onDone }: BannerViewProps) {
  const phone = usePhone()
  const b = choice.story.content
  const form = b.form && typeof b.form === 'object' && b.form.content ? b.form.content : null
  const [filling, setFilling] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const area = bannerArea(b)
  const link = bannerLink(b)
  const mode = choice.mode

  // Esc closes; the window stops the page behind from scrolling.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    const lock = mode === 'finestra' || (phone && filling)
    const before = document.body.style.overflow
    if (lock) document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = before
    }
  }, [mode, phone, filling, onClose])

  if (mode === 'avviso') {
    return <Notice choice={choice} link={link} hasForm={!!form} onClose={onClose} onUsed={onUsed} onDone={onDone} />
  }

  const color = COLORS[b.color || 'chiaro']
  const dark = b.color === 'scuro' || b.color === 'verde'
  const image = b.image?.filename ? b.image : null

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {form ? (
        <Button color={b.color === 'verde' ? 'default' : 'primary'} onPress={() => setFilling(true)}>
          {form.label || 'Compila il modulo'}
        </Button>
      ) : link ? (
        <Button
          as={NextLink}
          href={link}
          color={b.color === 'verde' ? 'default' : 'primary'}
          onPress={onUsed}
        >
          {b.action?.[0]?.label || 'Scopri di più'}
        </Button>
      ) : null}
      {b.close_text && (
        <Button variant="light" className={dark ? 'text-white' : undefined} onPress={onClose}>
          {b.close_text}
        </Button>
      )}
    </div>
  )

  const x = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Chiudi"
      className={`absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-sm ${
        image && !filling && mode === 'finestra' && phone ? 'bg-white/85 text-neutral-700' : dark ? 'bg-white/15' : 'bg-black/5'
      }`}
    >
      ✕
    </button>
  )

  const body = filling && form ? (
    <div className="grid gap-3">
      <p className="pr-8 font-serif text-lg font-bold leading-tight">{choice.title}</p>
      <BannerForm form={form} area={area} dark={dark} onSent={onUsed} onClose={onDone} />
    </div>
  ) : (
    <div className="grid gap-2">
      <p className="pr-8 font-serif text-xl font-bold leading-tight">{choice.title}</p>
      {choice.text && <p className="text-sm opacity-85">{choice.text}</p>}
      <div className="mt-1">{actions}</div>
    </div>
  )

  // Phone: window and panel become a bottom sheet (the window darkens the page).
  if (phone) {
    return (
      <>
        {mode === 'finestra' && <div className="fixed inset-0 z-[60] bg-black/45" onClick={onClose} aria-hidden="true" />}
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal={mode === 'finestra'}
          aria-label={choice.title}
          className={`fixed inset-x-0 bottom-0 z-[61] max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.18)] outline-none ${color}`}
        >
          {mode === 'finestra' && image && !filling && (
            <img src={`${image.filename}/m/800x260/smart`} alt={image.alt || ''} className="h-32 w-full object-cover" />
          )}
          <span className="mx-auto mt-2 block h-1 w-8 rounded bg-default-300" aria-hidden="true" />
          {x}
          <div className="px-5 pb-5 pt-3">{body}</div>
        </div>
      </>
    )
  }

  if (mode === 'finestra') {
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-black/45" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={choice.title}
          className={`fixed left-1/2 top-1/2 z-[61] grid max-h-[90vh] w-[min(760px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl outline-none ${color} ${
            image && !filling ? 'grid-cols-[38%_1fr]' : 'grid-cols-1'
          }`}
        >
          {image && !filling && (
            <img src={`${image.filename}/m/600x800/smart`} alt={image.alt || ''} className="h-full w-full object-cover" />
          )}
          <div className="relative overflow-y-auto p-7">
            {x}
            {body}
          </div>
        </div>
      </>
    )
  }

  // Panel on desktop: full-width strip at the bottom, as tall as its content.
  const date = choice.openDayDate ? new Date(choice.openDayDate) : null
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label={choice.title}
      className={`fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto border-t-[3px] border-primary shadow-[0_-10px_30px_rgba(0,0,0,0.12)] outline-none ${color}`}
    >
      <div className="relative mx-auto flex max-w-screen-xl items-center gap-5 px-6 py-4">
        {x}
        {filling ? (
          <div className="w-full max-w-2xl">{body}</div>
        ) : (
          <>
            {date ? (
              <div className="w-16 shrink-0 rounded-lg border border-default-200 py-2 text-center">
                <b className="block font-serif text-2xl leading-none text-primary">{date.getDate()}</b>
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {date.toLocaleDateString('it-IT', { month: 'short' })}
                </span>
              </div>
            ) : image ? (
              <img src={`${image.filename}/m/160x120/smart`} alt="" className="h-16 w-20 shrink-0 rounded-md object-cover" />
            ) : null}
            <div className="grid min-w-0 flex-1 gap-1 pr-10">
              <p className="font-serif text-lg font-bold leading-tight">{choice.title}</p>
              {choice.text && <p className="text-sm opacity-85">{choice.text}</p>}
            </div>
            <div className="shrink-0 pr-10">{actions}</div>
          </>
        )}
      </div>
    </div>
  )
}

interface NoticeProps {
  choice: Choice
  link: string | null
  hasForm: boolean
  onClose: () => void
  onUsed: () => void
  onDone: () => void
}

/** Dark notice in the corner: one link, disappears by itself (stops while hovered). */
function Notice({ choice, link, hasForm, onClose, onUsed, onDone }: NoticeProps) {
  const duration = BANNER.noticeSeconds * 1000
  const [left, setLeft] = useState(duration)
  const [paused, setPaused] = useState(false)
  const href = link && hasForm ? `${link}${link.includes('?') ? '&' : '?'}modulo=apri` : link

  useEffect(() => {
    if (paused) return
    const step = 100
    const t = window.setInterval(() => setLeft((r) => r - step), step)
    return () => window.clearInterval(t)
  }, [paused])

  useEffect(() => {
    if (left <= 0) onDone()
  }, [left, onDone])

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 right-4 z-[61] grid gap-1.5 rounded-xl bg-neutral-900 p-4 pr-11 text-white shadow-xl sm:left-auto sm:right-6 sm:w-[340px]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-white/15 text-xs"
      >
        ✕
      </button>
      <p className="font-serif text-base font-bold leading-tight">{choice.title}</p>
      {choice.text && <p className="hidden text-sm opacity-85 sm:block">{choice.text}</p>}
      {href && (
        <NextLink href={href} onClick={onUsed} className="text-sm font-semibold text-[#7fd7a8]">
          {choice.story.content.action?.[0]?.label || 'Scopri di più'} →
        </NextLink>
      )}
      <span className="mt-1 h-0.5 overflow-hidden rounded bg-white/20" aria-hidden="true">
        <span className="block h-full bg-[#7fd7a8]" style={{ width: `${Math.max(0, (left / duration) * 100)}%` }} />
      </span>
    </div>
  )
}
