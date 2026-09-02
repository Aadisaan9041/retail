import { cn } from '@/lib/utils';
import { Category } from '@/types/retail';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  const allCategories = [{ id: 'all', name: 'All Products' }, ...categories];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {allCategories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelectCategory(category.id === 'all' ? 'all' : category.name)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
            (category.id === 'all' && selectedCategory === 'all') ||
              category.name === selectedCategory
              ? 'bg-primary text-primary-foreground shadow-lg'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
