import type { MaterialRow, MaterialRowWithDeleted, MaterialAttributeValueRow } from "../types";

export interface AttributeValueInput {
  attributeId: number;
  value: string;
  /** 所选单位；空字符串表示沿用分类默认单位。 */
  unit: string;
}

export interface MaterialListQuery {
  search?: string;
  categoryId?: number;
  page: number;
  pageSize: number;
}

export interface MaterialListResult {
  rows: MaterialRow[];
  total: number;
}

/** 转义 LIKE 通配符，避免用户输入中的 % / _ / \ 被当作通配符。 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => "\\" + ch);
}

export async function listMaterials(db: D1Database, query: MaterialListQuery): Promise<MaterialListResult> {
  const conditions: string[] = ["m.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (query.categoryId !== undefined) {
    conditions.push("m.category_id = ?");
    params.push(query.categoryId);
  }

  if (query.search) {
    const like = `%${escapeLike(query.search)}%`;
    // 搜索同时匹配：编号、名称、参数值、参数名、以及「值+单位」组合（如 100nF）。
    conditions.push(
      `(m.code LIKE ? ESCAPE '\\'
         OR m.name LIKE ? ESCAPE '\\'
         OR EXISTS (
           SELECT 1 FROM material_attributes ma
           JOIN category_attributes ca ON ca.id = ma.attribute_id
           WHERE ma.material_id = m.id
             AND (ma.value LIKE ? ESCAPE '\\'
                  OR ca.name LIKE ? ESCAPE '\\'
                  OR ma.value || COALESCE(NULLIF(ma.unit, ''), ca.unit) LIKE ? ESCAPE '\\')
         ))`,
    );
    params.push(like, like, like, like, like);
  }

  const where = conditions.join(" AND ");
  const base = `FROM materials m JOIN categories c ON c.id = m.category_id WHERE ${where}`;

  const countStmt = db.prepare(`SELECT COUNT(DISTINCT m.id) AS total ${base}`);
  const listStmt = db.prepare(
    `SELECT DISTINCT m.id, m.code, m.name, m.quantity, m.category_id, c.name AS category_name, m.created_at, m.updated_at
     ${base}
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
  );

  const countRow = await countStmt.bind(...params).first<{ total: number }>();
  const listResult = await listStmt
    .bind(...params, query.pageSize, (query.page - 1) * query.pageSize)
    .all<MaterialRow>();

  return { rows: listResult.results, total: countRow?.total ?? 0 };
}

/** 返回含删除标记的物料行（用于判断「不存在」与「已删除」）。 */
export async function getMaterialByIdRaw(db: D1Database, id: number): Promise<MaterialRowWithDeleted | null> {
  const row = await db
    .prepare(
      `SELECT m.id, m.code, m.name, m.quantity, m.category_id, c.name AS category_name, m.created_at, m.updated_at, m.deleted_at
       FROM materials m
       JOIN categories c ON c.id = m.category_id
       WHERE m.id = ?`,
    )
    .bind(id)
    .first<MaterialRowWithDeleted>();
  return row ?? null;
}

export async function listMaterialAttributes(
  db: D1Database,
  materialId: number,
): Promise<MaterialAttributeValueRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ca.id AS attribute_id, ma.material_id, ma.value, ca.name, ca.type,
              COALESCE(NULLIF(ma.unit, ''), ca.unit) AS unit, ca.sort_order
       FROM material_attributes ma
       JOIN category_attributes ca ON ca.id = ma.attribute_id
       WHERE ma.material_id = ?
       ORDER BY ca.sort_order ASC, ca.id ASC`,
    )
    .bind(materialId)
    .all<MaterialAttributeValueRow>();
  return results;
}

export async function listMaterialAttributesBulk(
  db: D1Database,
  materialIds: number[],
): Promise<MaterialAttributeValueRow[]> {
  if (materialIds.length === 0) return [];
  const placeholders = materialIds.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT ca.id AS attribute_id, ma.material_id, ma.value, ca.name, ca.type,
              COALESCE(NULLIF(ma.unit, ''), ca.unit) AS unit, ca.sort_order
       FROM material_attributes ma
       JOIN category_attributes ca ON ca.id = ma.attribute_id
       WHERE ma.material_id IN (${placeholders})
       ORDER BY ca.sort_order ASC, ca.id ASC`,
    )
    .bind(...materialIds)
    .all<MaterialAttributeValueRow>();
  return results;
}

/**
 * 创建物料 + 参数值，单次 batch（D1 事务）保证原子性：
 * 要么物料与参数值全部写入，要么全部回滚。
 * 参数值通过 code 子查询定位新物料，避免依赖外部返回的主键。
 */
export async function createMaterial(
  db: D1Database,
  input: { code: string; name: string; categoryId: number; quantity: number; attributes: AttributeValueInput[] },
): Promise<number> {
  const stmts = [
    db
      .prepare("INSERT INTO materials (code, name, category_id, quantity) VALUES (?, ?, ?, ?)")
      .bind(input.code, input.name, input.categoryId, input.quantity),
    ...input.attributes.map((a) =>
      db
        .prepare(
          "INSERT INTO material_attributes (material_id, attribute_id, value, unit) VALUES ((SELECT id FROM materials WHERE code = ?), ?, ?, ?)",
        )
        .bind(input.code, a.attributeId, a.value, a.unit),
    ),
  ];
  await db.batch(stmts);

  const row = await db
    .prepare("SELECT id FROM materials WHERE code = ?")
    .bind(input.code)
    .first<{ id: number }>();
  return row!.id;
}

/**
 * 更新物料（改名 / 改分类 / 改参数），单次 batch 原子执行：
 * 更新基本信息 → 删除旧参数值 → 写入新参数值，不会产生半完成状态。
 */
export async function updateMaterial(
  db: D1Database,
  input: { id: number; name: string; categoryId: number; quantity: number; attributes: AttributeValueInput[] },
): Promise<void> {
  const stmts = [
    db
      .prepare("UPDATE materials SET name = ?, category_id = ?, quantity = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL")
      .bind(input.name, input.categoryId, input.quantity, input.id),
    db.prepare("DELETE FROM material_attributes WHERE material_id = ?").bind(input.id),
    ...input.attributes.map((a) =>
      db
        .prepare("INSERT INTO material_attributes (material_id, attribute_id, value, unit) VALUES (?, ?, ?, ?)")
        .bind(input.id, a.attributeId, a.value, a.unit),
    ),
  ];
  await db.batch(stmts);
}

/** 软删除：仅置 deleted_at，不物理删除。 */
export async function softDeleteMaterial(db: D1Database, id: number): Promise<void> {
  await db
    .prepare("UPDATE materials SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}
