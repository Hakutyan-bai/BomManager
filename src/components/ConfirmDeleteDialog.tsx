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
      <div className="space-y-3 text-sm">
        <p className="text-gray-700">确定要删除：</p>
        {material && (
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <div className="font-mono text-gray-600">{material.code}</div>
            <div className="font-medium text-gray-900">{material.name}</div>
          </div>
        )}
        <p className="text-gray-500">删除后该物料将从正常列表中隐藏。</p>
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  );
}
