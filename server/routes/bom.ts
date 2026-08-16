import { Hono } from "hono";
import type { Env } from "../types";
import { badRequest } from "../errors";
import * as bomService from "../services/bom";
import type { BomItem } from "../../shared/types";

export const bomRoutes = new Hono<{ Bindings: Env }>();

function parseBomItem(raw: unknown, index: number): BomItem {
  if (typeof raw !== "object" || raw === null) {
    throw badRequest(`第 ${index + 1} 行格式错误`);
  }
  const r = raw as Record<string, unknown>;

  const model = typeof r.model === "string" ? r.model.trim() : "";
  if (!model) throw badRequest(`第 ${index + 1} 行的型号不能为空`);

  const quantity = Number(r.quantity ?? 0);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw badRequest(`第 ${index + 1} 行的数量必须为非负整数`);
  }

  const designator = typeof r.designator === "string" ? r.designator.trim() : "";
  const pkg = typeof r.package === "string" ? r.package.trim() : "";
  const remark = typeof r.remark === "string" ? r.remark.trim() : "";

  return {
    model,
    quantity,
    designator: designator || undefined,
    package: pkg || undefined,
    remark: remark || undefined,
  };
}

// POST /api/bom/match
bomRoutes.post("/match", async (c) => {
  const body = await c.req.json();
  if (typeof body !== "object" || body === null) throw badRequest("请求体格式错误");
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items)) throw badRequest("items 必须为数组");

  const parsed = items.map((it, i) => parseBomItem(it, i));
  return c.json(await bomService.matchBom(c.env.DB, parsed));
});
