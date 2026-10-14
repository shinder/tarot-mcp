# MCP 教學：從協定到部署，以 tarot-mcp 為例

這份文件用本專案當教材，把 Model Context Protocol（MCP）從「它解決什麼問題」講到「怎麼在 Cloudflare Workers 上做一個遠端 server 並接上 Claude」。
每一節都對應到 repo 裡的實際程式碼，讀的時候可以開著 `src/` 對照。
文中的協定行為都在本機 `wrangler dev` 上用 curl 實際驗證過，不是照文件抄的。

讀者假設：會 TypeScript、知道 HTTP 與 JSON，但沒碰過 MCP。
已經熟 MCP 的人可以直接跳到第 5 節看 Workers 上的實作，或第 7 節看測試策略。

目錄

1. MCP 是什麼、為什麼需要
2. 三種能力：tools、resources、prompts
3. 協定層：JSON-RPC、生命週期、Streamable HTTP
4. 用 curl 走一遍
5. 在 Cloudflare Workers 上實作
6. 寫好一個工具的要點
7. 測試：從純函式到真實對話
8. 接上用戶端
9. 部署與安全
10. 常見坑
11. 本專案沒用到的能力
12. 參考資料

---

## 1. MCP 是什麼、為什麼需要

### 問題

語言模型本身只會產生文字。要讓它查資料、抽牌、讀檔案，得靠「工具呼叫」（tool use / function calling）：
開發者把可用的函式用 JSON Schema 描述給模型，模型決定要呼叫哪一個、填什麼參數，應用程式執行後把結果回給模型。

這套機制的問題在於每個應用程式都得自己接。
你寫了一個塔羅查詢函式，想讓 Claude Desktop 用、讓 Claude Code 用、讓 Cursor 用，就要在三個地方各寫一次膠水程式。
反過來，每個 AI 應用程式也得為每一種資料來源各寫一個整合。這是 N × M 的問題。

### MCP 的答案

MCP 把「工具提供方」和「AI 應用程式」之間的介面標準化。
提供方寫一次 MCP server，任何支援 MCP 的應用程式都能接上；應用程式實作一次 MCP client，就能用所有的 server。
可以把它想成 AI 世界的 USB：規格統一之後，裝置和主機各自獨立演進。

三個角色：

| 角色 | 是誰 | 本專案裡 |
| --- | --- | --- |
| Host | 使用者操作的 AI 應用程式，決定什麼時候讓模型看到哪些工具 | Claude Code、Claude Desktop |
| Client | Host 內部負責跟某一個 server 講協定的元件，一個 server 一個 client | Claude Code 內建 |
| Server | 提供 tools、resources、prompts 的程式 | 這個 repo |

Host 與 client 通常是同一個程式的兩層，開發 server 的人不用區分。
重要的是：**server 永遠不直接和模型講話**。它把能力描述給 client，client 轉給模型；模型的呼叫由 client 送過來，server 回結果，client 再塞回模型的 context。
server 看不到對話內容，也不知道模型是誰。

### 本地與遠端

MCP server 有兩種跑法：

- **本地（stdio）**：Host 把 server 當子行程啟動，透過標準輸入輸出講 JSON-RPC。適合存取本機檔案、資料庫。
- **遠端（Streamable HTTP）**：server 是一個 HTTP 端點，Host 用 POST 送請求。適合放在雲端給多人用，可以加 OAuth。

本專案是遠端 server，端點是 `https://mcp.tarot.shinder.work/mcp`。
選遠端的理由很單純：資料是公開的參考書，使用者不需要安裝任何東西，一行指令就能接上。

---

## 2. 三種能力：tools、resources、prompts

MCP server 可以提供三種東西。它們的差別不在資料格式，而在**誰觸發、誰控制**。

### Tools：模型主動呼叫

模型在對話中自己決定要不要用、用哪一個、填什麼參數。這是三者中最常用的。

本專案的四個工具：

| 工具 | 模型什麼時候用 | 回什麼 |
| --- | --- | --- |
| `draw_cards` | 使用者要抽牌 | seed、每張牌的名稱、正逆位、該方向的關鍵字、位置意義 |
| `get_card` | 解讀前查牌義、使用者問某張牌 | 關鍵字、元素、星象，full 模式加牌面描述、象徵、歷史 |
| `get_spread` | 開始占卜前載入牌陣 | 位置意義、問題引導、讀法提示、凱爾特十字的解讀順序 |
| `list_cards` | 找 slug、列某牌組的牌 | 78 張牌的 slug 與中英名稱 |

