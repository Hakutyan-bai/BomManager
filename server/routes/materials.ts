import { Hono } from "hono";
import type { Env } from "../types";
import { badRequest, notFound } from "../errors";
import { parseId } from "../utils";
import * as materialService from "../services/materials";
import type { MaterialPayload } from "../../shared/types";

const PAGE_SIZES = [10, 20, 50, 100];

export const materialsRoutes = new Hono<{ Bindings: Env }>();

function parsePage(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw badRequest("page 参数无效");
  return n;
}

function parsePageSize(raw: string | undefined): number {
  if (raw === undefined) return 20;
  const n = Number(raw);
  if (!PAGE_SIZES.includes(n)) throw badRequest("pageSize 参数无效");
  return n;
}

function parseMaterialPayload(data: unknown): MaterialPayload {
  if (typeof data !== "object" || data === null) {
    throw badRequest("请求体格式错误");
  }
  const d = data as Record<string, unknown>;

  const name = typeof d.name === "string" ? d.name : "";
  const categoryId = Number(d.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw badRequest("请选择物料分类");
  }

  const attributes: Record<string, string> = {};
  if (d.attributes !== undefined) {
    if (typeof d.attributes !== "object" || d.attributes === null || Array.isArray(d.attributes)) {
      throw badRequest("参数格式错误");
    }
    for (const [key, value] of Object.entries(d.attributes as Record<string, unknown>)) {
      attributes[key] = value === null || value === undefined ? "" : String(value);
    }
  }
  return { name, categoryId, attributes };
}

// GET /api/materials?search=&categoryId=&page=&pageSize=
materialsRoutes.get("/", async (c) => {
  const search = c.req.query("search")?.trim() || undefined;
  const categoryIdRaw = c.req.query("categoryId");
  const categoryId = categoryIdRaw ? parseId(categoryIdRaw) : undefined;
  const page = parsePage(c.req.query("page"));
  const pageSize = parsePageSize(c.req.query("pageSize"));
  return c.json(await materialService.listMaterials(c.env.DB, { search, categoryId, page, pageSize }));
});

// GET /api/materials/:id
materialsRoutes.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const material = await materialService.getMaterial(c.env.DB, id);
  if (!material) throw notFound("该物料不存在");
  return c.json(material);
});

// POST /api/materials
materialsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const material = await materialService.createMaterial(c.env.DB, parseMaterialPayload(body));
  return c.json(material, 201);
});

// PUT /api/materials/:id
materialsRoutes.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const body = await c.req.json();
  const material = await materialService.updateMaterial(c.env.DB, id, parseMaterialPayload(body));
  return c.json(material);
});

// DELETE /api/materials/:id（软删除）
materialsRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  await materialService.deleteMaterial(c.env.DB, id);
  return c.json({ ok: true });
});
