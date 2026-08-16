import { useEffect, useState } from "react";
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
import { Button } from "./components/ui";

export default function App() {
  const { categories, error: categoriesError } = useCategories();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 搜索/筛选/每页条数变化时回到第一页。
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, pageSize]);

  const { data, loading, error, refresh } = useMaterials({ search: debouncedSearch, categoryId, page, pageSize });

  // 弹窗状态。
  const [formOpen, setFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<EditableMaterial | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openCreate() {
    setEditingMaterial(null);
    setFormOpen(true);
  }

  function openEdit(m: MaterialListItem) {
    setEditingMaterial(m);
    setFormOpen(true);
  }

  async function openView(m: MaterialListItem) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailMaterial(null);
    try {
      setDetailMaterial(await getMaterial(m.id));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "加载详情失败");
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
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">物料中心</h1>
          <Button variant="primary" onClick={openCreate}>
            <span aria-hidden>+</span> 添加物料
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-80">
            <SearchBar value={searchInput} onChange={setSearchInput} />
          </div>
        </div>

        <CategoryFilter categories={categories} selected={categoryId} onSelect={setCategoryId} />

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {categoriesError && (
            <div className="border-b border-gray-200 px-4 py-3 text-sm text-red-600">加载分类失败：{categoriesError}</div>
          )}
          {error && <div className="border-b border-gray-200 px-4 py-3 text-sm text-red-600">加载物料失败：{error}</div>}
          <MaterialTable
            items={data?.items ?? []}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
          {data && data.total > 0 && (
            <div className="border-t border-gray-200 px-4 py-3">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
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
    </div>
  );
}