設計原則：工具做**模型做不好的事**。真隨機、權威資料、結構化的位置定義，這些模型自己「想」會出錯。
解讀則是模型的強項，所以沒有 `interpret_reading` 這種工具（見 `docs/design.md` 第 3 條）。

### Resources：應用程式或使用者主動載入

Resource 是一份有 URI 的唯讀資料。模型不會主動「呼叫」resource；是 Host 決定要不要把它放進 context，例如 Claude Desktop 讓使用者手動附加、或某些 client 在對話開始時預載。

本專案的四個 resource：

```
tarot://cards              78 張牌索引
tarot://cards/{slug}       單張牌完整資料（zh 與 en 兩份）
tarot://spreads            牌陣索引
tarot://spreads/{id}       單一牌陣的位置與讀法
```

帶大括號的是 **resource template**：URI 有變數，client 用 `resources/templates/list` 拿到樣板，再自己組出實際的 URI 來讀。
template 還可以提供 `complete` 回呼，讓 client 做自動補全（打 `cu` 就列出 `cups-01` 到 `cups-14`）。

什麼時候用 resource 而不是 tool？當資料是「給人看或給程式預載」而不是「模型在推理中途去查」。
實務上很多 client 對 resource 的支援還不完整（Claude Code 目前主要用 tools），所以本專案的 resource 與 tool 內容有重疊：同一份資料兩種取法，讓不同的 client 都能用到。

### Prompts：使用者選的對話範本

Prompt 是預先寫好的訊息模板，帶參數。Host 會把它列成可選指令（Claude Desktop 的斜線指令、Claude Code 的 `/mcp__tarot__daily_card`），
使用者選了、填了參數之後，server 回一段訊息，client 把它當使用者訊息送給模型。

本專案的三個 prompt：`daily_card`、`three_card_reading`、`learn_card`。
它們的內容不是牌義，而是**流程與態度**：先呼叫哪些工具、用什麼順序解讀、字數限制、倫理界線。
看 `src/prompts.ts` 的 `three_card_reading`，它明確寫「先 get_spread、再 draw_cards、再對每張牌 get_card（detail: full）」。
這是把「好的用法」包裝成一鍵可用的東西。

### 三者比較

| | Tools | Resources | Prompts |
| --- | --- | --- | --- |
| 誰決定用 | 模型 | Host 或使用者 | 使用者 |
| 有副作用嗎 | 可以有 | 不應該有 | 無 |
| 帶參數 | JSON Schema 定義 | URI 變數 | 命名參數 |
| 回什麼 | content 陣列（文字、圖片等）加選用的結構化資料 | contents 陣列（文字或二進位，帶 mimeType） | messages 陣列 |
| 本專案數量 | 4 | 2 固定 + 2 樣板 | 3 |

---

## 3. 協定層：JSON-RPC、生命週期、Streamable HTTP

### JSON-RPC 2.0

MCP 的每一則訊息都是 JSON-RPC 2.0。三種形態：

```jsonc
// Request：有 id，對方一定要回
{ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "get_card", "arguments": { "card": "愚者" } } }

// Response：id 對應 request，result 或 error 擇一
{ "jsonrpc": "2.0", "id": 1, "result": { "content": [ { "type": "text", "text": "..." } ] } }
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32602, "message": "Tool nope not found" } }

// Notification：沒有 id，不用回
{ "jsonrpc": "2.0", "method": "notifications/initialized" }
```

MCP 定義的方法名稱一律是 `領域/動作`。本專案會碰到的：

| 方法 | 做什麼 |
| --- | --- |
| `initialize` | 交換協定版本與能力，server 回 `serverInfo` 與 `instructions` |
| `notifications/initialized` | client 表示準備好了（notification） |
| `tools/list` | 列出工具與其 JSON Schema |
| `tools/call` | 呼叫工具 |
| `resources/list` | 列出固定 URI 的資源 |
| `resources/templates/list` | 列出 URI 樣板 |
| `resources/read` | 讀一個 URI |
| `prompts/list` | 列出 prompt |
| `prompts/get` | 取得填好參數的 prompt 訊息 |
| `completion/complete` | 自動補全（resource template 變數、prompt 參數） |
| `ping` | 心跳 |

### 生命週期

```
client                                     server
  │  initialize {protocolVersion, capabilities, clientInfo}
  │ ─────────────────────────────────────────▶
  │  ◀───── {protocolVersion, capabilities, serverInfo, instructions}
  │  notifications/initialized
  │ ─────────────────────────────────────────▶   (202，沒有內容)
  │
  │  tools/list、tools/call、resources/read ...
  │ ◀────────────────────────────────────────▶
```

