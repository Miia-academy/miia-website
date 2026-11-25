/**
 * Size combinations of the Text block, chosen with its "Dimensioni" field
 * (text_style in Storyblok): one choice sets the size of title and description
 * together. The classes are the text scale of styles/globals.css.
 *
 * Without a choice the title keeps the size of its markdown level (#, ##, ...)
 * and the description keeps the body size.
 */
export type TextStyle = 'highlight' | 'standard' | 'section' | 'compact'

interface TextStyleClasses {
  // Replaces the size class of every heading in the title
  title: string
  // Paragraph size of the description (Typography "size"); undefined = body
  description?: 'small' | 'large'
}

export const TEXT_STYLES: Record<TextStyle, TextStyleClasses> = {
  highlight: { title: 'type-display', description: 'large' },
  standard: { title: 'type-title-2' },
  section: { title: 'type-title-3' },
  compact: { title: 'type-title-4', description: 'small' },
}

export function textStyle(value?: string): TextStyleClasses | undefined {
  return value && value in TEXT_STYLES ? TEXT_STYLES[value as TextStyle] : undefined
}
