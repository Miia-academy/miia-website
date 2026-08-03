import type { ProcessedPerson } from '@modules/cache'
import { Image, Modal, ModalContent, useDisclosure } from '@heroui/react'
import { YouTubeEmbed } from '@next/third-parties/google'
import Markdown from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { tv } from 'tailwind-variants'

// Mappatura Icone e Testi per i Ruoli
const roles: Record<string, { icon: string; text: string }> = {
  interior: { icon: 'graduation-cap', text: 'studente' },
  style: { icon: 'design-nib', text: 'estetica' },
  design: { icon: 'ruler-combine', text: 'progettazione' },
  cad: { icon: 'one-point-circle', text: 'modellazione' },
  '3d': { icon: 'sphere', text: 'rendering' },
  building: { icon: 'tools', text: 'cantieristica' },
  lighting: { icon: 'light-bulb-on', text: 'illuminotecnica' },
}

interface PersonCardProps {
  person: ProcessedPerson
  isDark?: boolean
}

export default function PersonCard({ person, isDark }: PersonCardProps) {
  const { isOpen, onOpen, onClose } = useDisclosure()

  // Controllo per nascondere i campi in base all'array `hide` del CMS
  const isRoleHidden = person.hide?.includes('role')
  const isDescriptionHidden = person.hide?.includes('description')
  const isImageHidden = person.hide?.includes('image')
  const isTitleHidden = person.hide?.includes('title')

  const imageUrl = person.image?.filename
  const displayTitle = person.title
  const roleData = person.role ? roles[person.role] : null

  // Setup Markdown Typography
  const baseTypography = Typography({ theme: isDark ? 'dark' : 'light', size: 'small' })
  const descriptionTypographyOverrides = {
    ...baseTypography,
    p: {
      component: ({ children }: any) => (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{children}</p>
      ),
    },
  }

  const {
    cardClasses,
    headerClasses,
    thumbClasses,
    iconClasses,
    bodyClasses,
    titleClasses,
    roleClasses,
  } = classes({ hasPlayer: !!person.video })

  return (
    <>
      <article className={cardClasses()}>
        {/* Avatar Circolare con eventuale Player Video */}
        {!isImageHidden && imageUrl && (
          <div className={headerClasses()} onClick={person.video ? onOpen : undefined}>
            {person.video && (
              <i className={iconClasses({ class: 'iconoir-play-solid player' })} />
            )}
            <Image
              classNames={{ wrapper: thumbClasses() }}
              src={imageUrl}
              alt={person.image?.alt || displayTitle || ''}
              width="100%"
              isZoomed={true}
            />
          </div>
        )}

        {/* Info Persona */}
        <div className={bodyClasses()}>
          {!isTitleHidden && displayTitle && (
            <h4 className={titleClasses()}>{displayTitle}</h4>
          )}

          {!isRoleHidden && roleData && (
            <h6 className={roleClasses()}>
              <i className={`iconoir-${roleData.icon} text-sm`} />
              <span>{roleData.text}</span>
            </h6>
          )}

          {!isDescriptionHidden && person.description && (
            <Markdown options={{ overrides: descriptionTypographyOverrides }}>
              {person.description}
            </Markdown>
          )}
        </div>
      </article>

      {/* Modal Video YouTube */}
      {!!person.video && isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          className="mx-auto max-h-[80vh] w-auto max-w-none overflow-hidden"
          classNames={{
            wrapper: 'items-center',
            closeButton:
              'fixed top-2 right-2 md:top-4 md:right-4 text-2xl md:text-4xl text-white bg-transparent hover:bg-transparent active:bg-transparent',
          }}
        >
          <ModalContent>
            <YouTubeEmbed
              videoid={person.video}
              params="?rel=0&modestbranding=1&autohide=1&showinfo=0&controls=0"
              width={280}
              height={500}
              style="contain:none;height:inherit;width:inherit;"
            />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

// -- Tailwind Variants (Ripristino Stili Originali) --
const classes = tv({
  slots: {
    cardClasses:
      'flex flex-col items-center gap-3 w-full max-w-40 mx-auto md:max-w-full bg-transparent',
    headerClasses:
      'flex items-center justify-center w-full aspect-square relative cursor-pointer max-w-32 min-w-32',
    iconClasses: 'text-foreground transition-all pointer-events-none',
    thumbClasses: 'absolute inset-0 rounded-full overflow-hidden z-10',
    bodyClasses: 'text-center space-y-1.5',
    titleClasses: 'font-semibold text-base md:text-lg leading-snug',
    roleClasses: 'text-xs md:text-sm leading-none inline-flex items-center justify-center gap-1.5 text-neutral-600 dark:text-neutral-400',
  },
  variants: {
    hasPlayer: {
      true: {
        headerClasses:
          '[&_.player]:hover:opacity-100 [&_.player]:hover:translate-y-0 [&_.thumb]:hover:scale-125',
        iconClasses:
          'player z-30 translate-y-12 opacity-0 text-3xl text-white drop-shadow-md',
      },
    },
  },
})