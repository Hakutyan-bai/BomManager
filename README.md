# 物料中心（Material Center）

电子元器件物料主数据管理的轻量 MVP。第一阶段聚焦「物料管理」：物料的增删改查、搜索、分类筛选、按分类动态参数、物料详情。

## 技术栈

- **前端**：React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **后端**：Cloudflare Workers + Hono（同一个 Worker 同时托管静态资源与 API）
- **数据库**：Cloudflare D1（SQLite）
- **全栈整合**：`@cloudflare/vite-plugin`（`vite dev` 时在 Miniflare 中运行 Worker）
- **测试**：Vitest + `@cloudflare/vitest-pool-workers`（在 workerd 运行时中运行集成测试）

## 目录结构

```
server/           Worker 后端（Hono 路由 → 服务层 → 仓库层）
  routes/         路由（参数解析、HTTP 状态码）
  services/       业务逻辑（校验、编号生成、软删除）
  repos/          D1 SQL（参数绑定，无字符串拼接）
shared/types.ts   前后端共享的 API 契约类型
src/              React 前端
migrations/       D1 迁移（建表 + 种子分类）
test/             Vitest 集成测试
```

## 数据模型

四张核心表，分类与参数均存库、不写死：

| 表 | 说明 |
| --- | --- |
| `categories` | 物料分类（含 `code_prefix` 编码前缀） |
| `category_attributes` | 分类参数定义（text / number / select、单位、是否必填、选项） |
| `materials` | 物料（`code` 自动生成、唯一；软删除 `deleted_at`） |
| `material_attributes` | 物料参数值（`UNIQUE(material_id, attribute_id)`） |

内置 9 个分类：电阻 `R`、电容 `C`、电感 `L`、二极管 `D`、三极管 `T`、MOSFET `Q`、IC `U`、连接器 `J`、其他 `M`。

## 快速开始

```bash
npm install

# 本地建库（D1 本地环境 + 应用迁移 + 灌入种子分类）
npm run db:migrate:local

# 启动开发服务器（前端 + API 一体，默认 http://localhost:8787）
npm run dev
```

也可以直接用 `npx wrangler dev` 启动 Worker。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Vite 开发服务器（含 Worker，端口 8787） |
| `npm run build` | 生产构建（`dist/` 下同时产出 client 与 worker） |
| `npm run preview` | 预览生产构建 |
| `npm run deploy` | 构建并部署到 Cloudflare |
| `npm run typecheck` | 类型检查（主代码 + 测试代码） |
| `npm test` | 运行 Vitest 集成测试 |
| `npm run db:migrate:local` | 将迁移应用到本地 D1 |
| `npm run db:migrate:remote` | 将迁移应用到远程 D1 |
| `npm run cf-typegen` | 生成 Worker 类型（`wrangler types`） |

## API

统一错误格式：`{ "error": { "code": "...", "message": "..." } }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/categories/:id/attributes` | 某分类的参数定义 |
| GET | `/api/materials?search=&categoryId=&page=&pageSize=` | 物料列表（搜索/筛选/分页） |
| GET | `/api/materials/:id` | 物料详情 |
| POST | `/api/materials` | 创建物料（`{ name, categoryId, attributes }`） |
| PUT | `/api/materials/:id` | 更新物料 |
| DELETE | `/api/materials/:id` | 软删除（幂等） |

## 部署到 Cloudflare

1. 创建远程 D1 数据库并记下 `database_id`：

   ```bash
   npx wrangler d1 create material-center-db
   ```

2. 在 `wrangler.jsonc` 的 `d1_databases` 中填入 `database_id`（wrangler 4.x 也支持仅凭 `database_name` 自动创建）。

3. 应用远程迁移并部署：

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

## 测试

```bash
npm test
```

集成测试覆盖分类、创建（含各类校验与边界）、详情、列表与分页、更新、软删除、搜索与筛选（编号/名称/参数值/参数名/值+单位/特殊字符 `%` `_`）。每个测试文件运行在独立 workerd 与隔离的 D1 中。