`initialize` 的回應有兩個對開發 server 的人特別重要的欄位：

- `capabilities`：server 宣告自己支援什麼。本專案回 `tools`、`resources`、`prompts` 各帶 `listChanged: true`，加上 `completions`。這些是 SDK 自動依你註冊了什麼填的。
- `instructions`：一段給模型看的說明文字。client 通常會把它放進 system prompt。本專案用它講定位（參考書，不做預測）、工具分工、以及「抽完牌要對每張牌呼叫 get_card」。這是 server 對模型行為最直接的影響管道，見 `src/server.ts` 的 `INSTRUCTIONS`。

### Streamable HTTP

遠端 MCP 目前的標準傳輸是 Streamable HTTP（2025-03-26 版協定引入，取代舊的 HTTP+SSE 雙端點）。規則：

1. 所有 JSON-RPC 訊息都 **POST** 到同一個端點（本專案是 `/mcp`）。
2. Request 要帶 `Content-Type: application/json` 與 `Accept: application/json, text/event-stream`。**兩種 Accept 都要**，少一個會拿到 406。
3. Server 可以用 `application/json` 直接回一則回應，也可以用 `text/event-stream`（SSE）回一串訊息。client 要兩種都能解析。本專案的 SDK 選擇一律回 SSE，即使只有一則回應。
4. Notification 的 POST 回 202 Accepted，沒有內容。
5. Server 若要維持 session，會在 `initialize` 的回應加 `Mcp-Session-Id` 標頭，client 之後每個 request 都帶上。**本專案是 stateless，不發 session id**，每個 POST 都是獨立的。
6. GET 同一個端點可以開一條長連線讓 server 主動推訊息。stateless 模式下不支援，本專案回 405。

stateless 的意思是：server 不記得上一個 request。所以 `tools/call` 不需要先 `initialize` 也能成功（第 4 節會實際打一次）。
這在 Workers 上是很自然的形態：每個 request 可能落在不同的機器，沒有東西可以記。
代價是失去 server 主動推送的能力（elicitation、sampling、資源變更通知），本專案用不到。

---

## 4. 用 curl 走一遍

先把 server 跑起來：

```sh
pnpm dev --port 8799
```

以下每一段都可以直接貼到終端機。回應是 SSE 格式，看 `data:` 那一行。

### initialize

