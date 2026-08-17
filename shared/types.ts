// 前后端共享的 API 契约类型。
// 前端通过这些类型渲染表单/列表，后端按这些类型序列化响应。

export interface Category {
  id: number;
  name: string;
}

export type AttributeType = "text" | "number" | "select";

export interface CategoryAttribute {
  id: number;
  name: string;
  type: AttributeType;
  unit: string;
  /** number 类型参数的可选单位集合；为空数组表示固定单位。 */
  unitOptions: string[];
  required: boolean;
  sortOrder: number;
  options: string[];
}

export interface MaterialAttributeValue {
  id: number;
  name: string;
  type: AttributeType;
  value: string;
  unit: string;
  sortOrder: number;
}

export interface MaterialCategory {
  id: number;
  name: string;
}

export interface Material {
  id: number;
  code: string;
  name: string;
  category: MaterialCategory;
  /** 剩余数量（件）。 */
  quantity: number;
  attributes: MaterialAttributeValue[];
  createdAt: string;
  updatedAt: string;
}

export interface MaterialListItem {
  id: number;
  code: string;
  name: string;
  category: MaterialCategory;
  quantity: number;
  attributes: MaterialAttributeValue[];
}

export interface MaterialListResponse {
  items: MaterialListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaterialPayload {
  name: string;
  categoryId: number;
  /** 键为 attribute id（字符串），值为用户填写的值。 */
  attributes: Record<string, string>;
  /** 键为 attribute id（字符串），值为所选单位；仅对配置了 unitOptions 的参数生效。 */
  attributeUnits?: Record<string, string>;
  /** 剩余数量（件）；省略视为 0。 */
  quantity?: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

// ---------- BOM 查询 ----------

/** BOM 中的一行（由前端从 Excel 解析后提交）。 */
export interface BomItem {
  /** 型号 / Name，自由文本，如 "47Ω 电阻"、"100nF"、"TPS54360DDAR"。 */
  model: string;
  /** 位号 / Designator，如 "R1,R3"；可能为空。 */
  designator?: string;
  /** 封装 / Footprint，如 "R0603"、"SOIC-8_L5.0-W4.0"；可能为空。 */
  package?: string;
  /** 数量 / Quantity，非负整数。 */
  quantity: number;
  /** 备注 / Remark；可能为空。 */
  remark?: string;
}

/** BOM 行匹配到的物料摘要。 */
export interface BomMatchMaterial {
  id: number;
  code: string;
  name: string;
  categoryName: string;
  /** 剩余数量（件）。 */
  stock: number;
  /** 参数 + 封装的紧凑展示，如「100nF · 25V · 10% · 0603」；无参数时为空串。 */
  params: string;
}

/** 匹配成功的一行 BOM：物料 + 库存 + 缺口。 */
export interface BomMatched {
  bom: BomItem;
  material: BomMatchMaterial;
  /** 缺口 = max(0, 需求数量 - 剩余数量)。 */
  shortfall: number;
  /** 为空表示精确匹配；非空时说明为什么需要用户确认替代。 */
  substituteReasons: string[];
}

export interface BomMatchResponse {
  /** 匹配到且库存 > 0（不用买）。 */
  have: BomMatched[];
  /** 无精确匹配时可人工确认的替代物料（小一档封装、更高耐压或其它规格差异）。 */
  substitute: BomMatched[];
  /** 匹配到但库存 = 0（缺货）。 */
  outOfStock: BomMatched[];
  /** 未匹配到（未收录，需购买/新建物料）。 */
  notFound: BomItem[];
}
