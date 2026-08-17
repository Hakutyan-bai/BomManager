import type { MaterialListItem } from "../../shared/types";
import { Button, Modal } from "./ui";

export function ConfirmDeleteDialog({
  material,
  open,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  material: MaterialListItem | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="确认删除？"
      maxWidth="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? "删除中…" : "删除"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-[#34423b]">确定要删除以下物料？</p>
        {material && (
          <div className="border-y border-[#d7ded9] bg-[#fafbfa] py-3">
            <div className="font-data border-l-2 border-[#b74640] pl-3 text-xs font-semibold text-[#536159]">{material.code}</div>
            <div className="mt-1 break-words pl-3 font-semibold text-[#19231f]">{material.name}</div>
          </div>
        )}
        <p className="text-[#6b7871]">删除后，该物料将不再出现在库存列表和 BOM 匹配结果中。</p>
        {error && <div className="border-l-2 border-[#b74640] bg-[#fbf2f1] px-3 py-2 text-sm text-[#a43f3a]">{error}</div>}
      </div>
    </Modal>
  );
}
