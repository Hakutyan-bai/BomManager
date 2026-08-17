import { Button, Select } from "./ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [10, 20, 50, 100];

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-[#6b7871]">
        <span className="font-data text-xs">共 {total} 条</span>
        <Select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="每页条数"
          className="h-8 w-auto py-0 pr-8 text-xs"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} 条/页
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="上一页" title="上一页">
          <ChevronLeft size={16} aria-hidden />
        </Button>
        <span className="font-data min-w-14 px-1 text-center text-xs text-[#536159]">
          {page} / {totalPages}
        </span>
        <Button size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="下一页" title="下一页">
          <ChevronRight size={16} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
