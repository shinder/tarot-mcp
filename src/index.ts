// Worker 入口。
// /mcp    Streamable HTTP 的 MCP 端點（stateless，每個 request 一個 McpServer）
// /health 健康檢查
// /       純文字說明頁

import { createMcpHandler } from "agents/mcp/server";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server";
import { CARDS } from "./data/cards";
import { SPREADS } from "./data/spreads";

/**
 * 允許的 Host。一旦設定就取代預設值（localhost 與 workers.dev），
 * 所以本機開發用的 localhost 要一起列進來。正式網域在 wrangler.jsonc 的 routes。
 */
const ALLOWED_HOSTNAMES = ["mcp.tarot.shinder.work", "localhost", "127.0.0.1"];

const mcp = createMcpHandler(createServer, {
  route: "/mcp",
  allowedHostnames: ALLOWED_HOSTNAMES,
});

const LANDING = [
  `${SERVER_NAME} ${SERVER_VERSION}`,
  "",
  "Remote MCP server for the Rider-Waite-Smith tarot deck (Streamable HTTP).",
  "",
  "Endpoint: /mcp",
  `Cards: ${CARDS.length}   Spreads: ${Object.keys(SPREADS).join(", ")}`,
  "",
  "Connect from Claude Code:",
  "  claude mcp add --transport http tarot https://mcp.tarot.shinder.work/mcp",
  "",
  "Source data and articles: https://tarot.shinder.work",
  "",
].join("\n");

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return mcp(request, env, ctx);
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true, name: SERVER_NAME, version: SERVER_VERSION, cards: CARDS.length });
    }
    if (url.pathname === "/") {
      return new Response(LANDING, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
