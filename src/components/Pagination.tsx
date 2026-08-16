import { Button, Select } from "./ui";

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
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>共 {total} 条</span>
        <Select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="w-auto rounded-md border-gray-300 py-1 pr-8 text-sm"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} 条/页
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          上一页
        </Button>
        <span className="px-1 text-sm text-gray-600">
          {page} / {totalPages}
        </span>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          下一页
        </Button>
      </div>
    </div>
  );
}