```sh
curl -s -X POST http://localhost:8799/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

回應（節錄）：

```
event: message
data: {"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":true},"resources":{"listChanged":true},"completions":{},"prompts":{"listChanged":true}},"serverInfo":{"name":"tarot-mcp","version":"0.1.0"},"instructions":"Tarot reference server for the Rider-Waite-Smith deck ..."},"jsonrpc":"2.0","id":1}
```

注意回應標頭沒有 `Mcp-Session-Id`，這就是 stateless。

### 直接呼叫工具，不先 initialize

```sh
curl -s -X POST http://localhost:8799/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_card","arguments":{"card":"愚者","detail":"brief"}}}'
```

```
data: {"result":{"content":[{"type":"text","text":"愚者（The Fool）\n元素：風；星象：天王星\n正位：開始、冒險、天真、無限可能、隨性\n逆位：魯莽、猶豫不決、愚蠢、缺乏方向\nhttps://tarot.shinder.work/cards/00-fool"}],"structuredContent":{"slug":"00-fool","name":"愚者", ...}},"jsonrpc":"2.0","id":2}
```

成功。工具回傳有兩份：`content` 是給模型讀的文字，`structuredContent` 是符合 `outputSchema` 的 JSON，給程式用。

### 幾種錯誤的長相

參數不合 schema（工具層錯誤，`isError: true`，模型看得到訊息可以自己修正）：

```sh
-d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"draw_cards","arguments":{"spread":"lovers"}}}'
```

```
data: {"result":{"content":[{"type":"text","text":"Input validation error: Invalid arguments for tool draw_cards: spread: Invalid option: expected one of \"daily\"|\"time\"|..."}],"isError":true},"jsonrpc":"2.0","id":3}
```

工具不存在（協定層錯誤，JSON-RPC error）：

```
data: {"jsonrpc":"2.0","id":4,"error":{"code":-32602,"message":"Tool nope not found"}}
```

資源不存在（handler 丟例外，SDK 轉成 JSON-RPC error）：

```sh
-d '{"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"tarot://cards/nope"}}'
```

```
data: {"jsonrpc":"2.0","id":5,"error":{"code":-32603,"message":"Unknown card slug: nope"}}
```

Accept 標頭少了 SSE（HTTP 406）：

```
{"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}
```

這四種錯誤的差別在第 6 節會回來談：什麼時候該讓模型看到錯誤，什麼時候該讓協定層擋掉。

`scripts/smoke.mjs` 就是把上面這些包成一個腳本，`pnpm smoke` 會依序打 initialize、三種 list、tools/call、resources/read、prompts/get。
它刻意不用 SDK 的 client，就是為了讓線路上的東西一目了然。

---

## 5. 在 Cloudflare Workers 上實作

### 套件

```jsonc
"dependencies": {
  "@modelcontextprotocol/server": "^2.0.0",   // MCP 官方 SDK v2，server 端
  "agents": "^0.22.0",                        // Cloudflare Agents SDK，提供 createMcpHandler
  "zod": "^4.5.4"                             // 定義 schema
}
```

`@modelcontextprotocol/server` 提供 `McpServer` 類別與各種 `register*` 方法。
`agents` 的 `createMcpHandler` 把 `McpServer` 包成 Workers 的 `fetch` handler，處理 Streamable HTTP 的細節、CORS、Host 驗證。

注意 Cloudflare 舊文件推的 `McpAgent`（Durable Object 為基礎、stateful）已標為 deprecated。
本專案用的是新的 stateless 路線，所以 `wrangler.jsonc` 沒有 Durable Object、沒有 migrations。理由見 `docs/design.md` 第 1 條。

### 入口：`src/index.ts`

```ts
import { createMcpHandler } from "agents/mcp/server";
import { createServer } from "./server";

const ALLOWED_HOSTNAMES = ["mcp.tarot.shinder.work", "localhost", "127.0.0.1"];

const mcp = createMcpHandler(createServer, {
  route: "/mcp",
  allowedHostnames: ALLOWED_HOSTNAMES,
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") return mcp(request, env, ctx);
    if (url.pathname === "/health") return Response.json({ ok: true });
    // ... "/" 說明頁、其他 404
  },
} satisfies ExportedHandler<Env>;
```

`createMcpHandler` 的第一個參數是**工廠函式**，不是 server 實例。每個 request 它會呼叫一次 `createServer()`，建一個全新的 `McpServer`，處理完就丟掉。
這就是 stateless 的實作方式：沒有跨 request 共享的物件，自然沒有狀態。

建 `McpServer` 的成本很低（註冊幾個函式而已），78 張牌的資料是模組層級的常數，Worker 啟動時載入一次，不會每個 request 重讀。

### 工廠：`src/server.ts`

```ts
export function createServer(): McpServer {
  const server = new McpServer(
    { name: "tarot-mcp", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );
  registerDrawCards(server);
  registerGetCard(server);
  registerGetSpread(server);
  registerListCards(server);
  registerResources(server);
  registerPrompts(server);
  return server;
}
```

所有註冊集中在這裡，每個工具一個檔案、各自 export 一個 `registerXxx(server)`。
要加工具就是新增一個檔案、在這裡多一行。

### 註冊一個工具：`src/tools/get-spread.ts`

```ts
const InputSchema = z.object({
  spread: z.enum(SPREAD_IDS).describe("Spread id: daily, time, action, review, relation, self, decision, celtic."),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const OutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  cardCount: z.number(),
  positions: z.array(z.object({ index: z.number(), name: z.string(), meaning: z.string() })),
  // ...
});

export function registerGetSpread(server: McpServer) {
  server.registerTool(
    "get_spread",
    {
      title: "Get a spread's positions and reading guide",
      description: "Describe a tarot spread: ... Use it to plan a reading before draw_cards ... Available ids: daily (1), time (3), ...",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const spread = getSpread(input.spread);
      if (!spread) return fail(`找不到牌陣「${input.spread}」。`);
      const data = localizeSpread(spread, input.lang);
      return ok(renderText(data), data);
    },
  );
}
```

幾個細節：

- `inputSchema` 給 `z.object(...)`。SDK v2 會自動轉成 JSON Schema 放進 `tools/list`，也會在呼叫前驗證參數，驗證失敗自動回 `isError`（第 4 節看到的那個）。
  v1 接受「raw shape」（直接給 `{ spread: z.enum(...) }`），v2 標為 deprecated，一律包 `z.object`。
- `.describe()` 的文字會進 JSON Schema 的 `description`，模型填參數時看得到。
- `outputSchema` 是選用的。給了之後，回傳值的 `structuredContent` 會被驗證，client 也能拿到型別資訊。
- `annotations` 是給 client 的提示：`readOnlyHint` 表示沒有副作用（client 可能因此不問使用者就放行）、`idempotentHint` 表示重複呼叫結果一樣、`openWorldHint: false` 表示不會碰外部世界。`draw_cards` 的 `idempotentHint` 是 `false`，因為沒給 seed 時每次結果不同。
- handler 收到的 `input` 已經是驗證過、套用過預設值的物件，型別由 zod 推導。

### 回傳格式：`src/lib/result.ts`

```ts
export function ok(text: string, structured: Record<string, unknown>) {
  return { content: [{ type: "text", text }], structuredContent: structured };
}
export function fail(text: string) {
  return { content: [{ type: "text", text }], isError: true as const };
}
```

`content` 是陣列，元素可以是 `text`、`image`、`audio`、`resource_link`、`resource`。本專案只用文字。
文字版本是給模型讀的，所以格式要好讀：每行一個欄位、用頓號分隔關鍵字。
`structuredContent` 是同一份資料的 JSON，給有能力處理結構的 client。兩份內容應該一致。

### 註冊 resource：`src/resources.ts`

固定 URI：

```ts
server.registerResource(
  "cards",
  "tarot://cards",
  { title: "Card index", description: "...", mimeType: "application/json" },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(index) }],
  }),
);
```

URI 樣板：

```ts
server.registerResource(
  "card",
  new ResourceTemplate("tarot://cards/{slug}", {
    list: undefined,
    complete: { slug: (value) => CARDS.map((c) => c.slug).filter((s) => s.startsWith(value)) },
  }),
  { title: "Card detail", description: "...", mimeType: "application/json" },
  async (uri, variables) => {
    const card = findCard(String(variables.slug));
    if (!card) throw new Error(`Unknown card slug: ${variables.slug}`);
    return { contents: [ /* ... */ ] };
  },
);
```

`list: undefined` 要明確寫。這個回呼是讓 `resources/list` 把樣板展開成具體項目用的；給了的話 78 張牌會全部列出來，把 client 的資源清單塞爆。
不給，client 只在 `resources/templates/list` 看到一筆樣板，要哪張自己組 URI。

resource 找不到時是 `throw`，不是 `fail()`。因為 resource 沒有 `isError` 這種「軟錯誤」的概念，URI 不存在就是協定層的錯。

### 註冊 prompt：`src/prompts.ts`

```ts
server.registerPrompt(
  "three_card_reading",
  {
    title: "Three-card reading",
    description: "A guided three-card reading on a question the user provides.",
    argsSchema: z.object({
      question: z.string().min(1).describe("The question the user holds while shuffling."),
      spread: z.enum(["time", "action", "review"]).default("time"),
      lang: z.enum(["zh", "en"]).default("zh"),
    }),
  },
  async ({ question, spread, lang }) => ({
    messages: [{ role: "user", content: { type: "text", text: `我的問題：${question}\n先用 get_spread（spread: ${spread}）...` } }],
  }),
);
```

`argsSchema` 同樣是 `z.object`。回傳的 `messages` 可以有多則、可以是 assistant 角色（做 few-shot），本專案只用一則使用者訊息。

### Wrangler 設定

```jsonc
{
  "name": "tarot-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-11",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [{ "pattern": "mcp.tarot.shinder.work", "custom_domain": true }],
  "observability": { "enabled": true }
}
```

就這樣。`nodejs_compat` 是 SDK 需要的。沒有任何 binding。
之後加占卜日誌會需要 D1，加向量搜尋會需要 Vectorize，都是在這裡加一段 binding 再跑 `pnpm cf-typegen` 更新型別。

---

## 6. 寫好一個工具的要點

這一節是本專案最花心思的部分，也是「能跑」和「模型用得好」之間的差別。

### 描述是 prompt，不是文件

`tools/list` 回的 `description` 和每個參數的 `describe()`，會原封不動進入模型的 context。模型挑工具、填參數，靠的就是這些字。
所以描述要回答三個問題：**什麼情況該用、和其他工具怎麼配合、會回什麼**。

`draw_cards` 的描述（修正後）：

> Shuffle a 78-card Rider-Waite-Smith deck and draw cards on the server. Prefer a `spread` so each card comes with its position meaning; otherwise give `count`. Returns only names, orientation and keywords per card, plus the seed. Before interpreting, call get_card for every drawn card, in any language, so the reading is grounded in the reference and not in memory. Tell the user the seed so the same draw can be reproduced. The result is for learning and reflection, not prediction; interpretation is your job, not the tool's.

每一句都有目的：「Prefer a spread」避免模型亂用 `count`；「Returns only ... keywords」讓模型知道這不夠解讀；「call get_card for every drawn card」是驗證後補的，因為英文對話時模型跳過了這步（見 `dev-log.md` 2026-09-03）；「Tell the user the seed」讓結果可核對。

`get_spread` 的描述直接列出所有牌陣 id 與張數，模型不用先呼叫一次才知道有哪些。實測中模型就是靠這段列出全部八種牌陣給使用者選。

描述用英文寫。模型對英文指令的遵循度較穩，而且工具描述的讀者是模型，不是使用者。

### instructions 與描述互補

server 層級的 `instructions` 講整體：定位、工具分工、倫理界線。工具描述講局部：這個工具怎麼用。
重要的行為規則（抽完牌要查牌義）兩邊都寫，因為不同 client 對 instructions 的處理不一樣，有的會放進 system prompt，有的會忽略。

### 錯誤要讓模型看得到

工具層錯誤（找不到牌、參數組合不對）用 `isError: true` 回文字，並盡量附候選：

```
找不到牌「cup 4」。你是不是要找：cups-04（聖杯四 / Four of Cups）
```

模型看到這段會自己修正再呼叫一次。如果改成 `throw`，會變成 JSON-RPC error，很多 client 直接中斷該輪，模型無法恢復。

反過來，協定層的錯（工具不存在、resource URI 不存在）就該是 JSON-RPC error。那不是模型能修的東西。

### 控制回傳的 token 量

工具回傳的每個字都會進 context，而且會留在整段對話裡。原則：

- 清單只回識別碼與名稱。`list_cards` 78 張約幾百 token。
- 長文只在需要時給。`get_card` 有 `brief` / `full` 兩檔。
- 抽牌結果只帶關鍵字，長文讓模型自己決定要對哪幾張 `get_card`。
- resource template 不提供 `list`，避免清單膨脹。

實測凱爾特十字：模型對十張牌都呼叫 `get_card` full，一次對話約 0.54 美元。可接受，但如果要省，可以在描述裡建議大牌陣先用 brief。

### 分離純邏輯與協定

`src/lib/draw.ts` 的 `drawCards()` 是純函式：吃 `{ count, allowReversed, seed }`，回 `{ seed, cards }`，不碰 zod、不碰 `McpServer`。
`src/tools/draw-cards.ts` 只做三件事：驗證輸入、呼叫純函式、把結果排版成文字與 JSON。
這樣抽牌邏輯可以獨立單元測試，工具層的測試只需要確認接線正確。

---

## 7. 測試：從純函式到真實對話

MCP server 的正確性有四層，每層抓的問題不一樣。

### 第一層：純函式單元測試

`src/lib/draw.test.ts`、`src/data/data.test.ts`。測洗牌可重現、同 seed 同結果、78 張牌資料完整、每個牌陣位置數與 `cardCount` 一致。
跑得最快，不需要任何協定知識。

### 第二層：handler 往返測試

`src/index.test.ts` 直接呼叫 Worker 的 `fetch`，用 JSON-RPC 走一遍：

```ts
function call(path: string, init?: RequestInit) {
  const req = new Request(`http://localhost:8787${path}`, init);
  req.headers.set("host", "localhost:8787");   // Node 的 Request 不自動帶 Host
  return worker.fetch(req as never, {} as Env, ctx);
}
```

在 Node 環境跑 vitest，不需要 workerd。`Request` / `Response` 是 Web 標準 API，Node 18 以上原生支援。
唯一的坑是 Host 標頭：workerd 收到的 request 一定有 Host，但 Node 的 `new Request()` 不會自動加，而 handler 會驗證 Host（第 9 節）。helper 補上就好。

這層測的是：路由、schema 驗證、`isError` 與 JSON-RPC error 的區分、resource 讀取、prompt 產生。

### 第三層：冒煙測試

`pnpm smoke` 對跑起來的 server（本機或正式站）走一遍。抓的是第二層抓不到的環境問題：workerd 的相容性、部署後的網域與 Host 設定、CORS。

```sh
MCP_URL=https://mcp.tarot.shinder.work/mcp pnpm smoke
```

### 第四層：真實對話

前三層都只證明「協定正確」，不能證明「模型會用對」。工具描述寫得好不好，只有讓模型實際用過才知道。

用 Claude Code 的非互動模式可以批次跑：

```sh
pnpm dev --port 8799

