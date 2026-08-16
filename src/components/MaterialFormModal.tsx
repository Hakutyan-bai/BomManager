import { useEffect, useState, type FormEvent } from "react";
import type { Category, CategoryAttribute, MaterialAttributeValue, MaterialCategory, MaterialPayload } from "../../shared/types";
import { createMaterial, listCategoryAttributes, updateMaterial } from "../lib/api";
import { Button, Field, Input, Modal, Select, Spinner } from "./ui";

/** 表单编辑所需的最小物料形状（Material 与 MaterialListItem 均可满足）。 */
export interface EditableMaterial {
  id: number;
  name: string;
  category: MaterialCategory;
  attributes: MaterialAttributeValue[];
}

function buildInitialValues(attrs: CategoryAttribute[], material: EditableMaterial | null, editMode: boolean): Record<string, string> {
  const next: Record<string, string> = {};
  for (const a of attrs) {
    const existing = editMode && material ? material.attributes.find((v) => v.id === a.id) : undefined;
    next[String(a.id)] = existing?.value ?? "";
  }
  return next;
}

function renderAttributeInput(
  a: CategoryAttribute,
  value: string,
  onChange: (v: string) => void,
) {
  if (a.type === "select") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        <option value="">请选择</option>
        {a.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }

  const input =
    a.type === "number" ? (
      <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder="请输入" />
    ) : (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="请输入" />
    );

  if (a.unit) {
    return (
      <div className="flex items-center gap-2">
        {input}
        <span className="shrink-0 text-sm text-gray-500">{a.unit}</span>
      </div>
    );
  }
  return input;
}

export function MaterialFormModal({
  open,
  mode,
  material,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  material: EditableMaterial | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [attrDefs, setAttrDefs] = useState<CategoryAttribute[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时重置表单状态。
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    if (mode === "edit" && material) {
      setName(material.name);
      setCategoryId(material.category.id);
    } else {
      setName("");
      setCategoryId("");
      setValues({});
      setAttrDefs([]);
    }
  }, [open, mode, material]);

  // 分类变化时加载参数定义并初始化参数值。
  useEffect(() => {
    if (!open || categoryId === "") {
      setAttrDefs([]);
      return;
    }
    let cancelled = false;
    setLoadingAttrs(true);
    listCategoryAttributes(categoryId)
      .then((attrs) => {
        if (cancelled) return;
        setAttrDefs(attrs);
        setValues(buildInitialValues(attrs, mode === "edit" ? material : null, mode === "edit"));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载参数失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingAttrs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, categoryId, mode, material]);

  function setValue(id: number, v: string) {
    setValues((prev) => ({ ...prev, [String(id)]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("物料名称不能为空");
      return;
    }
    if (categoryId === "") {
      setError("请选择物料分类");
      return;
    }

    const payload: MaterialPayload = { name: name.trim(), categoryId, attributes: values };
    setSubmitting(true);
    try {
      if (mode === "edit" && material) {
        await updateMaterial(material.id, payload);
      } else {
        await createMaterial(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "编辑物料" : "添加物料"}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button type="submit" form="material-form" variant="primary" disabled={submitting}>
            {submitting ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      <form id="material-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="物料名称" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：贴片陶瓷电容"
            autoFocus
          />
        </Field>

        <Field label="分类" required>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full"
          >
            <option value="">请选择分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {categoryId !== "" && (
          <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">参数</p>
            {loadingAttrs && (
              <div className="flex justify-center py-2 text-gray-400">
                <Spinner />
              </div>
            )}
            {!loadingAttrs && attrDefs.length === 0 && (
              <p className="text-sm text-gray-400">该分类暂无参数定义</p>
            )}
            {!loadingAttrs &&
              attrDefs.map((a) => (
                <Field key={a.id} label={a.name} required={a.required}>
                  {renderAttributeInput(a, values[String(a.id)] ?? "", (v) => setValue(a.id, v))}
                </Field>
              ))}
          </div>
        )}

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </form>
    </Modal>
  );
}
