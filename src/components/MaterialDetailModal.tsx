import type { Material } from "../../shared/types";
import { formatDateTime, formatValue } from "../lib/format";
import { Badge, Button, Modal, Spinner } from "./ui";

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
      {!loading && error && <div className="border-l-2 border-[#b74640] bg-[#fbf2f1] px-3 py-2 text-sm text-[#a43f3a]">{error}</div>}
      {!loading && !error && material && (
        <div>
          <div className="border-l-2 border-[#146b52] pl-3">
            <span className="font-data text-xs font-semibold text-[#536159]">{material.code}</span>
            <h3 className="mt-1 break-words text-lg font-semibold text-[#19231f]">{material.name}</h3>
          </div>

          <div className="mt-5 grid grid-cols-2 border-y border-[#d7ded9] bg-[#fafbfa]">
            <div className="border-r border-[#d7ded9] px-3 py-3">
              <div className="text-xs text-[#7a877f]">分类</div>
              <div className="mt-1.5"><Badge>{material.category.name}</Badge></div>
            </div>
            <div className="px-3 py-3">
              <div className="text-xs text-[#7a877f]">剩余库存</div>
              <div className={`font-data mt-1 text-base font-semibold ${material.quantity > 0 ? "text-[#146b52]" : "text-[#a43f3a]"}`}>
                {material.quantity} <span className="font-sans text-xs font-normal text-[#7a877f]">件</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-[#34423b]">物料参数</p>
            <div className="mt-2 divide-y divide-[#e6ebe7] border-y border-[#d7ded9]">
              {material.attributes.map((a) => (
                <div key={a.id} className="flex justify-between gap-4 py-2 text-sm">
                  <span className="text-[#6b7871]">{a.name}</span>
                  <span className="font-data text-right text-[#19231f]">{formatValue(a.value, a.unit)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="font-data mt-4 space-y-1 text-[11px] text-[#8a968f]">
            <div>创建时间：{formatDateTime(material.createdAt)}</div>
            <div>更新时间：{formatDateTime(material.updatedAt)}</div>
          </div>
        </div>
      )}
    </Modal>
  );
}
