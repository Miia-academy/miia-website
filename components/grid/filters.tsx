// components/grid/filters.tsx
import { Button } from '@components/ui/button'

type Option = { value: string; label: string }

interface FilterGroupProps {
  label: string
  allLabel: string
  options: Option[]
  active: string
  onChange: (value: string) => void
}

/** One row of buttons: "all" plus one button for each option; only one is active. */
export default function FilterGroup({ label, allLabel, options, active, onChange }: FilterGroupProps) {
  const item = (value: string, text: string) => {
    const selected = active === value
    return (
      <Button
        key={value || '_all'}
        size="sm"
        radius="full"
        className="shrink-0"
        variant={selected ? 'solid' : 'flat'}
        color={selected ? 'primary' : 'default'}
        aria-pressed={selected}
        onPress={() => onChange(value)}
      >
        {text}
      </Button>
    )
  }

  return (
    // Mobile: one row that scrolls sideways, edge to edge; from md the buttons wrap
    <div
      role="group"
      aria-label={label}
      className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {item('', allLabel)}
      {options.map((option) => item(option.value, option.label))}
    </div>
  )
}
