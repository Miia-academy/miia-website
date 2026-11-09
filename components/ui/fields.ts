import { cn } from '@heroui/react'

/**
 * classNames for HeroUI fields on the light grey surface (enrollment forms).
 * Pass as classNames={surfaceInput} / classNames={surfaceSelect}.
 */
export const surfaceInput = { inputWrapper: 'bg-surface' }

export const surfaceSelect = { trigger: 'bg-surface' }

/** Choices as pills (one click), as in the enrollment forms: RadioGroup + Radio classNames={pillRadio}. */
export const pillRadio = {
  base: cn(
    'inline-flex m-0 rounded-full border-2 border-neutral-200 bg-surface px-4 py-2',
    'data-[selected=true]:border-primary data-[selected=true]:bg-white cursor-pointer',
  ),
  wrapper: 'hidden',
  labelWrapper: 'ms-0',
  label: 'text-sm',
}

/** Multiple choices as pills: CheckboxGroup + Checkbox classNames={pillCheckbox}. */
export const pillCheckbox = {
  base: cn(
    'inline-flex m-0 max-w-none rounded-full border-2 border-neutral-200 bg-surface px-4 py-2',
    'data-[selected=true]:border-primary data-[selected=true]:bg-white cursor-pointer',
  ),
  wrapper: 'hidden',
  label: 'text-sm ms-0',
}
