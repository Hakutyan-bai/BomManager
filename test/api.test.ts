import { beforeAll, describe, expect, it } from "vitest";
import { SELF, applyD1Migrations, env } from "cloudflare:test";
import initialSql from "../migrations/0001_initial.sql?raw";
import seedSql from "../migrations/0002_seed_categories.sql?raw";
import unitOptionsSql from "../migrations/0003_unit_options.sql?raw";
import quantitySql from "../migrations/0004_material_quantity.sql?raw";
import ledSql from "../migrations/0005_seed_led.sql?raw";
import type {
  ApiErrorBody,
  BomMatchResponse,
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
let resIds: Map<string, number>;
let icIds: Map<string, number>;
let ledIds: Map<string, number>;

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
    { name: "0003_unit_options", queries: splitSqlStatements(unitOptionsSql) },
    { name: "0004_material_quantity", queries: splitSqlStatements(quantitySql) },
    { name: "0005_seed_led", queries: splitSqlStatements(ledSql) },
  ]);
  capIds = await fetchAttrIds(2); // 电容
  resIds = await fetchAttrIds(1); // 电阻
  icIds = await fetchAttrIds(7); // IC
  ledIds = await fetchAttrIds(10); // 贴片LED
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

  it("列出 10 个分类", async () => {
    const { status, body } = await api<Category[]>("/api/categories");
    expect(status).toBe(200);
    expect(body).toHaveLength(10);
    expect(body.map((c) => c.name)).toContain("电阻");
    expect(body.map((c) => c.name)).toContain("电容");
    expect(body.map((c) => c.name)).toContain("贴片LED");
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
    expect(cap!.unitOptions).toEqual(["pF", "nF", "uF"]);
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
    expect(cap.quantity).toBe(0);
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

describe("可选单位", () => {
  it("电阻「阻值」与电容「容量」暴露可选单位", async () => {
    const res = await api<CategoryAttribute[]>("/api/categories/1/attributes");
    expect(res.status).toBe(200);
    const resi = res.body.find((a) => a.name === "阻值");
    expect(resi?.unitOptions).toEqual(["Ω", "kΩ", "MΩ"]);

    const cap = await api<CategoryAttribute[]>("/api/categories/2/attributes");
    const capacity = cap.body.find((a) => a.name === "容量");
    expect(capacity?.unitOptions).toEqual(["pF", "nF", "uF"]);
  });

  it("创建时选择单位会被保存并返回", async () => {
    const { status, body } = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "带单位电阻",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "4.7" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
      }),
    );
    expect(status).toBe(201);
    const resi = body.attributes.find((a) => a.id === resIds.get("阻值"));
    expect(resi?.value).toBe("4.7");
    expect(resi?.unit).toBe("kΩ");
  });

  it("未选单位时沿用默认单位", async () => {
    const cap = await createCap("默认单位电容", "100");
    const capacity = cap.attributes.find((a) => a.id === capIds.get("容量"));
    expect(capacity?.unit).toBe("nF");
  });

  it("单位非法返回 400", async () => {
    const { status, body } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", {
        name: "非法单位",
        categoryId: 2,
        attributes: capAttributes("1"),
        attributeUnits: { [String(capIds.get("容量")!)]: "V" },
      }),
    );
    expect(status).toBe(400);
    expect(body.error.message).toContain("单位无效");
  });

  it("伪造单位属性 id 返回 400", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", {
        name: "伪造单位",
        categoryId: 2,
        attributes: capAttributes("1"),
        attributeUnits: { "999999": "kΩ" },
      }),
    );
    expect(status).toBe(400);
  });

  it("按「值+所选单位」组合搜索（如 4.7kΩ）", async () => {
    const { status, body: created } = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "组合单位搜索",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "4.7" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
      }),
    );
    expect(status).toBe(201);
    const { body } = await api<MaterialListResponse>(`/api/materials?search=${encodeURIComponent("4.7kΩ")}`);
    expect(body.items.some((i) => i.id === created.id)).toBe(true);
  });
});

