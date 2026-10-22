import { Logo } from '@public/logo'
import Link from 'next/link'
import Meta from '@components/meta'

const LINKS = [
  { href: '/corsi/interior-design', label: 'Corsi di interior design' },
  { href: '/corsi/fashion-design', label: 'Corsi di fashion design' },
  { href: '/open-day/interior-design', label: 'Open day' },
  { href: '/contatti', label: 'Contatti' },
]

export default function NotFound() {
  return (
    <section className="relative mx-auto flex h-screen max-w-[1280px] flex-col justify-center p-6 sm:py-8 md:py-10 lg:py-12">
      <Meta title="Pagina non trovata | Made in Italy Academy" noindex />
      <Link href="/" className="absolute left-8 top-8" aria-label="Torna alla home">
        <Logo classes="" primary="#262C2A" secondary="#262C2A" />
      </Link>
      <div className="md:max-w-2/3">
        <h1 className="mb-6 font-serif type-display">Pagina non trovata</h1>
        <p className="mb-12 font-sans text-lg">
          La pagina che cerchi non esiste più o ha cambiato indirizzo. Puoi ripartire da qui:
        </p>
        <ul className="flex flex-col gap-3 font-sans text-lg">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="underline underline-offset-4 hover:text-primary">
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" className="underline underline-offset-4 hover:text-primary">
              Torna alla home
            </Link>
          </li>
        </ul>
      </div>
    </section>
  )
}
