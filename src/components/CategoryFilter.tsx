import type { Category } from "../../shared/types";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-[5px] border px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146b52] focus-visible:ring-offset-2 ${
        active
          ? "border-[#146b52] bg-[#e8f3ee] text-[#0e5c46]"
          : "border-transparent bg-transparent text-[#647169] hover:border-[#d7ded9] hover:bg-white hover:text-[#26332d]"
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
    <div className="scrollbar-subtle -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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
