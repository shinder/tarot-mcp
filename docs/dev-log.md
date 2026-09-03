# 開發日誌

倒序，最新在上。記「做了什麼、卡在哪、怎麼解」，設計理由放 `design.md`。

## 2026-09-02 第一階段骨架

### 做了什麼

- 建立專案：pnpm、wrangler 4.127、agents 0.22、`@modelcontextprotocol/server` 2.0、zod 4、vitest 4、TypeScript 7。
- 從塔羅站同步 78 張牌義（`scripts/sync-data.mjs`）。
- 整理八種牌陣為結構化資料（`src/data/spreads.ts`），含位置意義、問題引導、讀法提示、凱爾特十字的六步解讀順序，zh / en 雙語。
- 四個工具：`draw_cards`、`get_card`、`get_spread`、`list_cards`；四個資源；三個 prompt。
- 測試 26 個：亂數與洗牌、抽牌、資料完整性、以及直接呼叫 Worker fetch 的 JSON-RPC 往返。
- `pnpm dev` 在 workerd 內跑起來，`pnpm smoke` 走完 initialize、list、call、read、prompts/get 全部通過。

### 卡點與解法

**McpAgent 已 deprecated。**
原本打算照舊文件用 `McpAgent` 加 Durable Object。查現行文件發現 Cloudflare 已把它標為 deprecated、feature-frozen，改推 `createMcpHandler`（stateless，搭 MCP SDK v2 的 `@modelcontextprotocol/server`）。
本專案沒有 session 狀態需求，直接採用新 API，wrangler.jsonc 因此不需要 DO 與 migrations。

**SDK v2 的 API 形狀。**
文件只給了 `registerTool` 範例，`registerResource`、`registerPrompt`、`ResourceTemplate` 的簽章是直接讀 `node_modules/@modelcontextprotocol/server/dist/*.d.mts` 確認的。
重點：`inputSchema` / `argsSchema` 要用 `z.object({...})` 包起來（raw shape 形式已標 deprecated）；`ResourceTemplate` 的 `list` 必須明確給值（可以是 `undefined`）。

**測試在 Node 跑到 403「Missing Host header」。**
`createMcpHandler` 會驗證 Host。workerd 的 incoming request 一定有 Host，但 Node 的 `new Request()` 不會自動帶。測試的 helper 補上 `req.headers.set("host", ...)` 即可。

**`allowedHostnames` 取代預設值。**
只填正式網域時本機會被擋。讀 agents 的實作確認：有設就整個取代，沒設才依 localhost / workers.dev 自動判斷。清單加入 localhost 與 127.0.0.1。

**8787 埠被另一個 wrangler dev 占用。**
本機同時有其他專案在跑，`pnpm dev --port 8799` 繞過。smoke 腳本讀 `MCP_URL` 環境變數。

### 觀察到、還沒處理

- `get_card` 的候選建議只做子字串比對，「cup 4」找不到 cups-04。之後可以加簡單的 token 比對或編輯距離。
- 英文模式下 `astro` 欄位仍是中文（例如「天王星」），資料層沒有英文星象名。
- 沒有用 Claude Code 實際對話驗證工具描述是否讓模型選對工具，只做了協定層測試。這一步要在下次做。
- 尚未部署，`mcp.tarot.shinder.work` 的 DNS 與 custom domain 要在第一次 `pnpm deploy` 時建立。

### 下一步

1. 用 Claude Code `claude mcp add` 接上本機 server，跑幾個真實對話，看模型是否依 instructions 先 `get_spread` 再 `draw_cards` 再 `get_card`；依結果調整工具描述。
2. 部署到正式站，README 的連線指令換成正式網址驗證一次。
3. 建 GitHub repo，作為 Upwork 作品集第四則。