cat > /tmp/mcp.json <<'EOF'
{"mcpServers":{"tarot":{"type":"http","url":"http://localhost:8799/mcp"}}}
EOF

claude -p "用三張牌陣幫我看看最近想換工作這件事" \
  --mcp-config /tmp/mcp.json --strict-mcp-config \
  --allowedTools "mcp__tarot__*" \
  --output-format stream-json --verbose < /dev/null \
  | jq -r 'select(.type=="assistant") | .message.content[] | select(.type=="tool_use") | "\(.name) \(.input|tojson)"'
```

輸出是工具呼叫序列：

```
mcp__tarot__get_spread {"spread":"action"}
mcp__tarot__draw_cards {"spread":"action"}
mcp__tarot__get_card {"card":"pentacles-10"}
mcp__tarot__get_card {"card":"pentacles-07"}
mcp__tarot__get_card {"card":"swords-04"}
```

參數說明：`--strict-mcp-config` 只載入這個設定檔的 server，不會混到使用者自己設定的其他 MCP；`--allowedTools` 自動放行工具呼叫，不會卡在權限確認；`stream-json` 每行一個事件，方便用 jq 篩。

這層抓到的問題長這樣：七段對話裡，英文抽牌那段模型抽完沒查 `get_card`，牌面描述靠記憶。修描述、重跑、確認修正。
每段對話約 0.2 到 0.5 美元，改了描述就跑一輪，值得。

---

## 8. 接上用戶端

### Claude Code

```sh
claude mcp add --transport http tarot https://mcp.tarot.shinder.work/mcp
claude mcp list
```

接上後工具會以 `mcp__tarot__draw_cards` 這種名稱出現，prompt 會變成 `/mcp__tarot__daily_card` 斜線指令。
Claude Code 用延遲載入：對話開始時只知道工具名稱，第一次要用某個工具時才透過 `ToolSearch` 載入完整 schema。所以 stream-json 輸出裡每段對話開頭都會看到一次 `ToolSearch`，那是 client 的機制，不是 server 的問題。

### Claude Desktop 與 claude.ai

設定 → Connectors → Add custom connector，填端點網址。
不需要 OAuth 的 server 直接就能用；需要的話 Desktop 會走 OAuth 流程（本專案第三階段才會加）。

### MCP Inspector

官方的除錯工具，一個網頁介面可以列工具、填參數、看原始 JSON：

```sh
npx @modelcontextprotocol/inspector
```

Transport 選 Streamable HTTP，URL 填 `http://localhost:8799/mcp`。
比 curl 方便的地方是它會處理 SSE 解析、顯示 schema、記住上次的參數。

