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
  attributes: MaterialAttributeValue[];
  createdAt: string;
  updatedAt: string;
}

export interface MaterialListItem {
  id: number;
  code: string;
  name: string;
  category: MaterialCategory;
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
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
