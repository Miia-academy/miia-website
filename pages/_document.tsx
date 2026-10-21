import { Html, Head, Main, NextScript } from 'next/document'
import { fontSans, fontSerif } from '@config/fonts'

export default function Document() {
  return (
    <Html lang='it' className='scroll-pt-14 scroll-smooth hide-scroolbar'>
      <Head>
        <link
          rel='stylesheet'
          href='https://cdn.jsdelivr.net/gh/iconoir-icons/iconoir@main/css/iconoir.css'
        />
        <link
          rel='stylesheet'
          href='https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'
        />
      </Head>
      <body
        className={`font-sans light text-foreground bg-background min-h-screen ${fontSans.variable} ${fontSerif.variable}`}
      >
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
