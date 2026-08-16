import { beforeAll, describe, expect, it } from "vitest";
import { SELF, applyD1Migrations, env } from "cloudflare:test";
import initialSql from "../migrations/0001_initial.sql?raw";
import seedSql from "../migrations/0002_seed_categories.sql?raw";
import type {
  ApiErrorBody,
  Category,
  CategoryAttribute,
  Material,
  MaterialListResponse,
} from "../shared/types";

const BASE = "http://example.com";

interface ApiResult<T> {
  status: number;
  body: T;
}

/** 以真实 HTTP 请求驱动 Worker，覆盖路由 → 服务 → 仓库 → D1 的完整链路。 */
async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await SELF.fetch(`${BASE}${path}`, init);
  return { status: res.status, body: (await res.json()) as T };
}

function json(method: string, payload?: unknown): RequestInit {
  return {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}

/** 通过 API 动态读取某分类的参数 id（不硬编码自增主键）。 */
async function fetchAttrIds(categoryId: number): Promise<Map<string, number>> {
  const { status, body } = await api<CategoryAttribute[]>(`/api/categories/${categoryId}/attributes`);
  expect(status).toBe(200);
  const map = new Map<string, number>();
  for (const a of body) map.set(a.name, a.id);
  return map;
}

let capIds: Map<string, number>;
let icIds: Map<string, number>;

/**
 * 去除行注释并按分号切分为单条 SQL。本项目的迁移文件较简单，
 * 字符串字面量中不含 `;` 与 `--`，此切分是安全的。
 */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, "").trim())
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

beforeAll(async () => {
  // 每个测试文件运行在独立 workerd 与隔离的 D1 中，这里建表并灌入种子分类。
  await applyD1Migrations(env.DB, [
    { name: "0001_initial", queries: splitSqlStatements(initialSql) },
    { name: "0002_seed_categories", queries: splitSqlStatements(seedSql) },
  ]);
  capIds = await fetchAttrIds(2); // 电容
  icIds = await fetchAttrIds(7); // IC
});

function capAttributes(capacity: string, overrides: Record<string, string> = {}): Record<string, string> {
  return { [String(capIds.get("容量")!)]: capacity, ...overrides };
}

async function createCap(name: string, capacity: string, overrides: Record<string, string> = {}): Promise<Material> {
  const { status, body } = await api<Material>(
    "/api/materials",
    json("POST", { name, categoryId: 2, attributes: capAttributes(capacity, overrides) }),
  );
  expect(status).toBe(201);
  return body;
}

describe("健康检查与分类", () => {
  it("GET /api/health 返回 ok", async () => {
    const { status, body } = await api<{ ok: boolean }>("/api/health");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("列出 9 个分类", async () => {
    const { status, body } = await api<Category[]>("/api/categories");
    expect(status).toBe(200);
    expect(body).toHaveLength(9);
    expect(body.map((c) => c.name)).toContain("电阻");
    expect(body.map((c) => c.name)).toContain("电容");
    expect(body.map((c) => c.name)).toContain("其他");
  });

  it("读取电容分类的参数定义", async () => {
    const { status, body } = await api<CategoryAttribute[]>("/api/categories/2/attributes");
    expect(status).toBe(200);
    expect(body).toHaveLength(5);
    const cap = body.find((a) => a.name === "容量");
    expect(cap).toBeDefined();
    expect(cap!.type).toBe("number");
    expect(cap!.unit).toBe("nF");
    expect(cap!.required).toBe(true);
    const pack = body.find((a) => a.name === "封装");
    expect(pack!.type).toBe("select");
    expect(pack!.options).toContain("0402");
  });

  it("分类不存在返回 404", async () => {
    const { status, body } = await api<ApiErrorBody>("/api/categories/9999/attributes");
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("分类 id 非法返回 400", async () => {
    const { status } = await api<ApiErrorBody>("/api/categories/abc/attributes");
    expect(status).toBe(400);
  });
});

describe("创建物料", () => {
  it("正常创建电容并自动生成编号", async () => {
    const cap = await createCap("贴片陶瓷电容", "100", {
      [String(capIds.get("介质")!)]: "X7R",
    });
    expect(cap.code).toMatch(/^C\d{6}$/);
    expect(cap.name).toBe("贴片陶瓷电容");
    expect(cap.category).toEqual({ id: 2, name: "电容" });
    // 分类的全部参数都会被回写，未填的为空字符串。
    expect(cap.attributes).toHaveLength(5);
    const capacity = cap.attributes.find((a) => a.id === capIds.get("容量"));
    expect(capacity?.value).toBe("100");
    expect(capacity?.unit).toBe("nF");
  });

  it("编号按分类前缀递增", async () => {
    const a = await createCap("电容序列甲", "1");
    const b = await createCap("电容序列乙", "2");
    expect(a.code.startsWith("C")).toBe(true);
    expect(Number(b.code.slice(1))).toBe(Number(a.code.slice(1)) + 1);
  });

  it("无参数分类使用 M 前缀", async () => {
    const { status, body } = await api<Material>(
      "/api/materials",
      json("POST", { name: "其他物料", categoryId: 9, attributes: {} }),
    );
    expect(status).toBe(201);
    expect(body.code.startsWith("M")).toBe(true);
    expect(body.attributes).toEqual([]);
  });

  it("名称为空返回 400", async () => {
    const { status, body } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "  ", categoryId: 2, attributes: capAttributes("1") }),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("缺少分类返回 400", async () => {
    const { status } = await api<ApiErrorBody>("/api/materials", json("POST", { name: "无分类" }));
    expect(status).toBe(400);
  });

  it("分类不存在返回 404", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "分类不存在", categoryId: 9999, attributes: {} }),
    );
    expect(status).toBe(404);
  });

  it("缺少必填参数返回 400", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "缺容量", categoryId: 2, attributes: {} }),
    );
    expect(status).toBe(400);
  });

  it("数字参数非数字返回 400", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "非法数字", categoryId: 2, attributes: capAttributes("abc") }),
    );
    expect(status).toBe(400);
  });

  it("select 参数取值非法返回 400", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", {
        name: "非法封装",
        categoryId: 2,
        attributes: capAttributes("1", { [String(capIds.get("封装")!)]: "不存在的封装" }),
      }),
    );
    expect(status).toBe(400);
  });

  it("伪造参数 id 返回 400", async () => {
    const { status, body } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "伪造参数", categoryId: 2, attributes: { "999999": "x" } }),
    );
    expect(status).toBe(400);
    expect(body.error.message).toContain("参数不存在");
  });

  it("非法 JSON 请求体返回 400", async () => {
    const res = await SELF.fetch(`${BASE}/api/materials`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    expect(res.status).toBe(400);
  });
});

