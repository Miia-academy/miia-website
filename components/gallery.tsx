import type { Gallery as GalleryBlok } from '@types'
import { Fragment, useState } from 'react'
import {
  Image as HeroImage,
  Modal,
  ModalContent,
  useDisclosure,
} from '@heroui/react'
import { tv } from 'tailwind-variants'
import { default as NextImage } from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation } from 'swiper/modules'
import { getImageSizes } from '@modules/formats'
import { storyblokEditable } from '@storyblok/react'

interface GalleryComponentProps {
  blok: GalleryBlok
}

// Definizioni type-safe per evitare conflitti con tailwind-variants
type WidthVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1'
type SizeVariant = '1/8' | '1/4' | '1/2'

export default function Gallery({ blok }: GalleryComponentProps) {
  const rawImages = blok.images || []
  if (!rawImages.length) return null

  const { containerClasses, wrapperClasses, closeClasses } = modalClasses()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [current, setCurrent] = useState(0)

  const handleOpen = (index: number) => {
    setCurrent(index)
    onOpen()
  }

  // 1. Parsing safe dei valori CLI (string -> number)
  const delayNum = blok.delay ? parseFloat(blok.delay as string) : 0
  const autoplay = delayNum > 0 ? { delay: 6500 - 1000 * delayNum } : false

  const modules = []
  if (autoplay) modules.push(Autoplay)
  if (blok.interface) modules.push(Navigation)

  const sizes = [256, 512, 768, 1024, 1280]

  const getSizes = (axis: 'width' | 'height') =>
    sizes
      .map((size, i) =>
        i + 1 !== sizes.length
          ? `(max-${axis}:${sizes[i + 1]}px):${size}px`
          : `${size}px`
      )
      .join(',')

  // Estrazione misure tramite la tua utility
  const images = rawImages.map((image) => getImageSizes(image))

  // 2. Creazione della lista Slides centralizzata (Dry)
  const slides = images.map((slide: ReturnType<typeof getImageSizes>) => {
    const { wrapperClasses: swiperWrapper, imageClasses } = slideClasses()
    return (
      <SwiperSlide key={slide.id} className={swiperWrapper()}>
        <NextImage
          src={slide.filename}
          alt={slide.alt || ''}
          width={
            slide.size.ratio > 1 ? sizes[4] : sizes[2] * slide.size.ratio
          }
          height={
            slide.size.ratio <= 1 ? sizes[2] : sizes[4] / slide.size.ratio
          }
          sizes={getSizes(slide.size.axis)}
          className={imageClasses({ class: 'h-auto' })}
        />
      </SwiperSlide>
    )
  })

  // Rendering Layouts
  const SlideShow = (
    <Swiper
      loop={true}
      autoplay={autoplay}
      slidesPerView={1}
      spaceBetween={24}
      modules={modules}
      navigation={!!blok.interface}
      className="min-h-inherit rounded-xl"
      wrapperClass="min-h-inherit"
    >
      {slides}
    </Swiper>
  )

  const FullScreen = (
    <Fragment>
      {images.map((image: ReturnType<typeof getImageSizes>, index: number) => (
        <div
          key={image.id || index}
          className={thumbClasses({ size: blok.size as SizeVariant })}
          onClick={() => handleOpen(index)}
        >
          <HeroImage
            src={image.filename}
            alt={image.alt || ''}
            width="100%"
            shadow="md"
            classNames={{
              wrapper: 'm-1',
              img: 'inset-0 object-cover rounded-md sm:rounded-xl',
            }}
          />
        </div>
      ))}

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        radius="none"
        backdrop="blur"
        shadow="none"
        className={containerClasses()}
        classNames={{
          wrapper: wrapperClasses(),
          closeButton: closeClasses(),
        }}
      >
        <ModalContent className="p-0">
          <div>
            <Swiper
              loop={true}
              slidesPerView={1}
              spaceBetween={24}
              modules={[Autoplay, Navigation]}
              navigation={true}
              initialSlide={current}
              className="items-center max-w-full max-h-full rounded-xl"
              wrapperClass="min-h-inherit"
            >
              {slides}
            </Swiper>
          </div>
        </ModalContent>
      </Modal>
    </Fragment>
  )

  return (
    <div
      {...storyblokEditable(blok as any)}
      className={galleryClasses({
        isFullScreen: blok.fullScreen,
        smWidth: (blok.width?.[0] as WidthVariant) || undefined,
        mdWidth: (blok.width?.[1] as WidthVariant) || undefined,
        lgWidth: (blok.width?.[2] as WidthVariant) || undefined,
        xlWidth: (blok.width?.[3] as WidthVariant) || undefined,
      })}
    >
      {blok.fullScreen ? FullScreen : SlideShow}
    </div>
  )
}

const galleryClasses = tv({
  base: 'order-last sm:order-none w-full col-span-12',
  variants: {
    isFullScreen: {
      false: 'min-h-sm',
      true: 'flex flex-wrap items-stretch',
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
  },
})

const modalClasses = tv({
  slots: {
    containerClasses:
      'mx-auto w-auto h-auto max-w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-8rem)] overflow-hidden bg-transparent',
    wrapperClasses: 'items-center mx-auto',
    closeClasses:
      'fixed z-50 top-2 right-3 text-3xl md:top-4 md:right-4 md:text-3xl text-white bg-transparent hover:bg-transparent active:bg-transparent',
  },
})

const thumbClasses = tv({
  base: 'flex-none cursor-pointer min-w-24 w-1/6',
  variants: {
    size: {
      '1/8': 'w-1/8',
      '1/4': 'w-1/4',
      '1/2': 'w-1/2',
    },
  },
})

const slideClasses = tv({
  slots: {
    wrapperClasses: 'max-w-inherith max-h-inherith rounded-xl',
    imageClasses: 'max-h-full max-w-full rounded-xl mx-auto',
  },
})