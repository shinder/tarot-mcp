# tarot-mcp

Rider-Waite-Smith 塔羅牌的遠端 MCP server，跑在 Cloudflare Workers 上，
資料來自 [小新學塔羅](https://tarot.shinder.work)（78 張牌義、八種牌陣）。

給 AI 助理用的「塔羅參考書」：抽牌在伺服器端進行、牌義與牌陣由工具查詢，
解讀則留給模型。定位是學習與自我反思，不做預測。

```
Claude Code / Claude Desktop / 任何 MCP 用戶端
        │  Streamable HTTP（JSON-RPC over POST）
        ▼
  https://mcp.tarot.shinder.work/mcp
        │  createMcpHandler（stateless，每個 request 一個 McpServer）
        ▼
  tools · resources · prompts  ──  cards.json / spreads.ts（隨 Worker 打包）
```

## 提供什麼

### Tools（模型主動呼叫）

| 工具 | 做什麼 | 重點參數 |
| --- | --- | --- |
| `draw_cards` | 伺服器端洗牌抽牌 | `spread` 或 `count`、`allowReversed`、`seed`、`lang` |
| `get_card` | 單張牌的完整資料 | `card`（slug、中文名或英文名）、`detail`（brief / full） |
| `get_spread` | 牌陣的位置意義與讀法 | `spread` |
| `list_cards` | 78 張牌的精簡清單 | `arcana`、`suit` |

所有工具都接受 `lang: "zh" | "en"`，預設 zh。牌名與關鍵字有雙語；牌義長文目前只有正體中文。

`draw_cards` 沒給 `seed` 時會隨機產生一個並回傳，之後用同一個 seed 可以重現同一組牌。

### Resources（唯讀資料）

| URI | 內容 |
| --- | --- |
| `tarot://cards` | 78 張牌索引（slug、名稱、大小牌、牌組） |
| `tarot://cards/{slug}` | 單張牌完整資料（zh 與 en 兩份） |
| `tarot://spreads` | 牌陣索引 |
| `tarot://spreads/{id}` | 單一牌陣的位置、問題引導、讀法、解讀順序 |

### Prompts（對話範本）

| 名稱 | 用途 |
| --- | --- |
| `daily_card` | 抽今日一牌並用學習者角度講解 |
| `three_card_reading` | 三張牌引導式解讀（time / action / review） |
| `learn_card` | 教一張牌：畫面、正逆位、常見誤讀 |

### 牌陣

`daily`（1）、`time` / `action` / `review`（3）、`relation` / `self`（5）、`decision`（6）、`celtic`（10）。
位置意義與讀法對齊塔羅站的〈凱爾特十字詳解〉與〈主題牌陣〉兩篇文章。

## 開始使用

```sh
pnpm install
pnpm dev                 # http://localhost:8787（埠被占用時加 --port 8799）
pnpm test                # vitest：純函式 + handler 的 JSON-RPC 往返
pnpm smoke               # 對跑起來的 server 走一遍 initialize / list / call
pnpm typecheck
```

### 從 Claude Code 連線

```sh
# 本機開發
claude mcp add --transport http tarot-local http://localhost:8787/mcp

# 正式站（部署後）
claude mcp add --transport http tarot https://mcp.tarot.shinder.work/mcp
```

接上之後可以直接問：「幫我用凱爾特十字看『我和目前工作的關係』」，
模型會依 instructions 先 `get_spread`、再 `draw_cards`、再逐張 `get_card`。

### 用 MCP Inspector 逐一打工具

```sh
npx @modelcontextprotocol/inspector
# Transport 選 Streamable HTTP，URL 填 http://localhost:8787/mcp
```

## 部署

```sh
pnpm deploy              # wrangler deploy --minify
```

正式網域 `mcp.tarot.shinder.work` 設在 `wrangler.jsonc` 的 `routes`（custom domain）。
改網域時要同步 `src/index.ts` 的 `ALLOWED_HOSTNAMES`，
因為這個清單一旦設定就取代預設值（localhost 與 workers.dev）。

沒有 Durable Object、D1 或任何綁定：目前是純 stateless server。

## 資料來源與同步

牌義的單一來源在塔羅站 repo（`../tarot_shinder_work/src/cards/cards.json`）。
本專案的 `src/data/cards.json` 是副本，不要手改，改來源後：

```sh
pnpm sync-data                          # 預設從 ../tarot_shinder_work 讀
TAROT_SRC=/path/to/repo pnpm sync-data
```

牌陣定義（`src/data/spreads.ts`）是手動整理的，來源是塔羅站的 i18n 與文章。

## 專案結構

```
src/
  index.ts          Worker 入口：/mcp、/health、/
  server.ts         McpServer 工廠，集中註冊 tools / resources / prompts
  tools/            每個工具一個檔案
  resources.ts      tarot:// 資源
  prompts.ts        對話範本
  data/cards.ts     牌義型別、查詢、摘要（cards.json 為同步副本）
  data/spreads.ts   牌陣定義（zh / en）
  lib/rng.ts        可重現的亂數與洗牌
  lib/draw.ts       抽牌純函式
  lib/result.ts     工具回傳格式
scripts/
  sync-data.mjs     從塔羅站同步 cards.json
  smoke.mjs         線上冒煙測試
docs/
  mcp-tutorial.md   MCP 教學：協定、實作、測試、部署，以本專案為例
  design.md         設計決策與取捨
  dev-log.md        開發日誌
```

## 路線圖

- 第一階段（本版）：cards、spreads、draw 的 tools / resources / prompts，stateless。
- 第二階段：`search_cards` 自然語言找牌，用 Vectorize 做向量檢索。
- 第三階段：`save_reading` / `list_readings` 占卜日誌，綁塔羅站同一個 D1，加 OAuth。

## 授權與資料

牌圖為公有領域（1909 RWS，Wikimedia Commons）。牌義文字與牌陣內容屬小新學塔羅。
