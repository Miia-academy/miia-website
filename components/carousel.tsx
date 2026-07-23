import type { CarouselProps } from '@props/types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { tv } from 'tailwind-variants'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation } from 'swiper/modules'

interface CarouselComponent {
  blok: CarouselProps
  parent?: 'page' | 'enroll' | 'section'
}

export default function Carousel({ blok, parent }: CarouselComponent) {
  if (!blok.slides.length) return null

  const slides = blok.slides.map((slide, index) => (
    <SwiperSlide
      {...storyblokEditable(slide)}
      className="overflow-visible min-h-inherit"
      key={index}
    >
      {slide.component === "section" ? (
        <StoryblokComponent blok={slide} parent={blok.component} />
      ) : (
        <div className="flex flex-wrap w-full justify-center">
          <StoryblokComponent blok={slide} parent={blok.component} />
        </div>
      )}
    </SwiperSlide>
  ))

  const Tag = parent === 'page' ? 'section' : 'div'

  const order: any = !!blok.order ? blok.order.toString() : 'none'

  const modules = []
  const autoplay = blok.delay > 0 ? { delay: 6500 - 1000 * blok.delay } : false
  autoplay && modules.push(Autoplay)
  blok.interface && modules.push(Navigation)

  const view = Number(blok.view)
  const smView = blok.view > 0 ? view : 1
  const mdView = blok.view > 0 ? view + 1 : 1
  const lgView = blok.view > 0 ? (view > 1 ? view * 2 : view + 1) : 1
  const xlView = blok.view > 0 ? (view > 1 ? view * 3 : view + 1) : 1

  console.log(modules.map(m => m.name))
  console.log(blok.interface)

  return (
    <Tag
      id={blok.id && blok.id.replaceAll(' ', '-')}
      className={tagClasses({
        order: order,
        isFullHeight: blok.slides[0].component === 'section',
      })}
    >
      <Swiper
        {...storyblokEditable(blok)}
        loop={true}
        autoplay={autoplay}
        slidesPerView={1}
        spaceBetween={blok.view ? 24 : 0}
        className={swiperClasses({ pageChild: parent === 'page' })}
        wrapperClass={swiperClasses()}
        breakpoints={{
          384: { slidesPerView: smView },
          768: { slidesPerView: mdView },
          1024: { slidesPerView: lgView },
          1280: { slidesPerView: xlView },
        }}
        modules={modules}
        navigation={blok.interface}
      >
        {slides}
      </Swiper>
    </Tag>
  )
}

const tagClasses = tv({
  base: 'order-last sm:order-none w-full col-span-12',
  variants: {
    order: {
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
