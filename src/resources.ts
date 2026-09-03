// Resources：唯讀資料，讓支援的用戶端直接載入，不經過工具呼叫。
// 索引只回精簡欄位；單張牌與單一牌陣用 URI template 取完整資料。
// 單張牌的 template 不提供 list（否則資源清單會出現 78 筆），改用 tarot://cards 索引。

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { CARDS, cardDetail, findCard } from "./data/cards";
import { getSpread, localizeSpread, SPREADS } from "./data/spreads";

const JSON_MIME = "application/json";

function json(uri: URL, data: unknown) {
  return {
    contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerResources(server: McpServer) {
  server.registerResource(
    "cards",
    "tarot://cards",
    {
      title: "Card index",
      description: "All 78 Rider-Waite-Smith cards: slug, names, arcana, suit. Read tarot://cards/{slug} for one card's full data.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      json(
        uri,
        CARDS.map((c) => ({ slug: c.slug, name: c.name, enName: c.enName, arcana: c.arcana, suit: c.suit })),
      ),
  );

  server.registerResource(
    "card",
    new ResourceTemplate("tarot://cards/{slug}", {
      list: undefined,
      complete: {
        slug: (value: string) => CARDS.map((c) => c.slug).filter((s) => s.startsWith(value)),
      },
    }),
    {
      title: "Card detail",
      description: "Full data for one card (Traditional Chinese long-form text with English names and keywords).",
      mimeType: JSON_MIME,
    },
    async (uri, variables) => {
      const slug = String(variables.slug ?? "");
      const card = findCard(slug);
      if (!card) {
        throw new Error(`Unknown card slug: ${slug}`);
      }
      return json(uri, { zh: cardDetail(card, "zh"), en: cardDetail(card, "en") });
    },
  );

  server.registerResource(
    "spreads",
    "tarot://spreads",
    {
      title: "Spread index",
      description: "Available spreads with id, name and card count. Read tarot://spreads/{id} for positions.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      json(
        uri,
        Object.values(SPREADS).map((s) => ({
          id: s.id,
          name: s.name,
          cardCount: s.cardCount,
          use: s.use,
        })),
      ),
  );

  server.registerResource(
    "spread",
    new ResourceTemplate("tarot://spreads/{id}", {
      list: undefined,
      complete: {
        id: (value: string) => Object.keys(SPREADS).filter((s) => s.startsWith(value)),
      },
    }),
    {
      title: "Spread detail",
      description: "Positions, meanings, question, hints and reading order for one spread, in zh and en.",
      mimeType: JSON_MIME,
    },
    async (uri, variables) => {
      const id = String(variables.id ?? "");
      const spread = getSpread(id);
      if (!spread) {
        throw new Error(`Unknown spread id: ${id}`);
      }
      return json(uri, { zh: localizeSpread(spread, "zh"), en: localizeSpread(spread, "en") });
    },
  );
}
