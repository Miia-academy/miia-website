import type { Process as ProcessBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { Fragment } from 'react'
import { tv } from 'tailwind-variants'

interface ProcessComponentProps {
  blok: ProcessBlok
}

const processClasses = tv({
  base: 'flex flex-col md:flex-row flex-wrap gap-2 items-start sm:items-center md:items-start',
})

const stepClasses = tv({
  base: 'flex flex-col sm:flex-row md:flex-col gap-4 flex-1 items-start sm:items-center md:items-start',
})

const indexClasses = tv({
  base: 'font-serif font-black text-5xl leading-snug',
})

const arrowClasses = tv({
  base: 'rotate-90 md:rotate-0 iconoir-arrow-right text-2xl lg:px-4 md:self-center',
})

export default function Process({ blok }: ProcessComponentProps) {
  // Fallback di sicurezza in caso l'array dei blocchi sia vuoto o undefined
  const steps = blok.steps || []

  return (
    <div className="col-span-12" {...storyblokEditable(blok as any)}>
      {/* Type Narrowing: ci assicuriamo che title sia effettivamente una stringa stampabile */}
      {typeof blok.title === 'string' && blok.title.trim() !== '' ? (
        <h4 className="font-bold text-2xl">{blok.title}</h4>
      ) : null}

      <div className={processClasses()}>
        {steps.map((step: any, index: number) => {
          // Fallback protettivo anche per i contenuti annidati
          const contents = step.contents || []

          return (
            <Fragment key={step._uid || index}>
              {/* Sostituito !!index con un costrutto ternario pulito che ritorna null */}
              {index > 0 ? <i className={arrowClasses()} /> : null}

              <div className={stepClasses()} {...storyblokEditable(step as any)}>
                <h6 className={indexClasses()}>{index + 1}</h6>

                {contents.map((content: any) => (
                  <StoryblokComponent blok={content} key={content._uid} />
                ))}
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}