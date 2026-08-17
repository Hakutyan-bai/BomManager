import { useEffect, useState } from "react";
import { Boxes, FileSpreadsheet, Plus } from "lucide-react";
import type { Material, MaterialListItem } from "../shared/types";
import { deleteMaterial, getMaterial } from "./lib/api";
import { useCategories } from "./hooks/useCategories";
import { useDebounce } from "./hooks/useDebounce";
import { useMaterials } from "./hooks/useMaterials";
import { SearchBar } from "./components/SearchBar";
import { CategoryFilter } from "./components/CategoryFilter";
import { MaterialTable } from "./components/MaterialTable";
import { Pagination } from "./components/Pagination";
import { MaterialFormModal, type EditableMaterial } from "./components/MaterialFormModal";
import { MaterialDetailModal } from "./components/MaterialDetailModal";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog";
import { BomQueryModal } from "./components/BomQueryModal";
import { Button } from "./components/ui";

export default function App() {
  const { categories, error: categoriesError } = useCategories();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, pageSize]);

  const { data, loading, error, refresh } = useMaterials({ search: debouncedSearch, categoryId, page, pageSize });

  const [formOpen, setFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<EditableMaterial | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bomOpen, setBomOpen] = useState(false);

  function openCreate() {
    setEditingMaterial(null);
    setFormOpen(true);
  }

  function openEdit(material: MaterialListItem) {
    setEditingMaterial(material);
    setFormOpen(true);
  }

  async function openView(material: MaterialListItem) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailMaterial(null);
    try {
      setDetailMaterial(await getMaterial(material.id));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMaterial(null);
  }

  function handleSaved() {
    closeForm();
    setPage(1);
    refresh();
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMaterial(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } catch (requestError) {
      setDeleteError(requestError instanceof Error ? requestError.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5]">
      <header className="border-b border-[#d7ded9] bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[#146b52] text-white shadow-[0_1px_3px_rgba(15,40,31,0.2)]">
              <Boxes size={19} strokeWidth={1.8} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[17px] font-semibold text-[#19231f] sm:text-[19px]">物料中心</h1>
              <p className="hidden text-xs text-[#7a877f] sm:block">电子物料库存与 BOM 匹配</p>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button onClick={() => setBomOpen(true)} className="w-full px-2.5 sm:w-auto sm:px-3.5">
              <FileSpreadsheet size={17} strokeWidth={1.8} aria-hidden />
              <span className="hidden sm:inline">BOM 查询</span>
              <span className="sm:hidden">BOM</span>
            </Button>
            <Button variant="primary" onClick={openCreate} className="w-full px-2.5 sm:w-auto sm:px-3.5">
              <Plus size={17} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">添加物料</span>
              <span className="sm:hidden">添加</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-3 border-b border-[#d7ded9] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <SearchBar value={searchInput} onChange={setSearchInput} />
          </div>
          <p className="font-data shrink-0 text-xs text-[#6b7871]" aria-live="polite">
            {loading && !data ? "正在读取库存…" : `检索到 ${data?.total ?? 0} 项物料`}
          </p>
        </div>

        <div className="py-4">
          <CategoryFilter categories={categories} selected={categoryId} onSelect={setCategoryId} />
        </div>

        <section className="overflow-hidden rounded-[8px] border border-[#d7ded9] bg-white shadow-[0_2px_10px_rgba(25,35,31,0.04)]" aria-label="物料列表">
          {categoriesError && (
            <div className="border-b border-[#ead0ce] bg-[#fbf2f1] px-4 py-3 text-sm text-[#a43f3a]">
              加载分类失败：{categoriesError}
            </div>
          )}
          {error && (
            <div className="border-b border-[#ead0ce] bg-[#fbf2f1] px-4 py-3 text-sm text-[#a43f3a]">
              加载物料失败：{error}
            </div>
          )}
          <MaterialTable
            items={data?.items ?? []}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
          {data && data.total > 0 && (
            <div className="border-t border-[#d7ded9] bg-[#fafbfa] px-3 py-3 sm:px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </section>
      </main>

      <MaterialFormModal
        open={formOpen}
        mode={editingMaterial ? "edit" : "create"}
        material={editingMaterial}
        categories={categories}
        onClose={closeForm}
        onSaved={handleSaved}
      />
      <MaterialDetailModal
        open={detailOpen}
        material={detailMaterial}
        loading={detailLoading}
        error={detailError}
        onClose={() => setDetailOpen(false)}
      />
      <ConfirmDeleteDialog
        material={deleteTarget}
        open={deleteTarget !== null}
        loading={deleting}
        error={deleteError}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
      <BomQueryModal open={bomOpen} onClose={() => setBomOpen(false)} />
    </div>
  );
}
