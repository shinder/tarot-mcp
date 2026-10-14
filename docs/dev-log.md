# 開發日誌

倒序，最新在上。記「做了什麼、卡在哪、怎麼解」，設計理由放 `design.md`。

## 2026-10-13 部署正式站

### 做了什麼

- `pnpm typecheck` 與 `pnpm test`（26 個）通過後，`pnpm deploy` 第一次部署。wrangler 依 `routes` 的 `custom_domain: true` 自動建立 `mcp.tarot.shinder.work` 的 DNS 與憑證，不需要手動到 dashboard 設定。版本 158aa810。
- 上傳 892 KiB（gzip 206 KiB），Worker 啟動 42 ms。
- 驗證：
  - `GET /health` 回 `{"ok":true,"cards":78}`，`GET /` 首頁文字正常。
  - `MCP_URL=https://mcp.tarot.shinder.work/mcp pnpm smoke` 全部通過。
  - `claude -p "幫我抽今日一牌，簡短解讀"` 接正式站，模型呼叫順序 `draw_cards(daily)` → `get_card(cups-13)`，與本機行為一致。

### 觀察到、還沒處理

- wrangler 4.127 的 OAuth token 少了 `challenge-widgets.write` scope，只是警告，不影響部署；下次 `wrangler login` 會補上。
- wrangler 有新版 4.149，尚未升級。

### 下一步

1. 建 GitHub repo，推上去。
2. 加進 Upwork 作品集（動作品集前先讀 astro 與 tarot 專案的 `upwork-portfolio-en-ui.md`）。
3. 錄一段 Loom 示範影片（Upwork「MCP Server Developer - Bug Fix」案子要求）。

## 2026-09-03 真實對話驗證工具描述

### 做了什麼

- 第一次 commit（7afde1f）。
- 用 `claude -p` 非互動模式接上本機 server，跑七段真實對話，觀察模型呼叫工具的順序。做法：

  ```sh
  pnpm dev --port 8799
  echo '{"mcpServers":{"tarot":{"type":"http","url":"http://localhost:8799/mcp"}}}' > /tmp/mcp.json
  claude -p "用三張牌陣幫我看看最近想換工作這件事" \
    --mcp-config /tmp/mcp.json --strict-mcp-config \
    --allowedTools "mcp__tarot__*" --output-format stream-json --verbose < /dev/null \
    | jq -r 'select(.type=="assistant") | .message.content[] | select(.type=="tool_use") | "\(.name) \(.input|tojson)"'
  ```

- 結果摘要（每段約 0.23 到 0.54 美元）：

  | 對話 | 工具呼叫順序 | 判定 |
  |---|---|---|
  | 三張牌陣問換工作 | get_spread(action) → draw_cards → get_card ×3 | 符合預期，自行從三種三張牌陣挑了 action 並說明理由 |
  | 抽今日牌 | draw_cards(daily) → get_card | 符合預期 |
  | 愚者逆位是什麼意思 | get_card("愚者", full) | 中文名解析正確 |
  | cup 4 是什麼牌 | get_card("cups-04") | 模型自己把口語轉成 slug，候選建議沒被觸發 |
  | 凱爾特十字問感情 | get_spread(celtic) → draw_cards → get_card ×10 | 符合預期，解讀依六步順序，沒有斷言結果 |
  | 英文抽一張牌 | draw_cards(lang=en) 之後**沒有**查 get_card | 牌面描述靠記憶，偏離 instructions |
  | 有哪些牌陣可問愛情 | get_spread ×3 | 靠描述裡列的 id 與張數列出八種，再細查三種，可接受 |

- 修正：`draw_cards` 描述改成明說回傳只有關鍵字，解讀前要對每張牌呼叫 `get_card`（不分語言），並提醒把 seed 告訴使用者；server instructions 同步加上這句。重跑英文與今日牌兩段，模型都改為抽完就查 `get_card`。

### 觀察到、還沒處理

- 大牌陣一律 full 模式，凱爾特十字一次拉十張長文，約 3,300 個輸出 token 以上的解讀。目前可接受，若之後要省 token，可在描述裡建議大牌陣先用 brief。
- 使用者只說「三張牌陣」時，模型自行選了 action，沒有先問。這是合理判斷，暫不處理。
- `claude -p` 每段對話都會先跑一次 ToolSearch 載入工具定義，這是 Claude Code 的延遲載入機制，不是 server 的問題。

- 寫了 `docs/mcp-tutorial.md`：以本專案為例的 MCP 教學，十二節，從協定講到部署。文中的協定行為（stateless 不發 session id、notification 回 202、GET 回 405、少 Accept 回 406、四種錯誤的長相）都用 curl 對本機 server 驗證過。
  順帶查清一件事：`wrangler dev` 前面的代理會把 Host 改寫成 localhost，所以本機用 curl 送錯的 Host 也會過，不代表 `allowedHostnames` 沒作用；Node 測試沒有這層代理，少了 Host 就是 403。

### 下一步

1. 部署到正式站，README 的連線指令換成正式網址驗證一次。
2. 建 GitHub repo。

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