describe("物料详情", () => {
  it("按 id 读取详情", async () => {
    const cap = await createCap("详情测试物料", "47");
    const { status, body } = await api<Material>(`/api/materials/${cap.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(cap.id);
    expect(body.code).toBe(cap.code);
    expect(body.name).toBe("详情测试物料");
    expect(body.createdAt).toBeTruthy();
  });

  it("详情不存在返回 404", async () => {
    const { status } = await api<ApiErrorBody>("/api/materials/999999");
    expect(status).toBe(404);
  });
});

describe("物料列表与分页", () => {
  it("空搜索词返回全部物料并含分页字段", async () => {
    const { status, body } = await api<MaterialListResponse>("/api/materials");
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("分页正确切分", async () => {
    for (let i = 1; i <= 12; i++) {
      const { status } = await api<Material>(
        "/api/materials",
        json("POST", { name: `分页词-${String(i).padStart(2, "0")}`, categoryId: 9, attributes: {} }),
      );
      expect(status).toBe(201);
    }
    const p1 = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("分页词")}&page=1&pageSize=10`,
    );
    expect(p1.body.total).toBe(12);
    expect(p1.body.items).toHaveLength(10);
    const p2 = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("分页词")}&page=2&pageSize=10`,
    );
    expect(p2.body.items).toHaveLength(2);
  });

  it("page / pageSize 非法返回 400", async () => {
    expect((await api<ApiErrorBody>("/api/materials?page=0")).status).toBe(400);
    expect((await api<ApiErrorBody>("/api/materials?pageSize=7")).status).toBe(400);
    expect((await api<ApiErrorBody>("/api/materials?categoryId=abc")).status).toBe(400);
  });
});

describe("更新物料", () => {
  it("改名保留编号", async () => {
    const cap = await createCap("更新前名称", "10");
    const { status, body } = await api<Material>(
      `/api/materials/${cap.id}`,
      json("PUT", { name: "更新后名称", categoryId: 2, attributes: capAttributes("20") }),
    );
    expect(status).toBe(200);
    expect(body.name).toBe("更新后名称");
    expect(body.code).toBe(cap.code);
    expect(body.attributes.find((a) => a.id === capIds.get("容量"))?.value).toBe("20");
  });

  it("更换分类后参数随之替换", async () => {
    const cap = await createCap("切换分类前", "10");
    const { status, body } = await api<Material>(
      `/api/materials/${cap.id}`,
      json("PUT", { name: "切换分类后", categoryId: 7, attributes: { [String(icIds.get("型号描述")!)]: "LM358" } }),
    );
    expect(status).toBe(200);
    expect(body.category).toEqual({ id: 7, name: "IC" });
    expect(body.attributes).toHaveLength(2);
    expect(body.attributes.some((a) => a.name === "型号描述")).toBe(true);
    expect(body.attributes.some((a) => a.name === "容量")).toBe(false);
  });

  it("更新不存在物料返回 404", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials/999999",
      json("PUT", { name: "x", categoryId: 2, attributes: {} }),
    );
    expect(status).toBe(404);
  });

  it("更新为空名称返回 400", async () => {
    const cap = await createCap("更新校验", "10");
    const { status } = await api<ApiErrorBody>(
      `/api/materials/${cap.id}`,
      json("PUT", { name: "", categoryId: 2, attributes: capAttributes("10") }),
    );
    expect(status).toBe(400);
  });
});

describe("删除物料（软删除）", () => {
  it("删除后列表隐藏且详情 404", async () => {
    const cap = await createCap("待删除物料", "5");
    const del = await api<{ ok: boolean }>(`/api/materials/${cap.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const got = await api<ApiErrorBody>(`/api/materials/${cap.id}`);
    expect(got.status).toBe(404);

    const list = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("待删除物料")}`,
    );
    expect(list.body.total).toBe(0);
  });

  it("重复删除幂等", async () => {
    const cap = await createCap("重复删除物料", "5");
    expect((await api(`/api/materials/${cap.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await api(`/api/materials/${cap.id}`, { method: "DELETE" })).status).toBe(200);
  });

  it("删除不存在物料返回 404", async () => {
    const { status } = await api<ApiErrorBody>("/api/materials/999999", { method: "DELETE" });
    expect(status).toBe(404);
  });
});

