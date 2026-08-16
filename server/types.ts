// Worker 环境与数据库行类型定义。
// 行类型保持 snake_case，与数据库列名一致；API 层再映射为 camelCase。

export interface Env {
  DB: D1Database;
}

export interface CategoryRow {
  id: number;
  name: string;
  code_prefix: string;
}

export interface CategoryAttributeRow {
  id: number;
  category_id: number;
  name: string;
  type: "text" | "number" | "select";
  unit: string;
  unit_options: string | null;
  required: number;
  sort_order: number;
  options: string | null;
}

export interface MaterialRow {
  id: number;
  code: string;
  name: string;
  quantity: number;
  category_id: number;
  category_name: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialRowWithDeleted extends MaterialRow {
  deleted_at: string | null;
}

export interface MaterialAttributeValueRow {
  attribute_id: number; // category_attributes.id，前端据此回填表单
  material_id: number;
  value: string;
  name: string;
  type: "text" | "number" | "select";
  unit: string;
  sort_order: number;
}
