import '@styles/globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { AppProps } from 'next/app'
import { GoogleTagManager } from '@next/third-parties/google'

import { storyblokInit, apiPlugin } from '@storyblok/react'
import { HeroUIProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { DataProvider } from '@modules/context'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { captureAttribution, refreshAttributionStorage } from '@modules/attribution'
import { debugProfiloAttivo, inviaRiassunto, tracciaPagina } from '@modules/tracking'
import DebugProfilo from '@components/debugProfilo'
import BannerSito from '@components/banners/bannerSito'

import { fontSans, fontSerif } from '@config/fonts'
import { getGtmId } from '@config/gtm'

import Page from '@components/page'
import Section from '@components/section'
import Nav from '@components/nav'
import Text from '@components/text'
import Image from '@components/image'
import Action from '@components/action'
import Field from '@components/field'
import Form from '@components/form'
import Map from '@components/map'
import Article from '@components/article'
import List from '@components/list'
import Carousel from '@components/carousel'
import Aside from '@components/aside'
import Person from '@components/person'
import Course from '@components/course'
import Location from '@components/location'
import Video from '@components/video'
import Wrapper from '@components/wrapper'
import Alias from '@components/alias'
import Background from '@components/background'
import Gallery from '@components/gallery'
import Menu from '@components/menu'
import Process from '@components/process'
import Grid from '@components/grid'
import Project from '@components/project'

const components = {
  page: Page,
  article: Article,
  nav: Nav,
  list: List,
  menu: Menu,
  process: Process,
  alias: Alias,
  section: Section,
  aside: Aside,
  wrapper: Wrapper,
  carousel: Carousel,
  video: Video,
  image: Image,
  background: Background,
  gallery: Gallery,
  map: Map,
  form: Form,
  field: Field,
  text: Text,
  action: Action,
  person: Person,
  course: Course,
  location: Location,
  grid: Grid,
  project: Project,
  business: () => null,
}

// Inizializzazione pulita per il nuovo stack REST + Draft Mode
storyblokInit({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW,
  use: [apiPlugin],
  apiOptions: {
    region: 'eu', // Aggiunto: specifica 'eu' o 'us' in base a dove è hostato il tuo spazio Storyblok
  },
  components,
})

/** Banner scelti nella pagina (campo "Banner" di Pagina, Articolo e Progetto), prima di quelli di tutto il sito. */
function bannerDiPagina(pageProps: any): string[] {
  const banner = pageProps?.story?.content?.banner
  return Array.isArray(banner) ? banner.filter((b: unknown): b is string => typeof b === 'string') : []
}

const gtmId = getGtmId()

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  // Provenienza della visita: salvata all'arrivo e a ogni cambio pagina.
  useEffect(() => {
    captureAttribution()
    router.events.on('routeChangeComplete', captureAttribution)
    // Se il consenso arriva dal banner, la provenienza passa nel cookie
    // al più tardi quando la persona lascia la pagina.
    window.addEventListener('pagehide', refreshAttributionStorage)
    return () => {
      router.events.off('routeChangeComplete', captureAttribution)
      window.removeEventListener('pagehide', refreshAttributionStorage)
    }
  }, [router.events])

  // Profilo di interesse: pagine viste e lette, solo con il consenso marketing.
  // Il riassunto parte verso il cookie quando la persona chiude o cambia scheda.
  const [debugProfilo, setDebugProfilo] = useState(false)
  useEffect(() => {
    const traccia = (url?: string) => tracciaPagina(url)
    const fineVisita = () => {
      if (document.visibilityState === 'hidden') inviaRiassunto()
    }
    traccia()
    setDebugProfilo(debugProfiloAttivo())
    router.events.on('routeChangeComplete', traccia)
    document.addEventListener('visibilitychange', fineVisita)
    window.addEventListener('pagehide', fineVisita)
    return () => {
      router.events.off('routeChangeComplete', traccia)
      document.removeEventListener('visibilitychange', fineVisita)
      window.removeEventListener('pagehide', fineVisita)
    }
  }, [router.events])

  return (
    <>
      <DataProvider data={pageProps.data}>
        <HeroUIProvider>
          <NextThemesProvider attribute="class" defaultTheme="light">
            <Component {...pageProps} />
            <BannerSito diPagina={bannerDiPagina(pageProps)} />
          </NextThemesProvider>
        </HeroUIProvider>
      </DataProvider>
      {debugProfilo && <DebugProfilo />}
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
    </>
  )
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  serif: fontSerif.style.fontStyle,
}