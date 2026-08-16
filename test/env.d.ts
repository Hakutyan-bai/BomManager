/// <reference types="@cloudflare/vitest-pool-workers/types" />

// 将 D1 绑定注入 Cloudflare.Env，使 cloudflare:test 的 env.DB 拥有类型。
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}

// Vite 的 ?raw 导入：在测试中直接以字符串读取 SQL 迁移文件。
declare module "*?raw" {
  const content: string;
  export default content;
}
