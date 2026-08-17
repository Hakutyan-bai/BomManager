import { Search, X } from "lucide-react";

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7a877f]" size={17} strokeWidth={1.8} aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索编号、名称或参数"
        className="h-10 w-full rounded-[6px] border border-[#cbd3cd] bg-white pl-10 pr-10 text-sm text-[#19231f] shadow-[inset_0_1px_1px_rgba(25,35,31,0.03)] placeholder:text-[#8a968f] focus:border-[#146b52] focus:outline-none focus:ring-2 focus:ring-[#146b52]/15"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="清空搜索"
          title="清空搜索"
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[5px] text-[#7a877f] hover:bg-[#eef2ef] hover:text-[#19231f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146b52]"
        >
          <X size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}
