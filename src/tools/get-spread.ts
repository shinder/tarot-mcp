// get_spread：牌陣的位置意義與讀法。解牌要把「牌義」和「位置意義」合起來看。

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Lang } from "../data/cards";
import { getSpread, listSpreads, localizeSpread, SPREAD_IDS } from "../data/spreads";
import { fail, ok, t } from "../lib/result";

const InputSchema = z.object({
  spread: z.enum(SPREAD_IDS).describe("Spread id: daily, time, action, review, relation, self, decision, celtic."),
  lang: z.enum(["zh", "en"]).default("zh"),
});

const OutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  cardCount: z.number(),
  use: z.string(),
  question: z.string(),
  hint: z.string(),
  positions: z.array(z.object({ index: z.number(), name: z.string(), meaning: z.string() })),
  readingOrder: z
    .array(z.object({ title: z.string(), text: z.string(), positions: z.array(z.number()) }))
    .optional(),
  article: z.string().optional(),
});

export function registerGetSpread(server: McpServer) {
  server.registerTool(
    "get_spread",
    {
      title: "Get a spread's positions and reading guide",
      description:
        "Describe a tarot spread: what it is for, the question to hold while shuffling, each position's meaning, " +
        "reading hints, and for the Celtic Cross a step-by-step reading order. " +
        "Use it to plan a reading before draw_cards, or to explain a spread to a learner. " +
        "Available ids: " +
        listSpreads("en").map((s) => `${s.id} (${s.cardCount})`).join(", ") + ".",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const lang: Lang = input.lang;
      const spread = getSpread(input.spread);
      if (!spread) {
        return fail(t(lang, `找不到牌陣「${input.spread}」。`, `Unknown spread "${input.spread}".`));
      }
      const s = localizeSpread(spread, lang);
      const lines = [
        `${s.name}`,
        t(lang, `適用：${s.use}`, `Use: ${s.use}`),
        t(lang, `洗牌前：${s.question}`, `Before shuffling: ${s.question}`),
        "",
        ...s.positions.map((p) =>
          lang === "en" ? `${p.index}. ${p.name}: ${p.meaning}` : `${p.index}. ${p.name}：${p.meaning}`,
        ),
        "",
        t(lang, `讀法提示：${s.hint}`, `Reading hint: ${s.hint}`),
      ];
      if (s.readingOrder) {
        lines.push("", t(lang, "建議解讀順序：", "Suggested reading order:"));
        s.readingOrder.forEach((step, i) => {
          lines.push(
            lang === "en"
              ? `${i + 1}. ${step.title} (positions ${step.positions.join(", ")}): ${step.text}`
              : `${i + 1}. ${step.title}（位置 ${step.positions.join("、")}）：${step.text}`,
          );
        });
      }
      if (s.article) lines.push("", s.article);
      return ok(lines.join("\n"), s);
    },
  );
}
