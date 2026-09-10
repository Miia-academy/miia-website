import type { Carousel as CarouselBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { tv } from 'tailwind-variants'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation } from 'swiper/modules'

interface CarouselComponentProps {
  blok: CarouselBlok
  parent?: 'page' | 'enroll' | 'section'
}

export default function Carousel({ blok, parent }: CarouselComponentProps) {
  const slidesList = blok.slides || []
  if (!slidesList.length) return null

  // Conversione safe dei valori numerici generati come stringa dalla CLI
  const delayNum = blok.delay ? parseFloat(blok.delay) : 0
  const viewNum = blok.view ? parseInt(blok.view, 10) : 0

  const slides = slidesList.map((slide) => (
    <SwiperSlide
      {...storyblokEditable(slide as any)}
      className="overflow-visible min-h-inherit"
      key={slide._uid}
    >
      {slide.component === 'section' ? (
        <StoryblokComponent blok={slide} parent={blok.component} />
      ) : (
        <div className="flex flex-wrap w-full justify-center">
          <StoryblokComponent blok={slide} parent={blok.component} />
        </div>
      )}
    </SwiperSlide>
  ))

  const Tag = parent === 'page' ? 'section' : 'div'

  // ✅ Prendiamo la stringa così com'è o la convalidiamo con la variante
  const orderAttr = (blok.order as OrderVariant) || undefined

  // Gestione Moduli Swiper
  const modules = []
  const autoplay = delayNum > 0 ? { delay: 6500 - 1000 * delayNum } : false

  if (autoplay) modules.push(Autoplay)
  if (blok.interface) modules.push(Navigation)

  // Calcolo dinamico dei Breakpoints
  const smView = viewNum > 0 ? viewNum : 1
  const mdView = viewNum > 0 ? viewNum + 1 : 1
  const lgView = viewNum > 0 ? (viewNum > 1 ? viewNum * 2 : viewNum + 1) : 1
  const xlView = viewNum > 0 ? (viewNum > 1 ? viewNum * 3 : viewNum + 1) : 1

  const isFullHeight = slidesList[0]?.component === 'section'

  return (
    <Tag
      id={blok.id ? blok.id.replaceAll(' ', '-') : undefined}
      className={tagClasses({
        order: orderAttr,
        isFullHeight,
      })}
    >
      <Swiper
        {...storyblokEditable(blok as any)}
        loop={true}
        autoplay={autoplay}
        slidesPerView={1}
        spaceBetween={viewNum ? 24 : 0}
        className={swiperClasses({ pageChild: parent === 'page' })}
        wrapperClass={swiperClasses()}
        breakpoints={{
          384: { slidesPerView: smView },
          768: { slidesPerView: mdView },
          1024: { slidesPerView: lgView },
          1280: { slidesPerView: xlView },
        }}
        modules={modules}
        navigation={!!blok.interface}
      >
        {slides}
      </Swiper>
    </Tag>
  )
}

// ✅ Tipo per le chiavi stringa accettate
type OrderVariant = '0' | '1' | '2' | '3' | '4' | '5' | '6'

const tagClasses = tv({
  base: 'order-last sm:order-none w-full col-span-12',
  variants: {
    order: {
      '0': '',
      '1': '-order-1',
      '2': '-order-2',
      '3': '-order-3',
      '4': '-order-4',
      '5': '-order-5',
      '6': '-order-6',
    },
    isFullHeight: {
      false: 'min-h-sm',
      true: 'min-h-lg',
    },
  },
})

const swiperClasses = tv({
  base: 'min-h-inherit',
  variants: {
    pageChild: {
      false: 'rounded-xl',
    },
  },
})