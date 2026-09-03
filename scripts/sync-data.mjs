// 從塔羅站 repo 同步牌義資料到本專案。
// 單一資料來源在 tarot_shinder_work/src/cards/cards.json；這裡的副本不要手改。
//
//   pnpm sync-data                      # 預設從 ../tarot_shinder_work 讀
//   TAROT_SRC=/path/to/repo pnpm sync-data

import { copyFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const srcRepo = process.env.TAROT_SRC ?? resolve(root, "..", "tarot_shinder_work");

const from = resolve(srcRepo, "src/cards/cards.json");
const to = resolve(root, "src/data/cards.json");

const cards = JSON.parse(readFileSync(from, "utf8"));
if (!Array.isArray(cards) || cards.length !== 78) {
  console.error(`來源資料不正確：${from}（預期 78 張，實際 ${cards?.length}）`);
  process.exit(1);
}

copyFileSync(from, to);
console.log(`已同步 ${cards.length} 張牌：${from} -> ${to}`);
