// components/cards/tagRow.tsx
import { useEffect, useRef, useState } from 'react'
import { tagLabel } from '@modules/grid'

const GAP = 8 // gap-2

const pill = 'shrink-0 whitespace-nowrap rounded-full bg-neutral-900/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md'

/** How many pills fit in the width, leaving room for the "+N" pill when some are left out. */
export function fittingCount(widths: number[], available: number, moreWidth: number): number {
  let used = 0
  for (let i = 0; i < widths.length; i++) {
    used += (i ? GAP : 0) + widths[i]
    const rest = i + 1 < widths.length ? GAP + moreWidth : 0
    if (used + rest > available) return i
  }
  return widths.length
}

/** Tags of a card on one line: the ones that fit, then "+N" for the others. */
export default function TagRow({ tags }: { tags: string[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(tags.length)

  useEffect(() => {
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return
    const update = () => {
      const pills = [...measure.children] as HTMLElement[]
      const more = pills.pop()
      setShown(fittingCount(pills.map((p) => p.offsetWidth), row.clientWidth, more?.offsetWidth || 0))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row)
    return () => observer.disconnect()
  }, [tags])

  if (!tags.length) return null
  const hidden = tags.length - shown

  return (
    <div ref={rowRef} className="relative flex gap-2 overflow-hidden">
      {tags.slice(0, shown).map((tag) => (
        <span key={tag} className={pill}>
          {tagLabel(tag)}
        </span>
      ))}
      {hidden > 0 && (
        <span className={pill} title={tags.slice(shown).map(tagLabel).join(', ')}>
          +{hidden}
        </span>
      )}

      {/* All the pills, invisible, only to measure them */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-2">
        {tags.map((tag) => (
          <span key={tag} className={pill}>
            {tagLabel(tag)}
          </span>
        ))}
        <span className={pill}>+{tags.length}</span>
      </div>
    </div>
  )
}
