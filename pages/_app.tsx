import '@styles/globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { AppProps } from 'next/app'
import { GoogleTagManager } from '@next/third-parties/google'

import { storyblokInit, apiPlugin } from '@storyblok/react'
import { HeroUIProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

import { fontSans, fontSerif } from '@config/fonts'

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

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <HeroUIProvider>
        <NextThemesProvider attribute="class" defaultTheme="light">
          <Component {...pageProps} />
        </NextThemesProvider>
      </HeroUIProvider>
      <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM || ''} />
    </>
  )
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  serif: fontSerif.style.fontStyle,
}