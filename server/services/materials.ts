import type {
  Material,
  MaterialAttributeValue,
  MaterialListResponse,
  MaterialListItem,
  MaterialPayload,
} from "../../shared/types";
import type { CategoryAttributeRow, MaterialRow, MaterialAttributeValueRow } from "../types";
import { badRequest, notFound, conflict } from "../errors";
import { parseOptions } from "../utils";
import * as categoryRepo from "../repos/categories";
import * as materialRepo from "../repos/materials";
import type { AttributeValueInput } from "../repos/materials";

export interface ListMaterialsParams {
  search?: string;
  categoryId?: number;
  page: number;
  pageSize: number;
}

function mapAttributeValue(a: MaterialAttributeValueRow): MaterialAttributeValue {
  return {
    id: a.attribute_id,
    name: a.name,
    type: a.type,
    value: a.value,
    unit: a.unit,
    sortOrder: a.sort_order,
  };
}

function mapMaterial(row: MaterialRow, attrs: MaterialAttributeValueRow[]): Material {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: { id: row.category_id, name: row.category_name },
    attributes: attrs.map(mapAttributeValue),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 校验参数值并组装最终要写入的「属性 id → 值」列表（含空值，保持物料参数完整）。 */
function validateAndBuildValues(
  attrs: CategoryAttributeRow[],
  input: Record<string, string>,
): AttributeValueInput[] {
  const byId = new Map(attrs.map((a) => [a.id, a]));

  // 拒绝不属于该分类的参数，防止伪造 attributeId。
  for (const key of Object.keys(input)) {
    const id = Number(key);
    if (!Number.isInteger(id) || !byId.has(id)) {
      throw badRequest("参数不存在");
    }
  }

  const result: AttributeValueInput[] = [];
  for (const attr of attrs) {
    const raw = input[String(attr.id)];
    const value = raw === undefined || raw === null ? "" : String(raw).trim();

    if (value === "" && attr.required === 1) {
      throw badRequest(`「${attr.name}」不能为空`);
    }
    if (value !== "") {
      if (attr.type === "number" && !Number.isFinite(Number(value))) {
        throw badRequest(`「${attr.name}」必须为数字`);
      }
      if (attr.type === "select") {
        const options = parseOptions(attr.options);
        if (options.length > 0 && !options.includes(value)) {
          throw badRequest(`「${attr.name}」的取值无效`);
        }
      }
    }
    result.push({ attributeId: attr.id, value });
  }
  return result;
}

/** 按分类前缀生成下一个物料编号，如 C000001。 */
async function generateCode(db: D1Database, prefix: string): Promise<string> {
  const row = await db
    .prepare("SELECT code FROM materials WHERE code LIKE ? ORDER BY id DESC LIMIT 1")
    .bind(`${prefix}%`)
    .first<{ code: string }>();
  let next = 1;
  if (row) {
    const n = parseInt(row.code.slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(6, "0")}`;
}

function isUniqueCodeViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("materials.code");
}

export async function listMaterials(db: D1Database, params: ListMaterialsParams): Promise<MaterialListResponse> {
  const { rows, total } = await materialRepo.listMaterials(db, params);
  const attrRows = await materialRepo.listMaterialAttributesBulk(db, rows.map((r) => r.id));

  const byMaterial = new Map<number, MaterialAttributeValueRow[]>();
  for (const a of attrRows) {
    const list = byMaterial.get(a.material_id) ?? [];
    list.push(a);
    byMaterial.set(a.material_id, list);
  }

  const items: MaterialListItem[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    category: { id: r.category_id, name: r.category_name },
    attributes: (byMaterial.get(r.id) ?? []).map(mapAttributeValue),
  }));

  return { items, total, page: params.page, pageSize: params.pageSize };
}

export async function getMaterial(db: D1Database, id: number): Promise<Material | null> {
  const row = await materialRepo.getMaterialByIdRaw(db, id);
  if (!row || row.deleted_at !== null) return null;
  const attrs = await materialRepo.listMaterialAttributes(db, id);
  return mapMaterial(row, attrs);
}

async function getMaterialOrThrow(db: D1Database, id: number): Promise<Material> {
  const material = await getMaterial(db, id);
  if (!material) throw notFound("该物料不存在");
  return material;
}

export async function createMaterial(db: D1Database, payload: MaterialPayload): Promise<Material> {
  const name = payload.name.trim();
  if (!name) throw badRequest("物料名称不能为空");

  const category = await categoryRepo.getCategoryById(db, payload.categoryId);
  if (!category) throw notFound("分类不存在");

  const attrs = await categoryRepo.listAttributesByCategory(db, category.id);
  const values = validateAndBuildValues(attrs, payload.attributes);
  const prefix = category.code_prefix || "M";

  // 编码唯一约束兜底：并发下偶发冲突则重新生成并重试。
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await generateCode(db, prefix);
    try {
      const id = await materialRepo.createMaterial(db, { code, name, categoryId: category.id, attributes: values });
      return await getMaterialOrThrow(db, id);
    } catch (err) {
      if (!isUniqueCodeViolation(err)) throw err;
    }
  }
  throw conflict("物料编号生成冲突，请重试");
}

export async function updateMaterial(db: D1Database, id: number, payload: MaterialPayload): Promise<Material> {
  const existing = await materialRepo.getMaterialByIdRaw(db, id);
  if (!existing) throw notFound("该物料不存在");
  if (existing.deleted_at !== null) throw notFound("该物料已经删除");

  const name = payload.name.trim();
  if (!name) throw badRequest("物料名称不能为空");

  const category = await categoryRepo.getCategoryById(db, payload.categoryId);
  if (!category) throw notFound("分类不存在");

  const attrs = await categoryRepo.listAttributesByCategory(db, category.id);
  const values = validateAndBuildValues(attrs, payload.attributes);

  await materialRepo.updateMaterial(db, { id, name, categoryId: category.id, attributes: values });
  return await getMaterialOrThrow(db, id);
}

/** 软删除。返回是否本次真正删除了该物料（幂等：重复删除不报错）。 */
export async function deleteMaterial(db: D1Database, id: number): Promise<"deleted" | "already_deleted"> {
  const existing = await materialRepo.getMaterialByIdRaw(db, id);
  if (!existing) throw notFound("该物料不存在");
  if (existing.deleted_at !== null) return "already_deleted";

  await materialRepo.softDeleteMaterial(db, id);
  return "deleted";
}
