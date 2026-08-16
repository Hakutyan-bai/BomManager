import type { Category, CategoryAttribute } from "../../shared/types";
import { notFound } from "../errors";
import { parseOptions } from "../utils";
import * as categoryRepo from "../repos/categories";

export async function listCategories(db: D1Database): Promise<Category[]> {
  const rows = await categoryRepo.listCategories(db);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function listAttributes(db: D1Database, categoryId: number): Promise<CategoryAttribute[]> {
  const category = await categoryRepo.getCategoryById(db, categoryId);
  if (!category) throw notFound("分类不存在");

  const rows = await categoryRepo.listAttributesByCategory(db, categoryId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    unit: r.unit,
    unitOptions: parseOptions(r.unit_options),
    required: r.required === 1,
    sortOrder: r.sort_order,
    options: parseOptions(r.options),
  }));
}
