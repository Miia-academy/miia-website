import type { WrapperProps } from '@props/types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { tv } from 'tailwind-variants'

type OrderVariant = 'none' | '1' | '2' | '3' | '4' | '5' | '6'

interface WrapperComponent {
  blok: WrapperProps
  theme?: 'dark' | 'light'
  parent?: string
}

export default function Wrapper({ blok, theme, parent }: WrapperComponent) {
  const order: OrderVariant = blok.order
    ? (blok.order.toString() as OrderVariant)
    : 'none'

  const background = blok.contents.find(
    (content) => content.component === 'background'
  )
  const contents = blok.contents.filter(
    (content) => content.component !== 'background'
  )

  const isCarouselChild = parent === "carousel"

  return (
    <div
      {...storyblokEditable(blok)}
      className={classes({
        order: order,
        smWidth: blok.width?.[0],
        mdWidth: blok.width?.[1],
        lgWidth: blok.width?.[2],
        xlWidth: blok.width?.[3],
        row: blok.row,
        justify: `${blok.row ? 'justify' : 'items'}-${blok.justify}`,
        hasBackground: !!background,
        isCarouselChild,
      })}
    >
      {blok.contents.map((content, index) => (
        <StoryblokComponent
          key={index}
          blok={content}
          parent={blok.component}
          theme={theme}
        />
      ))}
      {!!background && (
        <>
          <div className={gradientClasses()} />
          <StoryblokComponent blok={background} />
        </>
      )}
    </div>
  )
}

const gradientClasses = tv({
  base: 'gradient absolute inset-0 bg-gradient-to-tr to-60% -z-10 from-dark mix-blend-multiply',
})

const classes = tv({
  base: 'col-span-12 flex flex-col flex-wrap gap-4 min-h-12 sm:order-none items-start',
  variants: {
    row: {
      true: 'flex-row sm:max-md:col-span-12',
    },
    hasBackground: {
      true: 'relative aspect-4/3 shadow-inner z-0 rounded-xl p-3 md:p-6 overflow-hidden justify-end [&_article]:flex-none [&_article]:backdrop-blur-sm [&_article]:rounded-3xl [&_article]:gap-1 ',
    },
    justify: {
      'items-right': 'sm:items-end',
      'items-center': 'sm:items-center',
      'items-left': 'sm:items-start',
      'justify-right': 'sm:justify-start',
      'justify-center': 'sm:justify-center',
      'justify-left': 'sm:justify-end',
    },
    order: {
      none: 'order-none',
      '1': '-order-1',
      '2': '-order-2',
      '3': '-order-3',
      '4': '-order-4',
      '5': '-order-5',
      '6': '-order-6',
    },
    smWidth: {
      '1/4': 'sm:col-span-3',
      '1/3': 'sm:col-span-4',
      '1/2': 'sm:col-span-6',
      '2/3': 'sm:col-span-8',
      '3/4': 'sm:col-span-9',
      '1/1': 'sm:col-span-12',
    },
    mdWidth: {
      '1/4': 'md:col-span-3',
      '1/3': 'md:col-span-4',
      '1/2': 'md:col-span-6',
      '2/3': 'md:col-span-8',
      '3/4': 'md:col-span-9',
      '1/1': 'md:col-span-12',
    },
    lgWidth: {
      '1/4': 'lg:col-span-3',
      '1/3': 'lg:col-span-4',
      '1/2': 'lg:col-span-6',
      '2/3': 'lg:col-span-8',
      '3/4': 'lg:col-span-9',
      '1/1': 'lg:col-span-12',
    },
    xlWidth: {
      '1/4': 'xl:col-span-3',
      '1/3': 'xl:col-span-4',
      '1/2': 'xl:col-span-6',
      '2/3': 'xl:col-span-8',
      '3/4': 'xl:col-span-9',
      '1/1': 'xl:col-span-12',
    },
    isCarouselChild: {
      true: "w-full"
    }
  },
  compoundVariants: [
    {
      isCarouselChild: true,
      smWidth: "1/2",
      class: "md:w-1/2"
    },
    {
      isCarouselChild: true,
      smWidth: "1/3",
      class: "md:w-1/3"
    },
    {
      isCarouselChild: true,
      smWidth: "1/4",
      class: "md:w-1/2"
    },
    {
      isCarouselChild: true,
      smWidth: "2/3",
      class: "md:w-2/3"
    }
  ]
})

/* 
  {
    <Card
    {...storyblokEditable(blok)}
    className={classes({
      size: blok.size,
      row: blok.row,
      boxed: true,
      order: blok.order.toString(),
      hasBackground: hasBackground >= 0,
    })}
    style={
      background
        ? { backgroundImage: `url(${background.asset[0].filename})` }
        : undefined
    }
    >
    {!background && hasPicture && (
      <CardHeader className='z-10'>
        {blok.contents
          .filter((c) => c.component === 'picture')
          .map((content, index) => (
            <StoryblokComponent blok={content} key={index} />
          ))}
      </CardHeader>
    )}
    <CardBody className='z-10'>
      {blok.contents
        .filter((c) => c.component !== 'picture')
        .map((content, index) => (
          <StoryblokComponent blok={content} key={index} />
        ))}
    </CardBody>
    </Card> 
  }
*/
