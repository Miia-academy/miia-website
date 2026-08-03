import type { Nav as NavBlok } from '@types'
import { Fragment, useState, useRef } from 'react'
import { tv } from 'tailwind-variants'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Link,
} from '@heroui/react'
import { Typography } from './typography'

import { Brand } from '@public/brand'
import { Logo } from '@public/logo'
import { compiler } from 'markdown-to-jsx'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { useOnClickOutside } from 'usehooks-ts'

interface NavComponentProps {
  blok: NavBlok
  parent: 'header' | 'footer'
}

const templates = {
  header: Header,
  footer: Footer,
}

// 1. Spostiamo la variante TV all'esterno per evitare di ricrearla ad ogni render
const submenuClasses = tv({
  base: 'hidden md:block absolute top-full left-0 right-0 dark sm:bg-background text-foreground border-t-1 border-transparent invisible opacity-0 h-0 transition-all duration-150 ease-in-out',
  variants: {
    isOpen: {
      true: 'visible opacity-100 h-10 transition-all duration-250 ease-in-out delay-75 border-foreground-200',
    },
  },
})

export default function Nav({ blok, parent }: NavComponentProps) {
  const Template = templates[parent]
  return <Template blok={blok} />
}

function Header({ blok }: { blok: NavBlok }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // 2. Usiamo 'null' e salviamo l'_uid anziché l'indice dell'array
  const [subMenuOpen, setSubMenuOpen] = useState<string | null>(null)

  const ref = useRef<HTMLElement>(null)
  useOnClickOutside(ref as any, () => setSubMenuOpen(null))

  const contents = blok.contents || []

  return (
    <Navbar
      ref={ref as any}
      onMenuOpenChange={setIsMenuOpen}
      className="dark bg-background text-foreground"
      classNames={{ wrapper: 'max-w-[1280px] mx-auto static' }}
      {...storyblokEditable(blok as any)}
    >
      <NavbarBrand className="grow-0">
        <Link href="/">
          <Logo
            classes="md:max-lg:hidden"
            primary="#F3F3F2"
            secondary="#686D6C"
          />
          <Brand classes="max-md:hidden lg:hidden" color="#F3F3F2" />
        </Link>
      </NavbarBrand>

      {contents.length > 0 && (
        <Fragment>
          <NavbarContent justify="start" className="max-md:hidden gap-3 md:gap-6">
            {contents.map((item: any) => {
              const isOpen = item._uid === subMenuOpen
              return (
                <NavbarItem
                  key={item._uid}
                  className="relative self-stretch inline-flex items-center"
                >
                  <StoryblokComponent
                    blok={item}
                    parent="header"
                    isOpen={isOpen}
                    handleOpen={() => setSubMenuOpen(isOpen ? null : item._uid)}
                  />
                </NavbarItem>
              )
            })}
          </NavbarContent>

          <NavbarContent justify="end" className="md:hidden">
            <NavbarMenuToggle
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            />
          </NavbarContent>

          <div className={submenuClasses({ isOpen: subMenuOpen !== null })} />

          <NavbarMenu className="p-8 pt-12 gap-12 items-end dark">
            {contents.map((item: any) => {
              const isOpen = item._uid === subMenuOpen
              return (
                <NavbarMenuItem key={item._uid} className="w-full text-right">
                  <StoryblokComponent
                    blok={item}
                    parent="header"
                    isOpen={isOpen}
                    handleOpen={() => setSubMenuOpen(isOpen ? null : item._uid)}
                  />
                </NavbarMenuItem>
              )
            })}
          </NavbarMenu>
        </Fragment>
      )}
    </Navbar>
  )
}

function Footer({ blok }: { blok: NavBlok }) {
  const contents = blok.contents || []

  return (
    <footer
      className="dark bg-background text-foreground py-12 space-y-12"
      {...storyblokEditable(blok as any)}
    >
      <div className="px-6 mx-auto space-y-6 max-w-[1280px] min-h-inherit">
        <Link href="/">
          <Logo classes="max-md:hidden" primary="#F3F3F2" secondary="#686D6C" />
          <Brand classes="md:hidden" color="#F3F3F2" />
        </Link>
        {contents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 sm:gap-6 lg:gap-8">
            {contents.map((item: any) => (
              <div className="flex-1" key={item._uid}>
                <StoryblokComponent parent="footer" blok={item} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Fallback per il compiler e fix mismatch usando un <div> */}
      {blok.message && (
        <div className="px-6 mx-auto space-y-6 max-w-[1280px] min-h-inherit">
          <div className="text-xs">
            {compiler(blok.message, {
              wrapper: null,
              overrides: Typography({}),
            })}
          </div>
        </div>
      )}
    </footer>
  )
}