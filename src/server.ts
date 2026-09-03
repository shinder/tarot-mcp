// MCP server 工廠：每個 request 建一個新的 McpServer（stateless），
// 由 createMcpHandler 呼叫。所有 tools / resources / prompts 在這裡集中註冊。

import { McpServer } from "@modelcontextprotocol/server";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerDrawCards } from "./tools/draw-cards";
import { registerGetCard } from "./tools/get-card";
import { registerGetSpread } from "./tools/get-spread";
import { registerListCards } from "./tools/list-cards";

export const SERVER_NAME = "tarot-mcp";
export const SERVER_VERSION = "0.1.0";

/** 給用戶端與模型看的使用說明：定位、工具分工、倫理界線 */
const INSTRUCTIONS = [
  "Tarot reference server for the Rider-Waite-Smith deck (78 cards), backed by tarot.shinder.work.",
  "Tools return reference data only: draw_cards shuffles and draws on the server; get_card, get_spread and list_cards look up meanings and spreads.",
  "Interpretation is the model's job. Ground every meaning in tool results rather than memory, and combine card keywords with the position meaning from the spread.",
  "This is a learning and reflection aid, not prediction. Do not assert the future, read absent people's minds, or give medical, legal or financial directives.",
  "Default language is Traditional Chinese (lang: zh); pass lang: en for English names and keywords. Long-form card text is Chinese only.",
].join(" ");

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
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
