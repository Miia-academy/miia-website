import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang='it' className='scroll-pt-14 scroll-smooth hide-scrollbar'>
      <Head />
      <body
        className='font-sans light text-foreground bg-background min-h-screen'
      >
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
