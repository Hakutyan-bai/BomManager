import { Hono } from "hono";
import type { Env } from "../types";
import { parseId } from "../utils";
import * as categoryService from "../services/categories";

export const categoriesRoutes = new Hono<{ Bindings: Env }>();

// GET /api/categories
categoriesRoutes.get("/", async (c) => {
  return c.json(await categoryService.listCategories(c.env.DB));
});

// GET /api/categories/:id/attributes
categoriesRoutes.get("/:id/attributes", async (c) => {
  const id = parseId(c.req.param("id"));
  return c.json(await categoryService.listAttributes(c.env.DB, id));
});
