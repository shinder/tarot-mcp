// list_cards：精簡清單。有些用戶端不支援 resources，所以也做成 tool。
// 只回 slug 與名稱，78 張全列也只有幾百個 token。

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listCards, type Lang } from "../data/cards";
import { ok, t } from "../lib/result";

const InputSchema = z.object({
  arcana: z.enum(["major", "minor"]).optional().describe("Filter: major (22) or minor (56)."),
  suit: z.enum(["wands", "cups", "swords", "pentacles"]).optional().describe("Filter minor arcana by suit."),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const OutputSchema = z.object({
  count: z.number(),
  cards: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      enName: z.string(),
      arcana: z.string(),
      suit: z.string().optional(),
    }),
  ),
});

export function registerListCards(server: McpServer) {
  server.registerTool(
    "list_cards",
    {
      title: "List tarot cards",
      description:
        "List the 78 cards (slug, Chinese and English name), optionally filtered by arcana or suit. " +
        "Use it to find a slug for get_card, or to answer questions like \"which cards are in the suit of Cups\".",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const lang: Lang = input.lang;
      const cards = listCards({ arcana: input.arcana, suit: input.suit }).map((c) => ({
        slug: c.slug,
        name: c.name,
        enName: c.enName,
        arcana: c.arcana,
        suit: c.suit,
      }));
      const lines = [
        t(lang, `共 ${cards.length} 張`, `${cards.length} cards`),
        ...cards.map((c) => `${c.slug}: ${lang === "en" ? `${c.enName} (${c.name})` : `${c.name}（${c.enName}）`}`),
      ];
      return ok(lines.join("\n"), { count: cards.length, cards });
    },
  );
}
