import type { List as ListBlok } from '@types'
import { storyblokEditable } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { Accordion, AccordionItem } from '@heroui/react'
import { tv } from 'tailwind-variants'
import { wrapperWidthClasses } from '@components/ui/wrapper-width'

// 1. Definiamo i tipi esatti attesi da Tailwind Variants
type SizeVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | undefined

interface ListComponentProps {
  blok: ListBlok
  /** In una sezione con sfondo fotografico: la fisarmonica sta su un vetro smerigliato. */
  onBackground?: boolean
  parent?: string
}

export default function List({ blok, onBackground, parent }: ListComponentProps) {
  // 2. Fallback di sicurezza in caso l'array arrivi vuoto
  const items = blok.items || []

  if (!items.length) return null

  return (
    <Accordion
      className={
        parent === 'wrapper'
          ? // In un Wrapper (flex) il col-span della griglia non vale: la larghezza viene da wrapperWidthClasses
            classes({ glass: !!onBackground, class: wrapperWidthClasses(listWidths(blok.size as SizeVariant)) })
          : classes({ size: blok.size as SizeVariant, glass: !!onBackground })
      }
      {...storyblokEditable(blok as any)}
    >
      {items.map((item: any) => (
        <AccordionItem
          key={item._uid}
          aria-label={item.title || `accordion-item-${item._uid}`}
          title={
            item.title
              ? compiler(item.title, {
                wrapper: null,
                overrides: Typography({}),
              })
              : ''
          }
        >
          <div className="font-light">
            {item.description
              ? compiler(item.description, {
                wrapper: null,
                overrides: Typography({}),
              })
              : null}
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/** La "Dimensione" della lista per breakpoint [sm, md, lg, xl], come nella griglia (1/4 parte da md). */
function listWidths(size: SizeVariant): Array<string | undefined> {
  if (!size) return []
  return size === '1/4' ? [undefined, size] : [size]
}

const classes = tv({
  base: 'col-span-12 gap-4',
  variants: {
    size: {
      '1/4': 'md:col-span-3',
      '1/3': 'sm:col-span-4',
      '1/2': 'sm:col-span-6',
      '2/3': 'sm:col-span-8',
      '3/4': 'sm:col-span-9',
    },
    // Vetro smerigliato sopra la foto di sfondo: sfoca e scurisce (o schiarisce) quel che sta sotto
    glass: {
      true: 'rounded-large bg-background/50 px-4 py-2 shadow-medium backdrop-blur-md sm:px-6',
    },
  },
})