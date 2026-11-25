import type { Image as ImageBlok } from '@types'
import {
  Modal,
  ModalContent,
  useDisclosure,
} from '@heroui/react'
import { Image as HeroImage } from '@components/ui/image'
import { tv } from 'tailwind-variants'
import { blokWidths, gridBaseClass, widthList, wrapperWidthClasses } from '@components/ui/wrapper-width'
import { gridSizes, responsiveImage } from '@modules/images'
import { storyblokEditable } from '@storyblok/react'

// Definizioni type-safe per Tailwind Variants
type WidthVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1'
type OrderVariant = '1' | '2' | '3' | '4' | '5' | '6'
type SizeVariant = 'sm' | 'md' | 'lg' | 'xl'
type AspectVariant = '9/4' | '4/3' | '1/1' | '3/4' | '4/9'

interface ImageComponentProps {
  blok: ImageBlok
  parent?: string
}

export default function Image({ blok, parent }: ImageComponentProps) {
  // Larghezze per dispositivo (campi nuovi) o dal vecchio campo Larghezza
  const ownWidths = blokWidths(blok as any)
  // Immagine con Dimensione messa direttamente nella sezione: tiene la sua colonna
  // (un quarto se la larghezza è vuota) e l'immagine sta centrata lì dentro
  const sizedInSection = !!blok.size && parent === 'section'
  const hasWidth = Object.values(ownWidths).some(Boolean)
  const widths = sizedInSection && !hasWidth ? { sm: '1/4' as const } : ownWidths
  const widthItems = widthList(widths)
  const { isOpen, onOpen, onClose } = useDisclosure()

  if (!blok.image?.filename) return null

  const isFullWith = widthItems[0] === '1/1'
  const isWrapperChild = parent === 'wrapper'
  const orderAttr = blok.order ? (blok.order.toString() as OrderVariant) : undefined
  const image = responsiveImage(blok.image.filename, gridSizes(widthItems))

  return (
    <>
      <HeroImage
        {...storyblokEditable(blok as any)}
        src={image.src}
        srcSet={image.srcSet}
        sizes={image.sizes}
        alt={blok.image.alt || ''}
        onClick={onOpen}
        width="100%"
        removeWrapper={!!blok.size && !sizedInSection}
        classNames={{
          wrapper: wrapperClasses({
            order: orderAttr,
            wrapperChild: isWrapperChild,
            sizedInSection,
            // In a Wrapper (flex) the grid col-span does nothing: width comes from wrapperWidthClasses
            sm: isWrapperChild ? undefined : (widthItems[0] as WidthVariant) || undefined,
            md: isWrapperChild ? undefined : (widthItems[1] as WidthVariant) || undefined,
            lg: isWrapperChild ? undefined : (widthItems[2] as WidthVariant) || undefined,
            xl: isWrapperChild ? undefined : (widthItems[3] as WidthVariant) || undefined,
            class: isWrapperChild ? wrapperWidthClasses(widths) : gridBaseClass(widths),
          }),
          img: imageClasses({
            order: orderAttr,
            normalized: !!blok.size || isFullWith,
            size: (blok.size as SizeVariant) || undefined,
            aspect: (blok.aspect as AspectVariant) || undefined,
            contain: !!blok.contain,
            sizedInSection,
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
            <img
              {...responsiveImage(blok.image.filename, '100vw')}
              alt={blok.image.alt || ''}
              className="block h-auto max-h-[80vh] w-auto max-w-[100vw]"
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
    sizedInSection: {
      true: 'flex items-center justify-center',
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
  base: 'h-auto max-h-lg',
  variants: {
    size: {
      sm: 'max-w-32',
      md: 'max-w-48',
      lg: 'max-w-64',
      xl: 'max-w-96',
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
    // Mostra intera: niente ritaglio (loghi), l'immagine sta tutta nel suo spazio
    contain: {
      true: 'object-contain md:object-contain',
    },
    // Nella sezione l'altezza segue la larghezza (e l'Aspetto), non l'altezza della riga
    sizedInSection: {
      true: 'h-auto sm:h-auto w-full',
    },
  },
})