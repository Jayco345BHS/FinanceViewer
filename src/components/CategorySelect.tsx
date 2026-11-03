import type { Category } from '../types';

export default function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function CategoryBadge({ category }: { category: Category | undefined }) {
  if (!category) return <span className="muted">—</span>;
  return (
    <span className="cat-badge" style={{ background: category.color }}>
      {category.name}
    </span>
  );
}
