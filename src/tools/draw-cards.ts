// draw_cards：伺服器端抽牌。
// 隨機性放在 server，模型不能自己「編」抽牌結果；seed 讓結果可重現。

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { cardSummary, type Lang } from "../data/cards";
import { getSpread, localizeSpread, SPREAD_IDS } from "../data/spreads";
import { drawCards, MAX_DRAW } from "../lib/draw";
import { fail, joinList, ok, t } from "../lib/result";

const LangSchema = z.enum(["zh", "en"]).default("zh");

const InputSchema = z.object({
  spread: z
    .enum(SPREAD_IDS)
    .optional()
    .describe(
      "Spread id. Use get_spread or the tarot://spreads resource to see positions. " +
        "Ids: daily (1), time / action / review (3), relation / self (5), decision (6), celtic (10). " +
        "If omitted, `count` cards are drawn without position meanings.",
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(MAX_DRAW)
    .optional()
    .describe(`Number of cards when no spread is given (1-${MAX_DRAW}). Ignored when spread is set.`),
  allowReversed: z
    .boolean()
    .default(true)
    .describe("Allow reversed cards (50% chance each). Default true."),
  seed: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe("Optional seed. The same seed always reproduces the same draw. Omit for a fresh random draw; the seed used is returned."),
  lang: LangSchema.describe("Language of names and keywords: zh (Traditional Chinese, default) or en."),
});

const DrawnCardSchema = z.object({
  position: z.object({
    index: z.number(),
    name: z.string(),
    meaning: z.string().optional(),
  }),
  slug: z.string(),
  name: z.string(),
  reversed: z.boolean(),
  arcana: z.string(),
  suit: z.string().optional(),
  element: z.string(),
  keywords: z.array(z.string()).describe("Keywords for the drawn orientation"),
  url: z.string(),
});

const OutputSchema = z.object({
  seed: z.string(),
  spread: z
    .object({
      id: z.string(),
      name: z.string(),
      question: z.string(),
      hint: z.string(),
    })
    .optional(),
  cards: z.array(DrawnCardSchema),
});

export function registerDrawCards(server: McpServer) {
  server.registerTool(
    "draw_cards",
    {
      title: "Draw tarot cards",
      description:
        "Shuffle a 78-card Rider-Waite-Smith deck and draw cards on the server. " +
        "Prefer a `spread` so each card comes with its position meaning; otherwise give `count`. " +
        "Returns names, orientation and keywords per card. Call get_card for the full meaning of any card. " +
        "The result is for learning and reflection, not prediction; interpretation is your job, not the tool's.",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const lang: Lang = input.lang;
      const spread = input.spread ? getSpread(input.spread) : undefined;
      if (input.spread && !spread) {
        return fail(t(lang, `找不到牌陣「${input.spread}」。`, `Unknown spread "${input.spread}".`));
      }
      if (!spread && !input.count) {
        return fail(
          t(lang, "請指定 spread 或 count 其中之一。", "Provide either `spread` or `count`."),
        );
      }

      const count = spread ? spread.cardCount : input.count!;
      const result = drawCards({ count, allowReversed: input.allowReversed, seed: input.seed });
      const local = spread ? localizeSpread(spread, lang) : undefined;

      const cards = result.cards.map((d, i) => {
        const s = cardSummary(d.card, lang);
        const pos = local?.positions[i];
        return {
          position: pos
            ? { index: pos.index, name: pos.name, meaning: pos.meaning }
            : { index: i + 1, name: t(lang, `第 ${i + 1} 張`, `Card ${i + 1}`) },
          slug: s.slug,
          name: s.name,
          reversed: d.reversed,
          arcana: s.arcana,
          suit: s.suit,
          element: s.element,
          keywords: d.reversed ? s.reversed : s.upright,
          url: s.url,
        };
      });

      const lines: string[] = [];
      if (local) {
        lines.push(t(lang, `牌陣：${local.name}`, `Spread: ${local.name}`));
        lines.push(t(lang, `問題引導：${local.question}`, `Question: ${local.question}`));
      } else {
        lines.push(t(lang, `抽 ${count} 張牌`, `Drew ${count} card(s)`));
      }
      lines.push(`seed: ${result.seed}`);
      lines.push("");
      for (const c of cards) {
        const orient = c.reversed ? t(lang, "逆位", "reversed") : t(lang, "正位", "upright");
        const label = c.position.meaning
          ? `${c.position.index}. ${c.position.name}（${c.position.meaning}）`
          : `${c.position.index}. ${c.position.name}`;
        lines.push(
          lang === "en"
            ? `${c.position.index}. ${c.position.name}${c.position.meaning ? ` (${c.position.meaning})` : ""}: ${c.name} (${orient}): ${joinList(lang, c.keywords)}`
            : `${label}：${c.name}（${orient}）：${joinList(lang, c.keywords)}`,
        );
      }
      if (local?.hint) {
        lines.push("");
        lines.push(t(lang, `讀法提示：${local.hint}`, `Reading hint: ${local.hint}`));
      }

      return ok(lines.join("\n"), {
        seed: result.seed,
        spread: local
          ? { id: local.id, name: local.name, question: local.question, hint: local.hint }
          : undefined,
        cards,
      });
    },
  );
}
