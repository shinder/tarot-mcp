// 整合測試：直接呼叫 Worker 的 fetch，用 JSON-RPC 走一遍 MCP 往返。
// Request / Response 都是 Web 標準 API，在 Node 上即可跑。

import { describe, expect, it } from "vitest";
import worker from "./index";

const ORIGIN = "http://localhost:8787";
let nextId = 1;

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext;

/**
 * Worker 的 fetch 要的是帶 cf 屬性的 Request 型別，測試用一般 Request 即可。
 * Node 的 Request 不會自動帶 Host 標頭（workerd 會），而 handler 會驗證 Host，這裡補上。
 */
function call(path: string, init?: RequestInit) {
  const req = new Request(`${ORIGIN}${path}`, init);
  req.headers.set("host", new URL(ORIGIN).host);
  return worker.fetch(req as never, {} as Env, ctx);
}

async function rpc(method: string, params: Record<string, unknown> = {}) {
  const id = nextId++;
  const res = await call("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const body = await res.text();
  expect(res.ok, `${method}: HTTP ${res.status} ${body.slice(0, 200)}`).toBe(true);

  const type = res.headers.get("content-type") ?? "";
  let msg: { id?: number; result?: any; error?: unknown };
  if (type.includes("text/event-stream")) {
    const data = body
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5).trim()));
    msg = data.find((m) => m.id === id) ?? data.at(-1);
  } else {
    msg = JSON.parse(body);
  }
  expect(msg.error, `${method}: ${JSON.stringify(msg.error)}`).toBeUndefined();
  return msg.result;
}

describe("Worker 路由", () => {
  it("/health 與 / 可用，其他 404", async () => {
    const health = await call("/health");
    expect(health.status).toBe(200);
    expect(((await health.json()) as { cards: number }).cards).toBe(78);

    const root = await call("/");
    expect(root.status).toBe(200);

    const nope = await call("/nope");
    expect(nope.status).toBe(404);
  });
});

describe("MCP 往返", () => {
  it("initialize 回傳 server 資訊與 instructions", async () => {
    const r = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0" },
    });
    expect(r.serverInfo.name).toBe("tarot-mcp");
    expect(r.instructions).toContain("Interpretation is the model's job");
  });

  it("列出四個工具、兩個資源、兩個模板、三個 prompt", async () => {
    const tools = await rpc("tools/list");
    expect(tools.tools.map((t: any) => t.name).sort()).toEqual(
      ["draw_cards", "get_card", "get_spread", "list_cards"],
    );
    const res = await rpc("resources/list");
    expect(res.resources.map((r: any) => r.uri).sort()).toEqual(["tarot://cards", "tarot://spreads"]);
    const tpl = await rpc("resources/templates/list");
    expect(tpl.resourceTemplates.length).toBe(2);
    const prompts = await rpc("prompts/list");
    expect(prompts.prompts.map((p: any) => p.name).sort()).toEqual(
      ["daily_card", "learn_card", "three_card_reading"],
    );
  });

  it("draw_cards：同 seed 可重現，位置意義來自牌陣", async () => {
    const a = await rpc("tools/call", { name: "draw_cards", arguments: { spread: "time", seed: "vitest" } });
    const b = await rpc("tools/call", { name: "draw_cards", arguments: { spread: "time", seed: "vitest" } });
    expect(a.isError).toBeFalsy();
    expect(a.structuredContent.cards.length).toBe(3);
    expect(a.structuredContent.cards[0].position.name).toBe("過去");
    expect(a.structuredContent).toEqual(b.structuredContent);
    expect(a.content[0].text).toContain("seed: vitest");
  });

  it("draw_cards：沒給 spread 也沒給 count 是錯誤，不是例外", async () => {
    const r = await rpc("tools/call", { name: "draw_cards", arguments: {} });
    expect(r.isError).toBe(true);
  });

  it("get_card：英文查詢、brief 模式", async () => {
    const r = await rpc("tools/call", {
      name: "get_card",
      arguments: { card: "Four of Cups", lang: "en", detail: "brief" },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.slug).toBe("cups-04");
    expect(r.structuredContent.name).toBe("Four of Cups");
    expect(r.structuredContent.description).toBeUndefined();
  });

  it("get_card：找不到時 isError 並附候選", async () => {
    const r = await rpc("tools/call", { name: "get_card", arguments: { card: "cups" } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("cups-01");
  });

  it("get_spread 與 resources/read 回同一份牌陣資料", async () => {
    const tool = await rpc("tools/call", { name: "get_spread", arguments: { spread: "celtic", lang: "en" } });
    expect(tool.structuredContent.positions.length).toBe(10);
    expect(tool.structuredContent.readingOrder.length).toBeGreaterThan(0);

    const res = await rpc("resources/read", { uri: "tarot://spreads/celtic" });
    const parsed = JSON.parse(res.contents[0].text);
    expect(parsed.en).toEqual(tool.structuredContent);
  });

  it("resources/read 單張牌", async () => {
    const res = await rpc("resources/read", { uri: "tarot://cards/00-fool" });
    const parsed = JSON.parse(res.contents[0].text);
    expect(parsed.zh.name).toBe("愚者");
    expect(parsed.en.name).toBe("The Fool");
  });

  it("prompts/get 帶入參數", async () => {
    const r = await rpc("prompts/get", {
      name: "three_card_reading",
      arguments: { question: "換工作", spread: "action", lang: "zh" },
    });
    const text = r.messages[0].content.text;
    expect(text).toContain("換工作");
    expect(text).toContain("spread: action");
  });
});
