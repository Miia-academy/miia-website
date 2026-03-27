import type { ImageProps } from '@props/types'
import {
  Image as HeroImage,
  Modal,
  ModalContent,
  useDisclosure,
} from '@heroui/react'
import { tv } from 'tailwind-variants'
import { default as NextImage } from 'next/image'
import { storyblokEditable } from '@storyblok/react'

interface ImageComponent {
  blok: ImageProps
  parent?: string
}

export default function Image({ blok, parent }: ImageComponent) {
  if (!blok.image?.filename) return null

  const { isOpen, onOpen, onClose } = useDisclosure()

  const size = blok.image.filename
    .match(/\/(\d+)x(\d+)\//)
    ?.filter((s, i) => !!i)
    ?.map((s) => Number(s))

  const ratio = !!size && size[0] / size[1]

  let width = undefined
  let height = undefined
  let axis = 'width'

  if (!!ratio) {
    width = ratio > 1 ? 1280 : 768 * ratio
    height = ratio < 1 ? 768 : 1280 / ratio
    axis = ratio > 1 ? 'width' : 'height'
  }

  const isFullWith = blok.width?.[0] === '1/1'

  const order: any = !!blok.order ? blok.order.toString() : 'none'

  return (
    <>
      <HeroImage
        {...storyblokEditable(blok)}
        src={blok.image.filename}
        alt={blok.image.alt}
        onClick={onOpen}
        width={'100%'}
        removeWrapper={!!blok.size}
        sizes={`(max-${axis}:512px)::512px,(max-${axis}:768px)::768px,(max-${axis}:1024px):1024px,(max-${axis}:1280px):1280px,1280px`}
        classNames={{
          wrapper: wrapperClasses({
            order: order,
            wrapperChild: parent === 'wrapper',
            sm: blok.width?.[0],
            md: blok.width?.[1],
            lg: blok.width?.[2],
            xl: blok.width?.[3],
          }),
          img: imageClasses({
            order: order,
            normalized: !!blok.size || isFullWith,
            size: blok.size,
            aspect: blok.aspect,
          }),
        }}
      />
      {blok.fullScreen && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          className="max-w-none mx-auto w-auto overflow-hidden max-h-[80vh]"
          classNames={{
            wrapper: 'items-center',
            closeButton:
              'fixed top-2 md:top-4 right-2 md:right-4 text-2xl md:text-4xl text-white bg-transparent hover:bg-transparent active:bg-transparent',
          }}
        >
          <ModalContent className="p-0">
            <NextImage
              src={blok.image.filename}
              alt={blok.image.alt}
              width={width}
              height={height}
              sizes={`(max-${axis}:512px):256px,(max-${axis}:768px):512px,(max-${axis}:1024px):768px,(max-${axis}:1280px):1024px,1280px`}
              fill={!ratio}
            />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

const wrapperClasses = tv({
  base: 'flex-1 col-span-12 sm:order-none h-full',
  variants: {
    wrapperChild: {
      false: 'self-stretch',
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

const imageClasses = tv({
  base: 'h-auto max-h-lg opacity-100',
  variants: {
    size: {
      sm: 'max-w-32',
      md: 'max-w-48',
      lg: 'max-w-64',
    },
    normalized: {
      true: 'h-full sm:aspect-auto md:object-cover',
      false: 'inset-0 object-cover sm:h-full',
    },
    order: {
      '1': '-order-1',
      '2': '-order-2',
      '3': '-order-3',
      '4': '-order-4',
      '5': '-order-5',
      '6': '-order-6',
    },
    aspect: {
      '9/4': 'sm:aspect-9/4 md:aspect-9/4',
      '4/3': 'sm:aspect-4/3 md:aspect-4/3',
      '1/1': 'sm:aspect-square md:aspect-square',
      '3/4': 'sm:aspect-3/4 md:aspect-3/4',
      '4/9': 'sm:aspect-4/9 md:aspect-4/9',
    },
  },
})
