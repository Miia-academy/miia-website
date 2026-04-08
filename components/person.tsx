import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import type {
  PersonProps,
  Roles,
  ImageData,
  ActionProps,
  PersonData,
} from '@props/types'
import { Image, Modal, ModalContent, useDisclosure } from '@heroui/react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from './typography'
import { tv } from 'tailwind-variants'
import { YouTubeEmbed } from '@next/third-parties/google'

interface PersonComponent {
  blok: PersonProps
}

const roles: { [key in Roles]: { icon: string; text: string } } = {
  interior: { icon: 'graduation-cap', text: 'studente' },
  style: { icon: 'design-nib', text: 'estetica' },
  design: { icon: 'ruler-combine', text: 'progettazione' },
  cad: { icon: 'one-point-circle', text: 'modellazione' },
  '3d': { icon: 'sphere', text: 'rendering' },
  building: { icon: 'tools', text: 'cantieristica' },
  lighting: { icon: 'light-bulb-on', text: 'illuminotecnica' },
}

const data: Array<keyof PersonData> = [
  'title',
  'description',
  'role',
  'image',
  'video',
  'links',
]

type Person = {
  title: string | null
  description: string | null
  role: Roles | null
  image: ImageData | null
  video: string | null
  links: Array<ActionProps> | null
}

const defaultPerson: Person = {
  title: null,
  description: null,
  role: null,
  image: null,
  video: null,
  links: null,
}

const Person = ({ blok }: PersonComponent) => {
  console.log("blok:\n", blok)
  console.log("alias:\n", blok.alias.content.image)
  console.log("image:\n", blok.image)
  const person: Person = {
    ...defaultPerson,
    ...Object.fromEntries(
      data.map((key) => {
        let alias = blok.alias?.content
        let value = alias?.[key] || blok[key] || null
        if (!blok.hide) {
          return [key, value]
        } else {
          return [key, !blok.hide.includes(key) ? value : null]
        }
      })
    ),
  }
  const { isOpen, onOpen, onClose } = useDisclosure()

  const {
    cardClasses,
    headerClasses,
    thumbClasses,
    iconClasses,
    bodyClasses,
    titleClasses,
    roleClasses,
    textClasses,
  } = classes()

  return (
    <article
      id={blok.uuid}
      className={cardClasses()}
      {...storyblokEditable(blok)}
    >
      {person.image && (
        <div
          className={headerClasses({ hasPlayer: !!person.video })}
          onClick={onOpen}
        >
          {person.video && (
            <i
              className={iconClasses({
                class: 'iconoir-play-solid',
                hasPlayer: true,
              })}
            />
          )}
          <Image
            classNames={{
              wrapper: thumbClasses(),
            }}
            src={person.image.filename}
            alt={person.image.alt}
            width={'100%'}
            isZoomed={true}
          />
        </div>
      )}
      <div className={bodyClasses()}>
        {person.title && <h4 className={titleClasses()}>{person.title}</h4>}
        {person.role && (
          <h6 className={roleClasses()}>
            <i
              className={iconClasses({
                class: `iconoir-${roles[person.role].icon}`,
              })}
            />
            <span>{roles[person.role].text}</span>
          </h6>
        )}
        {person.description &&
          compiler(person.description, {
            wrapper: ({ children }) => (
              <p className={textClasses()}>{children}</p>
            ),
            forceWrapper: true,
            overrides: Typography({ size: 'small' }),
          })}
        {!!person.links && (
          <div className="flex items-center justify-center">
            {person.links.map((link, index) => (
              <StoryblokComponent blok={link} key={index} />
            ))}
          </div>
        )}
      </div>
      {!!person.video && isOpen && (
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
          <ModalContent>
            <YouTubeEmbed
              videoid={person.video}
              params="?rel=0&modestbranding=1&autohide=1&showinfo=0&showinfo=0&controls=0"
              width={280}
              height={500}
              style="contain:none;height:inherit;width:inherit;"
            />
          </ModalContent>
        </Modal>
      )}
    </article>
  )
}

const classes = tv({
  slots: {
    cardClasses:
      'col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 flex flex-col items-center gap-3 max-w-40 mx-auto md:max-w-full',
    headerClasses:
      'flex items-center justify-center w-full aspect-square relative cursor-pointer sm:max-w-32 min-w-32',
    iconClasses: 'text-foreground transition-all pointer-events-none',
    thumbClasses: 'absolute inset-0 rounded-full overflow-hidden z-10',
    bodyClasses: 'sm:text-center space-y-2',
    titleClasses: 'font-semibold text-xl',
    roleClasses: 'text-sm leading-none inline-flex items-center gap-2',
    textClasses: 'text-small',
  },
  variants: {
    hasPlayer: {
      true: {
        headerClasses:
          '[&_.player]:hover:opacity-100 [&_.player]:hover:translate-y-0 [&_.thumb]:hover:scale-125 ',
        iconClasses:
          'player z-30 translate-y-12 opacity-0 text-3xl text-background',
      },
    },
  },
})

export default Person
