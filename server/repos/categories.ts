import type { CategoryRow, CategoryAttributeRow } from "../types";

export async function listCategories(db: D1Database): Promise<CategoryRow[]> {
  const { results } = await db
    .prepare("SELECT id, name, code_prefix FROM categories ORDER BY id ASC")
    .all<CategoryRow>();
  return results;
}

export async function getCategoryById(db: D1Database, id: number): Promise<CategoryRow | null> {
  const row = await db
    .prepare("SELECT id, name, code_prefix FROM categories WHERE id = ?")
    .bind(id)
    .first<CategoryRow>();
  return row ?? null;
}

export async function listAttributesByCategory(
  db: D1Database,
  categoryId: number,
): Promise<CategoryAttributeRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, category_id, name, type, unit, required, sort_order, options
       FROM category_attributes
       WHERE category_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .bind(categoryId)
    .all<CategoryAttributeRow>();
  return results;
}
