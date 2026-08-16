import type { Category } from "../../shared/types";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected?: number;
  onSelect: (id?: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip active={selected === undefined} onClick={() => onSelect(undefined)}>
        全部
      </Chip>
      {categories.map((c) => (
        <Chip key={c.id} active={selected === c.id} onClick={() => onSelect(c.id)}>
          {c.name}
        </Chip>
      ))}
    </div>
  );
}