describe("剩余数量", () => {
  it("默认剩余数量为 0", async () => {
    const cap = await createCap("默认库存物料", "10");
    expect(cap.quantity).toBe(0);
  });

  it("创建时可设置剩余数量", async () => {
    const { status, body } = await api<Material>(
      "/api/materials",
      json("POST", { name: "带库存物料", categoryId: 2, attributes: capAttributes("10"), quantity: 1000 }),
    );
    expect(status).toBe(201);
    expect(body.quantity).toBe(1000);
  });

  it("更新时可修改剩余数量", async () => {
    const cap = await createCap("更新库存前", "10");
    const { status, body } = await api<Material>(
      `/api/materials/${cap.id}`,
      json("PUT", { name: "更新库存前", categoryId: 2, attributes: capAttributes("10"), quantity: 50 }),
    );
    expect(status).toBe(200);
    expect(body.quantity).toBe(50);
  });

  it("剩余数量为负数返回 400", async () => {
    const { status, body } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "负数库存", categoryId: 2, attributes: capAttributes("1"), quantity: -1 }),
    );
    expect(status).toBe(400);
    expect(body.error.message).toContain("剩余数量");
  });

  it("剩余数量非整数返回 400", async () => {
    const { status } = await api<ApiErrorBody>(
      "/api/materials",
      json("POST", { name: "小数库存", categoryId: 2, attributes: capAttributes("1"), quantity: 1.5 }),
    );
    expect(status).toBe(400);
  });
});

