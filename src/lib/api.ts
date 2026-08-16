import type {
  ApiErrorBody,
  Category,
  CategoryAttribute,
  Material,
  MaterialListResponse,
  MaterialPayload,
} from "../../shared/types";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.ok) {
    return (await res.json()) as T;
  }

  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // 非 JSON 错误体，忽略。
  }
  const message = body?.error?.message ?? `请求失败（${res.status}）`;
  throw new ApiClientError(body?.error?.code ?? "UNKNOWN", message, res.status);
}

export function listCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function listCategoryAttributes(categoryId: number): Promise<CategoryAttribute[]> {
  return request<CategoryAttribute[]>(`/api/categories/${categoryId}/attributes`);
}

export interface ListMaterialsParams {
  search?: string;
  categoryId?: number;
  page?: number;
  pageSize?: number;
}

export function listMaterials(params: ListMaterialsParams = {}): Promise<MaterialListResponse> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.categoryId !== undefined) q.set("categoryId", String(params.categoryId));
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 20));
  return request<MaterialListResponse>(`/api/materials?${q.toString()}`);
}

export function getMaterial(id: number): Promise<Material> {
  return request<Material>(`/api/materials/${id}`);
}

export function createMaterial(payload: MaterialPayload): Promise<Material> {
  return request<Material>("/api/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateMaterial(id: number, payload: MaterialPayload): Promise<Material> {
  return request<Material>(`/api/materials/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteMaterial(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/materials/${id}`, { method: "DELETE" });
}
