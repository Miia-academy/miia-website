import type { Text as TextBlok } from '@types'
import { Typography } from './typography'
import { storyblokEditable } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { tv } from 'tailwind-variants'

// Definizioni type-safe per Tailwind Variants
type JustifyVariant = 'right' | 'center' | 'left'
type OrderVariant = '1' | '2' | '3' | '4' | '5' | '6'
type WidthVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1'

interface TextComponentProps {
  blok: TextBlok
}

// 1. Definisci il tipo esatto atteso da Typography
type ThemeVariant = 'primary' | 'secondary' | 'dark' | 'light' | undefined;

export default function Text({ blok }: TextComponentProps) {

  // 2. Sanifica il dato di Storyblok: se è una stringa vuota, diventa undefined
  const typography = {
    theme: (blok.theme === "" ? undefined : blok.theme) as ThemeVariant,
  };

  // 1. Parsing super-sicuro per il campo "hide" (previene crash se undefined)
  const hideOptions = Array.isArray(blok.hide)
    ? blok.hide
    : typeof blok.hide === 'string'
      ? [blok.hide]
      : []

  const hideAll = hideOptions.includes('all')
  const hideTitle = hideAll || hideOptions.includes('title')
  const hideDescription = hideAll || hideOptions.includes('description')

  const orderAttr = blok.order ? (blok.order.toString() as OrderVariant) : undefined

  return (
    <article
      key={blok._uid}
      className={textClasses({
        order: orderAttr,
        justify: blok.justify as JustifyVariant | undefined,
        sm: blok.width?.[0] as WidthVariant | undefined,
        md: blok.width?.[1] as WidthVariant | undefined,
        lg: blok.width?.[2] as WidthVariant | undefined,
        xl: blok.width?.[3] as WidthVariant | undefined,
      })}
      {...storyblokEditable(blok as any)}
    >
      {/* 2. Rendering diretto invece di componenti annidati, elimina problemi di unmount/remount */}
      {typeof blok.title === 'string' && blok.title.trim() !== '' ? (
        <div className={titleClasses({ hide: hideTitle })}>
          {compiler(blok.title, {
            overrides: Typography(typography),
          })}
        </div>
      ) : null}

      {typeof blok.description === 'string' && blok.description.trim() !== '' ? (
        <div className={descriptionClasses({ hide: hideDescription })}>
          {compiler(blok.description, {
            overrides: Typography(typography),
          })}
        </div>
      ) : null}
    </article>
  )
}

const titleClasses = tv({
  base: 'space-y-2',
  variants: {
    hide: {
      true: 'hidden sm:block',
    },
  },
})

const descriptionClasses = tv({
  base: 'space-y-2',
  variants: {
    hide: {
      true: 'hidden sm:block',
    },
  },
})

const textClasses = tv({
  base: 'flex-1 flex flex-col align-stretch gap-2 lg:gap-4 col-span-12 min-w-32 text-left sm:order-none',
  variants: {
    justify: {
      right: 'sm:text-right',
      center: 'sm:text-center',
      left: 'sm:text-left',
    },
    order: {
      '1': '-order-1',
      '2': '-order-2',
      '3': '-order-3',
      '4': '-order-4',
      '5': '-order-5',
      '6': '-order-6',
    },
    sm: {
      '1/4': 'sm:col-span-3',
      '1/3': 'sm:col-span-4',
      '1/2': 'sm:col-span-6',
      '2/3': 'sm:col-span-8',
      '3/4': 'sm:col-span-9',
      '1/1': 'sm:col-span-12',
    },
    md: {
      '1/4': 'md:col-span-3',
      '1/3': 'md:col-span-4',
      '1/2': 'md:col-span-6',
      '2/3': 'md:col-span-8',
      '3/4': 'md:col-span-9',
      '1/1': 'md:col-span-12',
    },
    lg: {
      '1/4': 'lg:col-span-3',
      '1/3': 'lg:col-span-4',
      '1/2': 'lg:col-span-6',
      '2/3': 'lg:col-span-8',
      '3/4': 'lg:col-span-9',
      '1/1': 'lg:col-span-12',
    },
    xl: {
      '1/4': 'xl:col-span-3',
      '1/3': 'xl:col-span-4',
      '1/2': 'xl:col-span-6',
      '2/3': 'xl:col-span-8',
      '3/4': 'xl:col-span-9',
      '1/1': 'xl:col-span-12',
    },
  },
})