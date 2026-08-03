import type { List as ListBlok } from '@types'
import { storyblokEditable } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { Accordion, AccordionItem } from '@heroui/react'
import { tv } from 'tailwind-variants'

// 1. Definiamo i tipi esatti attesi da Tailwind Variants
type SizeVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | undefined

interface ListComponentProps {
  blok: ListBlok
}

export default function List({ blok }: ListComponentProps) {
  // 2. Fallback di sicurezza in caso l'array arrivi vuoto
  const items = blok.items || []

  if (!items.length) return null

  return (
    <Accordion
      className={classes({ size: blok.size as SizeVariant })}
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
  },
})