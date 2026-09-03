# 設計決策

每一條都是「選了什麼、為什麼、放棄了什麼」。日後改方向時先回來看這裡。

## 1. Stateless handler，不用 McpAgent

**選擇**：`createMcpHandler`（agents SDK 0.22 + `@modelcontextprotocol/server` 2.0），每個 request 建一個新的 `McpServer`。

**為什麼**：Cloudflare 已把 `McpAgent` 標為 deprecated、feature-frozen，官方文件明講「盡早遷移到 createMcpHandler」。
本專案的工具全是無狀態查詢（抽牌、查牌、查牌陣），沒有需要跨 request 保存的 session 狀態，
stateless 剛好是最單純的形態：不需要 Durable Object、不需要 migrations、wrangler.jsonc 只有幾行。

**放棄了什麼**：伺服器主動推送（elicitation、sampling、resource 更新通知）在 stateless 下不可用。
目前沒有這種需求。第三階段的占卜日誌會走 D1，用登入身分當 key，同樣不需要 session。

## 2. 隨機性在伺服器端，而且可重現

**選擇**：`draw_cards` 在 server 洗牌。seed 可選；沒給就用 `crypto.getRandomValues` 產生一個，並隨結果回傳。

**為什麼**：
- 模型自己「想」一組牌不是抽牌，是編故事。抽牌必須在模型之外發生。
- seed 讓同一次占卜可以重現：測試可以斷言確切結果、使用者可以事後核對、第三階段存日誌時只要存 seed 與牌陣 id 就能還原整組牌。
- PRNG 用 mulberry32 加 FNV-1a 雜湊，兩個函式加起來二十行，不需要相依套件。它不是密碼學等級的亂數，但塔羅不需要。

## 3. 工具只給資料，不做解讀

**選擇**：沒有 `interpret_reading` 這類工具。`draw_cards` 回關鍵字、`get_card` 回牌義、`get_spread` 回位置意義，把三者合起來說故事是模型的工作。server 的 instructions 明講這一點。

**為什麼**：解讀是語言模型的強項，塞進工具只會變成一段寫死的模板文字，還會搶走模型可以做得更好的部分。
工具該做的是模型做不好的事：真隨機、權威資料、結構化的位置定義。
這條界線也讓 server 的責任很清楚，測試容易寫。

## 4. 控制回傳的 token 量

**選擇**：
- `draw_cards` 每張牌只回名稱、正逆位、該方向的關鍵字、連結；不回長文。
- `get_card` 預設 full，但提供 `detail: "brief"`。
- `list_cards` 只回 slug 與名稱，78 張全列約幾百 token。
- `tarot://cards/{slug}` 這個 template 不提供 list callback，否則資源清單會出現 78 筆。

**為什麼**：工具回傳的每個字都會進入模型的 context。十張牌的凱爾特十字如果每張都帶四段長文，一次呼叫就是幾千 token，而且模型多半只會用到其中幾張的細節。讓模型自己決定要對哪幾張牌 `get_card`。

## 5. 錯誤用 isError 回傳，不丟例外

**選擇**：找不到牌、參數組合不對，都回 `{ isError: true, content: [文字] }`，並盡量附上候選。

**為什麼**：tool result 的錯誤訊息會回到模型手上，它看到「找不到 cup 4，你是不是要找 cups-04」就能自己修正再呼叫一次。
丟例外會變成 JSON-RPC error，很多用戶端直接中斷該輪，模型無法恢復。
資源（resources/read）則相反：URI 不存在就是 JSON-RPC error，那是協定層的語意。

## 6. 工具描述是 prompt 的一部分

**選擇**：每個工具的 `description` 都寫「什麼情況該用、和其他工具怎麼配合、回傳什麼」；`get_spread` 的描述直接列出所有牌陣 id 與張數。
`draw_cards` 的參數描述提示「優先用 spread，這樣每張牌才有位置意義」。

**為什麼**：模型挑工具、填參數，靠的就是這些文字。描述寫得含糊，模型會亂用 `count` 而不用 `spread`，或用 `list_cards` 來找牌義。
這是整個 server 最影響「模型用得好不好」的文字，改動時要用 Claude Code 實際對話驗證。

## 7. 雙語，預設正體中文

**選擇**：所有工具收 `lang: "zh" | "en"`，預設 zh。牌名、關鍵字、牌陣位置與讀法都有雙語；
牌義長文（description、symbolism、history）只有中文，英文模式會附註提醒模型翻譯。

**為什麼**：資料來源本來就是中文站；英文的長文翻譯是內容工作，不是這個專案的範圍。
牌陣的英文位置名沿用塔羅站 i18n；位置意義與抉擇牌陣的英文是本專案自己寫的短句。

## 8. 資料以副本形式同步，不跨 repo 引用

**選擇**：`scripts/sync-data.mjs` 把塔羅站的 `cards.json` 複製過來，副本進版控。牌陣定義是手動整理的 TypeScript。

**為什麼**：兩個 repo 各自獨立部署，跨目錄相對路徑引用會讓 CI 與 clone 都變脆弱。78 張牌的資料很少變動，副本進版控讓這個 repo 自給自足。
牌陣定義沒有從 i18n 直接抄，是因為 MCP 需要的是「位置在問什麼」，那些文字散在文章裡，整理成結構化資料是這個專案該做的加值。

## 9. 倫理界線寫進 instructions 與 prompts

**選擇**：server instructions 與三個 prompt 都寫明：學習與反思用途、不斷言未來、不替不在場的人讀心、不給醫療法律財務指令。

**為什麼**：這是內容站本來的立場（見〈主題牌陣〉對關係牌陣位置 2 的提醒），也是接案時客戶會問的合規細節。放在 server 端，任何用戶端接上都會拿到。

## 10. Host 允許清單要含 localhost

**選擇**：`ALLOWED_HOSTNAMES = ["mcp.tarot.shinder.work", "localhost", "127.0.0.1"]`。

**為什麼**：agents SDK 的 `allowedHostnames` 一旦設定就取代預設值。只填正式網域的話，`wrangler dev` 會被自己擋掉（403 Host not allowed）。
workers.dev 的預覽網址目前不在清單裡，要用預覽時再加。

## 尚未決定

- 第二階段的 `search_cards` 要用 Workers AI 的 embedding 加 Vectorize，還是先用關鍵字比對就夠。牌義只有 78 筆，向量檢索的價值主要在展示，不在效果。
- 第三階段的 OAuth：塔羅站用 better-auth，它有 MCP 外掛可當 OAuth provider；另一條路是 Cloudflare 的 `workers-oauth-provider`。要看哪一條能直接沿用塔羅站的 Google / Apple 登入。
