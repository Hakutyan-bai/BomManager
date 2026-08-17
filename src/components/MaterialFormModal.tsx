import { useEffect, useState, type FormEvent } from "react";
import type { Category, CategoryAttribute, MaterialAttributeValue, MaterialCategory, MaterialPayload } from "../../shared/types";
import { createMaterial, listCategoryAttributes, updateMaterial } from "../lib/api";
import { Button, Field, Input, Modal, Select, Spinner } from "./ui";

/** 表单编辑所需的最小物料形状（Material 与 MaterialListItem 均可满足）。 */
export interface EditableMaterial {
  id: number;
  name: string;
  category: MaterialCategory;
  quantity: number;
  attributes: MaterialAttributeValue[];
}

/** 由参数定义 + 待编辑物料构造初始值：普通参数的值，以及可选单位的所选单位。 */
function buildInitialState(
  attrs: CategoryAttribute[],
  material: EditableMaterial | null,
  editMode: boolean,
): { values: Record<string, string>; units: Record<string, string> } {
  const values: Record<string, string> = {};
  const units: Record<string, string> = {};
  for (const a of attrs) {
    const existing = editMode && material ? material.attributes.find((v) => v.id === a.id) : undefined;
    values[String(a.id)] = existing?.value ?? "";
    if (a.unitOptions.length > 0) {
      const chosen =
        existing?.unit && a.unitOptions.includes(existing.unit)
          ? existing.unit
          : a.unitOptions.includes(a.unit)
            ? a.unit
            : a.unitOptions[0];
      units[String(a.id)] = chosen;
    }
  }
  return { values, units };
}

function renderAttributeInput(
  a: CategoryAttribute,
  value: string,
  onChange: (v: string) => void,
  unit: string,
  onUnitChange: (v: string) => void,
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

  // number 参数若配置了可选单位集合，渲染单位下拉框；否则沿用固定单位展示。
  if (a.type === "number" && a.unitOptions.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">{input}</div>
        <Select value={unit} onChange={(e) => onUnitChange(e.target.value)} className="w-24 shrink-0">
          {a.unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>
    );
  }

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
  const [quantity, setQuantity] = useState("");
  const [attrDefs, setAttrDefs] = useState<CategoryAttribute[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
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
      setQuantity(String(material.quantity));
    } else {
      setName("");
      setCategoryId("");
      setQuantity("");
      setValues({});
      setUnits({});
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
        const init = buildInitialState(attrs, mode === "edit" ? material : null, mode === "edit");
        setValues(init.values);
        setUnits(init.units);
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

  function setUnit(id: number, v: string) {
    setUnits((prev) => ({ ...prev, [String(id)]: v }));
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

    const payload: MaterialPayload = {
      name: name.trim(),
      categoryId,
      attributes: values,
      attributeUnits: units,
      quantity: quantity.trim() === "" ? 0 : Number(quantity),
    };
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

        <div className="grid gap-4 sm:grid-cols-2">
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

          <Field label="剩余数量" hint="当前库存，可为 0">
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="pr-10"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[#7a877f]">件</span>
            </div>
          </Field>
        </div>

        {categoryId !== "" && (
          <section className="space-y-4 border-t border-[#d7ded9] pt-4">
            <div>
              <h3 className="text-sm font-semibold text-[#34423b]">物料参数</h3>
              <p className="mt-0.5 text-xs text-[#7a877f]">参数会参与 BOM 智能匹配</p>
            </div>
            {loadingAttrs && (
              <div className="flex justify-center py-3 text-[#7a877f]">
                <Spinner />
              </div>
            )}
            {!loadingAttrs && attrDefs.length === 0 && (
              <p className="border-y border-[#e6ebe7] py-3 text-sm text-[#7a877f]">该分类暂无参数定义</p>
            )}
            {!loadingAttrs &&
              attrDefs.map((a) => (
                <Field key={a.id} label={a.name} required={a.required}>
                  {renderAttributeInput(
                    a,
                    values[String(a.id)] ?? "",
                    (v) => setValue(a.id, v),
                    units[String(a.id)] ?? "",
                    (v) => setUnit(a.id, v),
                  )}
                </Field>
              ))}
          </section>
        )}

        {error && <div className="border-l-2 border-[#b74640] bg-[#fbf2f1] px-3 py-2 text-sm text-[#a43f3a]">{error}</div>}
      </form>
    </Modal>
  );
}