describe("搜索与筛选", () => {
  it("按编号搜索", async () => {
    const cap = await createCap("编号搜索物料", "1");
    const { body } = await api<MaterialListResponse>(`/api/materials?search=${encodeURIComponent(cap.code)}`);
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(cap.id);
  });

  it("按名称搜索", async () => {
    await createCap("独特名称甲乙丙", "1");
    const { body } = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("独特名称甲乙丙")}`,
    );
    expect(body.total).toBe(1);
    expect(body.items[0].name).toBe("独特名称甲乙丙");
  });

  it("按参数值搜索", async () => {
    await createCap("参数值搜索物料", "987654");
    const { body } = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("987654")}`,
    );
    expect(body.total).toBe(1);
  });

  it("按「值+单位」组合搜索（如 100nF）", async () => {
    const cap = await createCap("组合搜索物料", "100");
    const { body } = await api<MaterialListResponse>(`/api/materials?search=${encodeURIComponent("100nF")}`);
    expect(body.items.some((i) => i.id === cap.id)).toBe(true);
  });

  it("按参数名搜索（容量）", async () => {
    await createCap("参数名搜索物料", "1");
    const { body } = await api<MaterialListResponse>(`/api/materials?search=${encodeURIComponent("容量")}`);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.every((i) => i.category.id === 2)).toBe(true);
  });

  it("按分类筛选", async () => {
    const { body } = await api<MaterialListResponse>("/api/materials?categoryId=2");
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.every((i) => i.category.id === 2)).toBe(true);
  });

  it("搜索与分类组合", async () => {
    const cap = await createCap("组合筛选物料", "1");
    const hit = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("组合筛选物料")}&categoryId=2`,
    );
    expect(hit.body.total).toBe(1);
    expect(hit.body.items[0].id).toBe(cap.id);
    const miss = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("组合筛选物料")}&categoryId=3`,
    );
    expect(miss.body.total).toBe(0);
  });

  it("下划线按字面匹配而非通配符", async () => {
    await api<Material>("/api/materials", json("POST", { name: "含下划线_的物料", categoryId: 9, attributes: {} }));
    const { body } = await api<MaterialListResponse>(`/api/materials?search=${encodeURIComponent("_")}`);
    // 若 _ 被当作通配符，会匹配几乎所有物料；此处仅应命中含字面下划线的 1 条。
    expect(body.total).toBe(1);
    expect(body.items[0].name).toBe("含下划线_的物料");
  });

  it("百分号按字面匹配", async () => {
    await api<Material>("/api/materials", json("POST", { name: "含百分号%的物料", categoryId: 9, attributes: {} }));
    const { body } = await api<MaterialListResponse>(
      `/api/materials?search=${encodeURIComponent("含百分号%的物料")}`,
    );
    expect(body.total).toBe(1);
    expect(body.items[0].name).toBe("含百分号%的物料");
  });
});