### 其他 client

任何支援 Streamable HTTP 的 client（Cursor、Windsurf、VS Code Copilot、Cline 等）設定方式都類似，通常是一個 JSON 檔：

```json
{ "mcpServers": { "tarot": { "url": "https://mcp.tarot.shinder.work/mcp" } } }
```

欄位名稱各家略有不同（`url` / `type: "http"` / `transport: "streamable-http"`），查該 client 的文件。

### 自己寫 client

如果要在自己的程式裡呼叫，用官方 SDK：

```ts
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.tarot.shinder.work/mcp")));
const { tools } = await client.listTools();
const result = await client.callTool({ name: "draw_cards", arguments: { spread: "daily" } });
```

或者像 `scripts/smoke.mjs` 那樣直接用 `fetch` 打 JSON-RPC，三十行就夠。

---

## 9. 部署與安全

### 部署

```sh
pnpm deploy      # wrangler deploy --minify
```

第一次部署時 Wrangler 會依 `routes` 的 `custom_domain: true` 在 Cloudflare 建 DNS 記錄與憑證。前提是 `shinder.work` 這個 zone 已經在帳號裡。
部署後用 `MCP_URL=... pnpm smoke` 驗證。

### Host 驗證（DNS rebinding 防護）

`createMcpHandler` 會檢查 request 的 Host 標頭是否在允許清單。這是防 DNS rebinding：惡意網頁把某個網域指到 127.0.0.1，就能透過瀏覽器打你本機的 MCP server。
對本機 stdio 或 localhost 的 server 這很重要；對已經在公網、由 Cloudflare 依 Host 路由的 Worker，實際威脅很低，但 SDK 預設開著。

