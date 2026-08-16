import type { MaterialListItem } from "../../shared/types";
import { formatValue } from "../lib/format";
import { Badge, Button, EmptyState, Spinner } from "./ui";

function attributeSummary(m: MaterialListItem): string {
  return m.attributes
    .filter((a) => a.value !== "")
    .map((a) => formatValue(a.value, a.unit))
    .join(" · ");
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
  onView: (m: MaterialListItem) => void;
  onEdit: (m: MaterialListItem) => void;
  onDelete: (m: MaterialListItem) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="暂无物料" description="点击右上角「添加物料」创建第一条物料" />;
  }

  return (
    <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">编号</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">名称</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">分类</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">剩余数量</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {items.map((m) => (
            <tr key={m.id} onClick={() => onView(m)} className="cursor-pointer hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-700">{m.code}</td>
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900">{m.name}</div>
                {m.attributes.some((a) => a.value !== "") && (
                  <div className="mt-0.5 max-w-md truncate text-xs text-gray-400">{attributeSummary(m)}</div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Badge>{m.category.name}</Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm text-gray-700">{m.quantity}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(m);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(m);
                    }}
                  >
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
