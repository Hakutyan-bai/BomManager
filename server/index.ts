import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "./types";
import { AppError, errorBody, type HttpStatus } from "./errors";
import { categoriesRoutes } from "./routes/categories";
import { materialsRoutes } from "./routes/materials";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/categories", categoriesRoutes);
app.route("/api/materials", materialsRoutes);

app.notFound((c) => c.json(errorBody("NOT_FOUND", "接口不存在"), 404));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message), err.status);
  }
  if (err instanceof HTTPException) {
    return c.json(errorBody("BAD_REQUEST", "请求格式错误"), err.status as HttpStatus);
  }
  // c.req.json() 在请求体不是合法 JSON 时抛出 SyntaxError。
  if (err instanceof SyntaxError) {
    return c.json(errorBody("BAD_REQUEST", "请求格式错误"), 400);
  }
  console.error("[material-center] Unhandled error:", err);
  return c.json(errorBody("INTERNAL_ERROR", "服务器内部错误"), 500);
});

export default app;