兩個要知道的行為：

1. `allowedHostnames` **一旦設定就整個取代預設值**。不設的話，SDK 依 request 的 hostname 自動判斷（localhost 允許 localhost 系列、workers.dev 允許該網域）。設了就只認你列的。所以本專案的清單含 `localhost` 與 `127.0.0.1`，否則 `wrangler dev` 會被自己擋掉。
2. `wrangler dev` 前面有一層代理，會把 Host 改寫成 localhost。所以本機用 curl 送錯的 Host 也會過，這不代表檢查沒作用；在 Node 測試（沒有代理）裡少了 Host 就會拿到 403。

改網域時，`wrangler.jsonc` 的 `routes` 和 `src/index.ts` 的 `ALLOWED_HOSTNAMES` 要一起改。

### Origin 與 CORS

`createMcpHandler` 預設也驗 Origin 標頭（瀏覽器發的請求才有），並回 CORS 標頭。
非瀏覽器的 client（Claude Code、Desktop、curl）不帶 Origin，不受影響。
要讓某個網頁前端直接呼叫，用 `allowedOriginHostnames` 與 `corsOptions` 設定。

### 認證

本專案目前沒有認證：資料是公開參考書，沒有寫入操作。
第三階段加占卜日誌時會需要 OAuth。MCP 規範的認證是 OAuth 2.1，server 要提供 `/.well-known/oauth-protected-resource` 讓 client 發現授權伺服器。
Cloudflare 有 `workers-oauth-provider`，塔羅站用的 better-auth 也有 MCP 外掛，兩條路都可行，見 `design.md` 的「尚未決定」。

