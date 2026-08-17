import { Pencil, Trash2 } from "lucide-react";
import type { MaterialListItem } from "../../shared/types";
import { formatValue } from "../lib/format";
import { Badge, Button, EmptyState, Spinner } from "./ui";

function attributeSummary(material: MaterialListItem): string {
  return material.attributes
    .filter((attribute) => attribute.value !== "")
    .map((attribute) => formatValue(attribute.value, attribute.unit))
    .join(" · ");
}

function MaterialCode({ code }: { code: string }) {
  return (
    <span className="font-data inline-flex min-h-6 items-center border-l-2 border-[#146b52] bg-[#f1f5f2] px-2 text-xs font-semibold text-[#34423b]">
      {code}
    </span>
  );
}

function StockValue({ quantity, compact = false }: { quantity: number; compact?: boolean }) {
  const empty = quantity <= 0;
  return (
    <span className={`font-data inline-flex items-center gap-1.5 text-sm font-semibold ${empty ? "text-[#a43f3a]" : "text-[#146b52]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${empty ? "bg-[#b74640]" : "bg-[#2d876c]"}`} aria-hidden />
      {quantity}
      {!compact && <span className="font-sans text-xs font-normal text-[#7a877f]">件</span>}
    </span>
  );
}

function RowActions({ material, onEdit, onDelete }: { material: MaterialListItem; onEdit: (material: MaterialListItem) => void; onDelete: (material: MaterialListItem) => void }) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(material);
        }}
        aria-label={`编辑 ${material.name}`}
        title="编辑"
      >
        <Pencil size={15} strokeWidth={1.8} aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="dangerGhost"
        className="h-8 w-8"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(material);
        }}
        aria-label={`删除 ${material.name}`}
        title="删除"
      >
        <Trash2 size={15} strokeWidth={1.8} aria-hidden />
      </Button>
    </div>
  );
}

export function MaterialTable({
  items,
  loading,
  onView,
  onEdit,
  onDelete,
}: {
  items: MaterialListItem[];
  loading: boolean;
  onView: (material: MaterialListItem) => void;
  onEdit: (material: MaterialListItem) => void;
  onDelete: (material: MaterialListItem) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#7a877f]">
        <Spinner className="h-5 w-5" />
        读取物料中
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="暂无物料" description="添加第一项物料，建立可检索的库存记录。" />;
  }

  return (
    <div className={loading ? "opacity-55" : ""} aria-busy={loading}>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full table-fixed">
          <thead className="border-b border-[#d7ded9] bg-[#f7f9f7]">
            <tr>
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold text-[#6b7871]">物料编号</th>
              <th className="w-[40%] px-4 py-3 text-left text-xs font-semibold text-[#6b7871]">名称与参数</th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold text-[#6b7871]">分类</th>
              <th className="w-[14%] px-4 py-3 text-right text-xs font-semibold text-[#6b7871]">库存</th>
              <th className="w-[14%] px-4 py-3 text-right text-xs font-semibold text-[#6b7871]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6ebe7] bg-white">
            {items.map((material) => {
              const summary = attributeSummary(material);
              return (
                <tr
                  key={material.id}
                  onClick={() => onView(material)}
                  className="cursor-pointer transition-colors hover:bg-[#f5f8f6] focus-within:bg-[#f5f8f6]"
                >
                  <td className="whitespace-nowrap px-4 py-3.5"><MaterialCode code={material.code} /></td>
                  <td className="px-4 py-3.5">
                    <div className="truncate text-sm font-semibold text-[#19231f]">{material.name}</div>
                    {summary && <div className="font-data mt-1 truncate text-xs text-[#7a877f]">{summary}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5"><Badge>{material.category.name}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right"><StockValue quantity={material.quantity} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <RowActions material={material} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#e1e7e2] md:hidden">
        {items.map((material) => {
          const summary = attributeSummary(material);
          return (
            <article key={material.id} className="px-3.5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onView(material)} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146b52]">
                  <div className="flex flex-wrap items-center gap-2">
                    <MaterialCode code={material.code} />
                    <Badge>{material.category.name}</Badge>
                  </div>
                  <h3 className="mt-2 break-words text-sm font-semibold text-[#19231f]">{material.name}</h3>
                  {summary && <p className="font-data mt-1.5 line-clamp-2 break-words text-xs leading-5 text-[#6b7871]">{summary}</p>}
                </button>
                <StockValue quantity={material.quantity} compact />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#edf0ed] pt-2">
                <button type="button" onClick={() => onView(material)} className="text-xs font-semibold text-[#24658a] hover:text-[#194d6b]">
                  查看详情
                </button>
                <RowActions material={material} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
