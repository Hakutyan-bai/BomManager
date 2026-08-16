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
