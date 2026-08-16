import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// 使用官方全栈测试集成：在 workerd 运行时中运行测试，并通过 wrangler.jsonc
// 读取 Worker 入口与 D1 绑定，使测试与生产环境行为一致。
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
});
