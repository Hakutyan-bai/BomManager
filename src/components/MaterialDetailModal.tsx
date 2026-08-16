import type { Material } from "../../shared/types";
import { formatDateTime, formatValue } from "../lib/format";
import { Button, Modal, Spinner } from "./ui";

export function MaterialDetailModal({
  open,
  material,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  material: Material | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="物料详情"
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <Spinner className="h-5 w-5" />
        </div>
      )}
      {!loading && error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!loading && !error && material && (
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm text-gray-500">{material.code}</span>
            <h3 className="text-lg font-semibold text-gray-900">{material.name}</h3>
          </div>

          <div className="mt-4 flex gap-3 text-sm">
            <span className="w-16 shrink-0 text-gray-400">分类</span>
            <span className="text-gray-900">{material.category.name}</span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">参数</p>
            <div className="mt-2 divide-y divide-gray-100 border-y border-gray-100">
              {material.attributes.map((a) => (
                <div key={a.id} className="flex justify-between gap-4 py-2 text-sm">
                  <span className="text-gray-500">{a.name}</span>
                  <span className="text-right text-gray-900">{formatValue(a.value, a.unit)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-1 text-xs text-gray-400">
            <div>创建时间：{formatDateTime(material.createdAt)}</div>
            <div>更新时间：{formatDateTime(material.updatedAt)}</div>
          </div>
        </div>
      )}
    </Modal>
  );
}
