import { Input, Button } from '@heroui/react'

interface GridFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  activeCategory: string
  onCategoryChange: (category: string) => void
  categories?: string[]
}

export default function GridFilters({
  searchTerm,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categories = [],
}: GridFiltersProps) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
      <Input
        placeholder="Cerca..."
        value={searchTerm}
        onValueChange={onSearchChange}
        className="max-w-xs"
        variant="flat"
        isClearable
        onClear={() => onSearchChange('')}
      />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeCategory === '' ? 'solid' : 'flat'}
            color={activeCategory === '' ? 'primary' : 'default'}
            onPress={() => onCategoryChange('')}
          >
            Tutti
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? 'solid' : 'flat'}
              color={activeCategory === cat ? 'primary' : 'default'}
              onPress={() => onCategoryChange(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}