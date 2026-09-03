// 冒煙測試：對跑起來的 server 走一遍 MCP 的 JSON-RPC 往返。
// 不依賴 SDK 用戶端，方便看清楚線路上實際傳了什麼。
//
//   pnpm dev            # 另一個終端機
//   pnpm smoke          # 預設打 http://localhost:8787/mcp
//   MCP_URL=https://mcp.tarot.shinder.work/mcp pnpm smoke

const url = process.env.MCP_URL ?? "http://localhost:8787/mcp";
let nextId = 1;

/** 送一個 JSON-RPC request；回應可能是 JSON 也可能是 SSE，兩種都處理 */
async function rpc(method, params = {}) {
  const id = nextId++;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const type = res.headers.get("content-type") ?? "";
  const body = await res.text();
  if (!res.ok) throw new Error(`${method} -> HTTP ${res.status}: ${body.slice(0, 300)}`);

  let msg;
  if (type.includes("text/event-stream")) {
    const data = body
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5).trim()));
    msg = data.find((m) => m.id === id) ?? data.at(-1);
  } else {
    msg = JSON.parse(body);
  }
  if (msg.error) throw new Error(`${method} -> ${JSON.stringify(msg.error)}`);
  return msg.result;
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0.0.0" },
});
section("initialize");
console.log(init.serverInfo, "protocol", init.protocolVersion);

section("tools/list");
const tools = await rpc("tools/list");
for (const t of tools.tools) console.log(`- ${t.name}`);

section("resources/list + templates");
const resources = await rpc("resources/list");
for (const r of resources.resources) console.log(`- ${r.uri}`);
const templates = await rpc("resources/templates/list");
for (const r of templates.resourceTemplates) console.log(`- ${r.uriTemplate}`);

section("prompts/list");
const prompts = await rpc("prompts/list");
for (const p of prompts.prompts) console.log(`- ${p.name}`);

section("tools/call draw_cards (spread: time, seed: smoke)");
const draw = await rpc("tools/call", {
  name: "draw_cards",
  arguments: { spread: "time", seed: "smoke" },
});
console.log(draw.content[0].text);

section("tools/call get_card (The Fool, en, brief)");
const card = await rpc("tools/call", {
  name: "get_card",
  arguments: { card: "The Fool", lang: "en", detail: "brief" },
});
console.log(card.content[0].text);

section("tools/call get_card (unknown -> isError)");
const bad = await rpc("tools/call", { name: "get_card", arguments: { card: "cup 4" } });
console.log("isError:", bad.isError, "|", bad.content[0].text);

section("resources/read tarot://spreads/celtic");
const spread = await rpc("resources/read", { uri: "tarot://spreads/celtic" });
const parsed = JSON.parse(spread.contents[0].text);
console.log(parsed.zh.name, "positions:", parsed.zh.positions.length);

section("prompts/get daily_card");
const prompt = await rpc("prompts/get", { name: "daily_card", arguments: { lang: "zh" } });
console.log(prompt.messages[0].content.text.split("\n")[0]);

console.log("\n全部通過。");