### 濫用

stateless server 每個 request 獨立，天然抗放大攻擊。
要限流可以用 Cloudflare 的 Rate Limiting rules，不用改程式。
工具本身要注意的是輸入上限：`draw_cards` 的 `count` 最多 10、`seed` 最長 64 字元，都在 schema 裡擋。

---

## 10. 常見坑

開發過程實際踩到的，都記在 `dev-log.md`，這裡整理成清單。

| 現象 | 原因 | 解法 |
| --- | --- | --- |
| 406 Not Acceptable | Accept 少了 `text/event-stream` 或 `application/json` | 兩個都帶 |
| 403 Missing Host header（測試） | Node 的 `Request` 不自動帶 Host | 測試 helper 補上 |
| 403 Host not allowed（wrangler dev） | `allowedHostnames` 只填了正式網域 | 加上 localhost 與 127.0.0.1 |
| `registerTool` 型別錯誤 | 用了 v1 的 raw shape | 包 `z.object({...})` |
| `ResourceTemplate` 型別錯誤 | 沒給 `list` | 明確寫 `list: undefined` |
| 資源清單出現 78 筆 | template 給了 `list` 回呼 | 拿掉，改用索引資源 |
| 模型不查牌義就解讀 | 工具描述沒說「回傳只有關鍵字」 | 描述明說要呼叫 get_card |
| 模型用 `count` 不用 `spread` | 描述沒引導 | 描述寫「Prefer a spread」 |
| 找 `McpAgent` 相關文件 | 已 deprecated | 用 `createMcpHandler` |
| 8787 埠被占用 | 另一個 wrangler dev | `--port 8799`，smoke 用 `MCP_URL` |
| SDK 文件沒寫全 | v2 剛出 | 讀 `node_modules/@modelcontextprotocol/server/dist/*.d.mts` |

---

## 11. 本專案沒用到的能力

知道有這些東西，之後需要時知道去哪找。

- **Sampling**：server 反過來請 client 的模型生成文字。例如工具內部需要摘要一段長文。需要 stateful 連線。
- **Elicitation**：server 在工具執行中途向使用者問問題（「你要哪一種牌陣？」）。需要 stateful 連線。
- **Roots**：client 告訴 server 它能存取哪些檔案路徑。本地 server 用。
- **Notifications**：`tools/list_changed` 等，server 通知 client 清單變了。stateless 下 SDK 會宣告 `listChanged: true` 但實際不會推。
- **Progress**：長時間工具回報進度。
- **Stateful session**：用 `Mcp-Session-Id` 維持連線狀態。在 Workers 上要用 Durable Object，agents SDK 有對應的 API。上面四項都依賴它。
- **Tasks**：MCP 較新的非同步工作機制，讓工具可以「先回一個 task id，之後再查結果」。

本專案的工具全是毫秒級的查詢，stateless 夠用。第三階段的占卜日誌會用 D1 加 OAuth 身分當 key，一樣不需要 session。

---

## 12. 參考資料

- MCP 規範：https://modelcontextprotocol.io/specification/latest
- MCP 官方 TypeScript SDK（v2，server 端）：https://github.com/modelcontextprotocol/typescript-sdk
- MCP Inspector：https://github.com/modelcontextprotocol/inspector
- Cloudflare Agents SDK 的 MCP 章節：https://developers.cloudflare.com/agents/model-context-protocol/
- Cloudflare 遠端 MCP server 指南：https://developers.cloudflare.com/agents/guides/remote-mcp-server/
- Claude Code MCP 設定：https://docs.claude.com/en/docs/claude-code/mcp
- 本專案：`README.md`（總覽）、`docs/design.md`（決策）、`docs/dev-log.md`（日誌）
