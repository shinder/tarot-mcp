import { defineConfig } from "vitest/config";

// 單元測試只碰純函式（抽牌、查牌、牌陣資料）與 handler 的 JSON-RPC 往返，
// 都是 Web 標準 API，直接在 Node 跑即可。要在 workerd 內驗證，用 pnpm dev 加 pnpm smoke。
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