describe("贴片LED", () => {
  it("读取贴片LED分类的参数定义", async () => {
    const { status, body } = await api<CategoryAttribute[]>("/api/categories/10/attributes");
    expect(status).toBe(200);
    const color = body.find((a) => a.name === "颜色");
    expect(color?.type).toBe("select");
    expect(color?.required).toBe(true);
    expect(color?.options).toContain("红");
    const vf = body.find((a) => a.name === "正向电压");
    expect(vf?.type).toBe("number");
    expect(vf?.unit).toBe("V");
  });

  it("创建贴片LED自动生成 LED 前缀编号", async () => {
    const { status, body } = await api<Material>(
      "/api/materials",
      json("POST", { name: "红色贴片LED", categoryId: 10, attributes: { [String(ledIds.get("颜色")!)]: "红" } }),
    );
    expect(status).toBe(201);
    expect(body.code.startsWith("LED")).toBe(true);
    expect(body.category).toEqual({ id: 10, name: "贴片LED" });
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

describe("BOM 匹配", () => {
  function match(items: unknown) {
    return api<BomMatchResponse>("/api/bom/match", json("POST", { items }));
  }

  it("匹配电阻：值+单位 + 封装，三分法正确", async () => {
    const r47 = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试47欧",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "47", [String(resIds.get("封装")!)]: "0603" },
        quantity: 100,
      }),
    );
    const r10k = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试10k",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "10", [String(resIds.get("封装")!)]: "0603" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 0,
      }),
    );
    expect(r47.status).toBe(201);
    expect(r10k.status).toBe(201);

    const { status, body } = await match([
      { model: "47Ω 电阻", designator: "R1", package: "R0603", quantity: 2 },
      { model: "10K 电阻", designator: "R2", package: "R0603", quantity: 5 },
    ]);
    expect(status).toBe(200);
    expect(body.notFound).toHaveLength(0);

    const have = body.have.find((m) => m.bom.model === "47Ω 电阻");
    expect(have).toBeDefined();
    expect(have!.material.name).toBe("BOM测试47欧");
    expect(have!.material.stock).toBe(100);
    expect(have!.shortfall).toBe(0);

    const oos = body.outOfStock.find((m) => m.bom.model === "10K 电阻");
    expect(oos).toBeDefined();
    expect(oos!.material.name).toBe("BOM测试10k");
    expect(oos!.shortfall).toBe(5);
  });

  it("匹配电容：EE 值单位 + 额定电压/容差 + 封装", async () => {
    const cap = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试100nF",
        categoryId: 2,
        attributes: {
          [String(capIds.get("容量")!)]: "100",
          [String(capIds.get("额定电压")!)]: "25",
          [String(capIds.get("容差")!)]: "10",
          [String(capIds.get("封装")!)]: "0603",
        },
        quantity: 50,
      }),
    );
    expect(cap.status).toBe(201);

    const { status, body } = await match([
      { model: "100nF 25V 10% 电容", designator: "C1", package: "CAP 0603", quantity: 3 },
    ]);
    expect(status).toBe(200);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("BOM测试100nF");
    expect(body.have[0].material.params).toBe("100nF · 25V · 10% · 0603");
    expect(body.have[0].shortfall).toBe(0);
  });

  it("额定电压可高不可低：不足拒绝，高耐压可替代", async () => {
    // 6.3V 的 47uF，与 100V 的 10uF。额定电压是下限：BOM 要 50V 时 6.3V 必须拒绝，
    // 但 BOM 只要 6.3V 时 100V 的物料可满足（高额定值可替代低要求）。
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试47uF-6.3V",
        categoryId: 2,
        attributes: {
          [String(capIds.get("容量")!)]: "47",
          [String(capIds.get("额定电压")!)]: "6.3",
          [String(capIds.get("封装")!)]: "0603",
        },
        attributeUnits: { [String(capIds.get("容量")!)]: "uF" },
        quantity: 5,
      }),
    );
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试10uF-100V",
        categoryId: 2,
        attributes: {
          [String(capIds.get("容量")!)]: "10",
          [String(capIds.get("额定电压")!)]: "100",
        },
        attributeUnits: { [String(capIds.get("容量")!)]: "uF" },
        quantity: 3,
      }),
    );

    // BOM 要 47uF 50V：6.3V 不足，必须未收录（不会被误配）。
    const need50 = await match([{ model: "47uF 50V", designator: "C1", package: "C0603", quantity: 1 }]);
    expect(need50.body.have).toHaveLength(0);
    expect(need50.body.outOfStock).toHaveLength(0);
    expect(need50.body.notFound.map((n) => n.model)).toEqual(["47uF 50V"]);

    // BOM 要 10uF 6.3V：100V 的物料可满足，但必须标记为可替代。
    const need63 = await match([{ model: "10uF 6.3V", designator: "C2", quantity: 1 }]);
    expect(need63.body.have).toHaveLength(0);
    expect(need63.body.substitute).toHaveLength(1);
    expect(need63.body.substitute[0].material.name).toBe("BOM测试10uF-100V");
    expect(need63.body.substitute[0].substituteReasons).toContain("耐压高于需求");
  });

  it("耐压精确值优先于更高耐压，额定值缺失不能匹配", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试15uF-50V",
        categoryId: 2,
        attributes: {
          [String(capIds.get("容量")!)]: "15",
          [String(capIds.get("额定电压")!)]: "50",
          [String(capIds.get("封装")!)]: "0603",
        },
        attributeUnits: { [String(capIds.get("容量")!)]: "uF" },
        quantity: 8,
      }),
    );
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试15uF-25V",
        categoryId: 2,
        attributes: {
          [String(capIds.get("容量")!)]: "15",
          [String(capIds.get("额定电压")!)]: "25",
          [String(capIds.get("封装")!)]: "0603",
        },
        attributeUnits: { [String(capIds.get("容量")!)]: "uF" },
        quantity: 3,
      }),
    );
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试18uF-无耐压",
        categoryId: 2,
        attributes: {
          [String(capIds.get("容量")!)]: "18",
          [String(capIds.get("封装")!)]: "0603",
        },
        attributeUnits: { [String(capIds.get("容量")!)]: "uF" },
        quantity: 6,
      }),
    );

    const exact = await match([{ model: "15uF 25V", designator: "C3", package: "0603", quantity: 1 }]);
    expect(exact.body.have).toHaveLength(1);
    expect(exact.body.have[0].material.name).toBe("BOM测试15uF-25V");
    expect(exact.body.substitute).toHaveLength(0);

    const unknown = await match([{ model: "18uF 25V", designator: "C4", package: "0603", quantity: 1 }]);
    expect(unknown.body.have).toHaveLength(0);
    expect(unknown.body.substitute).toHaveLength(0);
    expect(unknown.body.notFound).toHaveLength(1);
  });

  it("容差、功率和电流不同进入可替代，不直接判为精确", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试123k-10%-0.125W",
        categoryId: 1,
        attributes: {
          [String(resIds.get("阻值")!)]: "123",
          [String(resIds.get("精度")!)]: "10",
          [String(resIds.get("功率")!)]: "0.125",
          [String(resIds.get("封装")!)]: "0603",
        },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 10,
      }),
    );
    const inductorIds = await fetchAttrIds(3);
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试27uH-1A",
        categoryId: 3,
        attributes: {
          [String(inductorIds.get("电感量")!)]: "27",
          [String(inductorIds.get("额定电流")!)]: "1",
          [String(inductorIds.get("封装")!)]: "0603",
        },
        quantity: 10,
      }),
    );

    const resistor = await match([
      { model: "123kΩ 1% 0.25W 电阻", designator: "R20", package: "0603", quantity: 1 },
    ]);
    expect(resistor.body.have).toHaveLength(0);
    expect(resistor.body.substitute).toHaveLength(1);
    expect(resistor.body.substitute[0].substituteReasons).toEqual(
      expect.arrayContaining(["容差/精度不同", "功率不同"]),
    );

    const inductor = await match([{ model: "27uH 2A 电感", designator: "L20", package: "0603", quantity: 1 }]);
    expect(inductor.body.have).toHaveLength(0);
    expect(inductor.body.substitute).toHaveLength(1);
    expect(inductor.body.substitute[0].substituteReasons).toContain("电流不同");
  });

  it("名称精确匹配：零件号（二极管）", async () => {
    const dioIds = await fetchAttrIds(4);
    const d = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "B5819W",
        categoryId: 4,
        attributes: { [String(dioIds.get("反向耐压")!)]: "40", [String(dioIds.get("封装")!)]: "SOD-123" },
        quantity: 5,
      }),
    );
    expect(d.status).toBe(201);

    const { status, body } = await match([
      { model: "B5819W", designator: "D1", package: "SOD-123", quantity: 10 },
    ]);
    expect(status).toBe(200);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("B5819W");
    expect(body.have[0].shortfall).toBe(5);
  });

  it("单位归一化：uF 与 Ω 后缀", async () => {
    const cap22 = await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试22uF",
        categoryId: 2,
        attributes: { [String(capIds.get("容量")!)]: "22", [String(capIds.get("封装")!)]: "0805" },
        attributeUnits: { [String(capIds.get("容量")!)]: "uF" },
        quantity: 0,
      }),
    );
    expect(cap22.status).toBe(201);

    const { status, body } = await match([{ model: "22uF", designator: "C2", package: "C0805", quantity: 1 }]);
    expect(status).toBe(200);
    expect(body.outOfStock).toHaveLength(1);
    expect(body.outOfStock[0].material.name).toBe("BOM测试22uF");
  });

  it("EE 电阻记法：20R / 1M", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试20欧",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "20" },
        quantity: 0,
      }),
    );
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试1兆",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "1" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "MΩ" },
        quantity: 3,
      }),
    );

    const { body } = await match([
      { model: "20R", designator: "R1", quantity: 1 },
      { model: "1M", designator: "R2", quantity: 1 },
    ]);
    expect(body.outOfStock.map((m) => m.material.name)).toContain("BOM测试20欧");
    expect(body.have.map((m) => m.material.name)).toContain("BOM测试1兆");
  });

  it("中文欧姆识别：4.7k欧 匹配阻值参数", async () => {
    // BOM 型号用中文「欧」表示欧姆，应匹配到库存的阻值参数（4.7kΩ）。
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试4.7k欧",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "4.7", [String(resIds.get("封装")!)]: "0603" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 8,
      }),
    );

    const { body } = await match([{ model: "4.7k欧", designator: "R1", package: "0603", quantity: 1 }]);
    expect(body.notFound).toHaveLength(0);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("BOM测试4.7k欧");
  });

  it("单位换算：0.22uF 与 220nF 等价", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试220nF换算",
        categoryId: 2,
        attributes: { [String(capIds.get("容量")!)]: "220" },
        attributeUnits: { [String(capIds.get("容量")!)]: "nF" },
        quantity: 7,
      }),
    );

    const { body } = await match([{ model: "0.22uF", designator: "C1", quantity: 1 }]);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("BOM测试220nF换算");
  });

  it("欧洲记法：3K3 = 3.3kΩ", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试3k3",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "3.3" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 2,
      }),
    );

    const { body } = await match([{ model: "3K3", designator: "R1", quantity: 1 }]);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("BOM测试3k3");
  });

  it("小写单位：470nf = 470nF", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试小写nf",
        categoryId: 2,
        attributes: { [String(capIds.get("容量")!)]: "470" },
        attributeUnits: { [String(capIds.get("容量")!)]: "nF" },
        quantity: 4,
      }),
    );

    const { body } = await match([{ model: "470nf", designator: "C1", quantity: 1 }]);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("BOM测试小写nf");
  });

  it("封装精准区分：同值不同封装选对物料", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试33k-0603",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "33", [String(resIds.get("封装")!)]: "0603" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 0,
      }),
    );
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试33k-0805",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "33", [String(resIds.get("封装")!)]: "0805" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 10,
      }),
    );

    const { body } = await match([{ model: "33K", designator: "R1", package: "0805", quantity: 1 }]);
    expect(body.notFound).toHaveLength(0);
    expect(body.have).toHaveLength(1);
    expect(body.have[0].material.name).toBe("BOM测试33k-0805");
  });

  it("封装硬约束：1206 不精确配到 0603/0805，0805 作为替代", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试5.1k-0603",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "5.1", [String(resIds.get("封装")!)]: "0603" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 9,
      }),
    );
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试5.1k-0805",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "5.1", [String(resIds.get("封装")!)]: "0805" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 6,
      }),
    );

    // BOM 要 1206：库里只有 0603/0805，都不精确命中；0805 差一档作为替代，0603 差两档不替代。
    const need1206 = await match([{ model: "5.1kΩ 电阻", designator: "R1", package: "R1206", quantity: 1 }]);
    expect(need1206.body.have).toHaveLength(0);
    expect(need1206.body.outOfStock).toHaveLength(0);
    expect(need1206.body.substitute.map((m) => m.material.name)).toEqual(["BOM测试5.1k-0805"]);
    expect(need1206.body.notFound).toHaveLength(0);

    // BOM 要 0805：应精确命中 0805 的物料（0603 被拒绝）。
    const need0805 = await match([{ model: "5.1kΩ 电阻", designator: "R2", package: "R0805", quantity: 1 }]);
    expect(need0805.body.have).toHaveLength(1);
    expect(need0805.body.have[0].material.name).toBe("BOM测试5.1k-0805");
  });

  it("封装替代：无 0805 用 0603 替代，0402/1206 不替代", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "BOM测试6.8k-0603",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "6.8", [String(resIds.get("封装")!)]: "0603" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 4,
      }),
    );

    // BOM 要 0805：库里只有 0603（差一档）→ 进入「可替代」。
    const need0805 = await match([{ model: "6.8kΩ 电阻", designator: "R1", package: "R0805", quantity: 2 }]);
    expect(need0805.body.have).toHaveLength(0);
    expect(need0805.body.substitute).toHaveLength(1);
    expect(need0805.body.substitute[0].material.name).toBe("BOM测试6.8k-0603");
    expect(need0805.body.notFound).toHaveLength(0);

    // BOM 要 1206：0603 小两档，不替代 → 未收录。
    const need1206 = await match([{ model: "6.8kΩ 电阻", designator: "R2", package: "R1206", quantity: 2 }]);
    expect(need1206.body.substitute).toHaveLength(0);
    expect(need1206.body.notFound.map((n) => n.model)).toEqual(["6.8kΩ 电阻"]);

    // BOM 要 0603：精确命中，不属于替代。
    const need0603 = await match([{ model: "6.8kΩ 电阻", designator: "R3", package: "R0603", quantity: 2 }]);
    expect(need0603.body.have).toHaveLength(1);
    expect(need0603.body.have[0].material.name).toBe("BOM测试6.8k-0603");
    expect(need0603.body.substitute).toHaveLength(0);
  });

  it("名称完全相同也不能绕过封装规则", async () => {
    await api<Material>(
      "/api/materials",
      json("POST", {
        name: "82KR",
        categoryId: 1,
        attributes: { [String(resIds.get("阻值")!)]: "82", [String(resIds.get("封装")!)]: "0603" },
        attributeUnits: { [String(resIds.get("阻值")!)]: "kΩ" },
        quantity: 5,
      }),
    );

    const oneStep = await match([{ model: "82KR", designator: "R30", package: "0805", quantity: 1 }]);
    expect(oneStep.body.have).toHaveLength(0);
    expect(oneStep.body.substitute).toHaveLength(1);
    expect(oneStep.body.substitute[0].material.name).toBe("82KR");
    expect(oneStep.body.substitute[0].substituteReasons).toContain("封装小一档");

    const twoSteps = await match([{ model: "82KR", designator: "R31", package: "1206", quantity: 1 }]);
    expect(twoSteps.body.have).toHaveLength(0);
    expect(twoSteps.body.substitute).toHaveLength(0);
    expect(twoSteps.body.notFound).toHaveLength(1);
  });

  it("不会把值/位号不匹配的型号误配到其它分类", async () => {
    // 库里有 0603 电容（本测试文件前面创建），但没有 68Ω 电阻 / LED / AO3416。
    // 这些行只凭封装（0603 / 0805 / SOT-23）不应误配到电容或三极管。
    const { body } = await match([
      { model: "68Ω 电阻", designator: "R1", package: "R0603", quantity: 4 },
      { model: "LED_0805 发光二极管", designator: "LED1", package: "LED_0805", quantity: 5 },
      { model: "AO3416", designator: "Q1", package: "SOT-23", quantity: 4 },
    ]);
    expect(body.have).toHaveLength(0);
    expect(body.outOfStock).toHaveLength(0);
    expect(body.notFound.map((n) => n.model)).toEqual(["68Ω 电阻", "LED_0805 发光二极管", "AO3416"]);
  });

  it("未收录：无法匹配的型号", async () => {
    const { status, body } = await match([{ model: "完全不存在的物料XYZ123", designator: "U9", quantity: 1 }]);
    expect(status).toBe(200);
    expect(body.have).toHaveLength(0);
    expect(body.outOfStock).toHaveLength(0);
    expect(body.notFound).toHaveLength(1);
    expect(body.notFound[0].model).toBe("完全不存在的物料XYZ123");
  });

  it("参数校验：items 非数组 / 型号为空 / 数量为负", async () => {
    expect((await match("x")).status).toBe(400);
    expect((await match([{ model: "", quantity: 1 }])).status).toBe(400);
    expect((await match([{ model: "x", quantity: -1 }])).status).toBe(400);
    expect((await api<ApiErrorBody>("/api/bom/match", json("POST", {}))).status).toBe(400);
  });
});
