# CLAUDE.md

Rider-Waite-Smith 塔羅牌的遠端 MCP server，Cloudflare Workers 上的 stateless Streamable HTTP 端點。
資料來自塔羅站 repo（`../tarot_shinder_work`），本專案是它的「給 AI 用的參考書」。
整體說明見 `README.md`，設計理由見 `docs/design.md`，進度與卡點見 `docs/dev-log.md`。

## 常用指令

```sh
pnpm dev                 # wrangler dev；8787 被占用時 --port 8799
pnpm test                # vitest（Node 環境；handler 往返測試直接呼叫 worker.fetch）
pnpm smoke               # 對跑起來的 server 走一遍 JSON-RPC；MCP_URL 可換目標
pnpm typecheck
pnpm sync-data           # 從塔羅站同步 cards.json（副本，不要手改）
pnpm cf-typegen          # 改 wrangler.jsonc 後重新產生 worker-configuration.d.ts
pnpm deploy
```

## 架構要點

- `createMcpHandler`（agents SDK）+ `@modelcontextprotocol/server` v2。**不要**用 `McpAgent`，它已 deprecated；本專案也不需要 Durable Object。
- 每個 request 建一個 `McpServer`（`src/server.ts` 的 `createServer`），tools / resources / prompts 在那裡集中註冊。
- `inputSchema` / `argsSchema` 一律 `z.object({...})`，raw shape 形式已 deprecated。
- 工具錯誤用 `fail()`（isError）回傳，不丟例外；資源找不到才丟例外。
- `src/index.ts` 的 `ALLOWED_HOSTNAMES` 一旦設定就取代預設值，改網域時 wrangler.jsonc 的 routes 與它要一起改，且要保留 localhost。
- Node 的 `Request` 不帶 Host 標頭，測試 helper 有補；新增整合測試沿用 `call()`。

## 慣例

- 一律正體中文、台灣用詞；不使用 emoji。程式註解也是中文。
- 工具的 `description` 與參數描述是給模型看的 prompt，用英文寫、要說清楚「何時用、與哪些工具配合、回什麼」。改了要用 Claude Code 實際對話驗證。
- 工具只回資料，不做解讀；不要新增「解牌」類工具。
- 回傳控制 token：清單只回 slug 與名稱，長文只在 `get_card` 的 full 模式。
- 改牌義一律改塔羅站的來源再 `pnpm sync-data`；牌陣定義在 `src/data/spreads.ts` 手動維護，兩種語言都要填。
- 每次有實質進度，在 `docs/dev-log.md` 加一段（做了什麼、卡點、下一步）。
