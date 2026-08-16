# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 包管理器

本项目使用 **pnpm**，不要用 npm。原生依赖（esbuild、workerd）的构建脚本通过 `pnpm-workspace.yaml` 的 `allowBuilds` 白名单放行。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器（前端 + Worker 一体，默认 http://localhost:8787） |
| `pnpm build` | 生产构建（`dist/` 下产出 client 与 worker） |
| `pnpm typecheck` | 类型检查（主代码 + 测试代码） |
| `pnpm test` | 运行全部 Vitest 集成测试 |
| `pnpm test -- test/api.test.ts` | 运行单个测试文件 |
| `pnpm test -- -t "关键词"` | 按测试名过滤运行 |
| `pnpm db:migrate:local` | 迁移应用到本地 D1 |
| `pnpm db:migrate:remote` | 迁移应用到远程 D1 |
| `pnpm cf-typegen` | 生成 Worker 类型（`wrangler types`） |
| `pnpm deploy` | 构建并部署到 Cloudflare |

## 架构

单 Worker 全栈应用：一个 Cloudflare Worker（Hono）同时托管静态资源与 `/api/*` 接口，数据库为 D1（SQLite）。`@cloudflare/vite-plugin` 让 `pnpm dev` 在 Miniflare 中运行 Worker，`wrangler.jsonc` 配置 `assets.run_worker_first: ["/api/*"]` 与 SPA 回退。

后端三层、严格单向依赖：
- `server/routes/` — Hono 路由：参数解析、HTTP 状态码，不含业务逻辑。
- `server/services/` — 业务逻辑与校验（编号生成、软删除、输入验证）。
- `server/repos/` — D1 SQL，只允许参数绑定，禁止字符串拼接。

类型分两套：`shared/types.ts` 是前后端共享的 API 契约（camelCase），`server/types.ts` 是数据库行类型（snake_case），在 service 层显式映射。

## 数据模型

分类与参数全部存库、不写死：`categories` → `category_attributes`（参数定义：text/number/select、单位、可选单位 `unit_options`、选项）→ `materials`（软删除 `deleted_at`、剩余数量 `quantity`）→ `material_attributes`（参数值 + 覆盖单位 `unit`）。

- 物料编码按分类前缀自动生成（`generateCode`：前缀 + 6 位数字，唯一冲突重试）。
- 迁移在 `migrations/`（编号 SQL，幂等用 `INSERT OR IGNORE`）；新增分类/参数要写新迁移，不要改已应用的迁移。
- 错误统一为 `{ error: { code, message } }`；`server/errors.ts` 提供 `badRequest` / `notFound` / `conflict` / `AppError`。

## 测试

Vitest + `@cloudflare/vitest-pool-workers`：测试在真实 workerd + 隔离 D1 中通过 `SELF.fetch` 走完整 HTTP 链路（路由 → 服务 → 仓库 → D1）。配置在 `vitest.config.mts`（`cloudflareTest` 插件读取 `wrangler.jsonc`）。

注意：D1 的 `exec()` 无法处理以 `--` 开头的注释行，测试里用 `splitSqlStatements`（去注释 + 按 `;` 切分）+ `applyD1Migrations` 手动灌迁移。**新增迁移时要在 `test/api.test.ts` 的 `beforeAll` 里同步注册。**

## 约定

- 遵循「不要猜」：拿不准的技术细节先查官方文档或检查 `node_modules` 里的实际依赖，不要臆测。
- 严格 TypeScript（`strict`、禁止 `any`）；服务端重新校验所有输入，不信任客户端。
- SQL 一律参数绑定；`LIKE` 搜索用 `escapeLike` 转义 `%` / `_` / `\`。
- commit 信息用中文、Conventional Commits 前缀（如 `feat:`）。
