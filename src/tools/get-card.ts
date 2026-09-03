// get_card：單張牌的權威資料。給模型解牌用，避免它靠記憶亂講。

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { cardDetail, cardSummary, findCard, suggestCards, type Lang } from "../data/cards";
import { fail, joinList, ok, t } from "../lib/result";

const InputSchema = z.object({
  card: z
    .string()
    .min(1)
    .describe('Card slug (e.g. "00-fool", "cups-04"), Chinese name (e.g. "愚者") or English name (e.g. "The Fool", "Four of Cups").'),
  detail: z
    .enum(["brief", "full"])
    .default("full")
    .describe("brief: names, element and keywords only. full (default): adds description, scene, symbolism and history."),
  lang: z.enum(["zh", "en"]).default("zh").describe("zh (default) or en. Long-form text is Traditional Chinese in both modes."),
});

const OutputSchema = z.object({
  slug: z.string(),
  name: z.string(),
  altName: z.string().optional(),
  arcana: z.string(),
  suit: z.string().optional(),
  number: z.number().optional(),
  rank: z.number().optional(),
  element: z.string(),
  astro: z.string().optional(),
  upright: z.array(z.string()),
  reversed: z.array(z.string()),
  description: z.string().optional(),
  scene: z.string().optional(),
  symbolism: z.string().optional(),
  history: z.string().optional(),
  image: z.string().optional(),
  url: z.string(),
  note: z.string().optional(),
});

export function registerGetCard(server: McpServer) {
  server.registerTool(
    "get_card",
    {
      title: "Get a tarot card's meaning",
      description:
        "Look up one of the 78 Rider-Waite-Smith cards by slug, Chinese name or English name. " +
        "Returns upright and reversed keywords, element, astrological correspondence, and (with detail=full) " +
        "the card description, scene, symbolism and history. Use this before interpreting any card so the meaning is grounded in the reference, not memory.",
      inputSchema: InputSchema,
      outputSchema: OutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const lang: Lang = input.lang;
      const card = findCard(input.card);
      if (!card) {
        const hints = suggestCards(input.card).map((c) => `${c.slug}（${c.name} / ${c.enName}）`);
        const sug = hints.length
          ? t(lang, `你是不是要找：${hints.join("、")}`, `Did you mean: ${hints.join(", ")}`)
          : t(lang, "可用 list_cards 查看全部 78 張牌的 slug。", "Use list_cards to see all 78 slugs.");
        return fail(t(lang, `找不到牌「${input.card}」。${sug}`, `Card "${input.card}" not found. ${sug}`));
      }

      if (input.detail === "brief") {
        const s = cardSummary(card, lang);
        const text = [
          `${s.name}（${lang === "en" ? card.name : card.enName}）`,
          t(lang, `元素：${s.element}${card.astro ? `；星象：${card.astro}` : ""}`, `Element: ${s.element}${card.astro ? `; astro: ${card.astro}` : ""}`),
          t(lang, `正位：${joinList(lang, s.upright)}`, `Upright: ${joinList(lang, s.upright)}`),
          t(lang, `逆位：${joinList(lang, s.reversed)}`, `Reversed: ${joinList(lang, s.reversed)}`),
          s.url,
        ].join("\n");
        return ok(text, { ...s, altName: lang === "en" ? card.name : card.enName, astro: card.astro });
      }

      const d = cardDetail(card, lang);
      const text = [
        `${d.name}（${d.altName}）`,
        t(lang, `元素：${d.element}${d.astro ? `；星象：${d.astro}` : ""}`, `Element: ${d.element}${d.astro ? `; astro: ${d.astro}` : ""}`),
        t(lang, `正位：${joinList(lang, d.upright)}`, `Upright: ${joinList(lang, d.upright)}`),
        t(lang, `逆位：${joinList(lang, d.reversed)}`, `Reversed: ${joinList(lang, d.reversed)}`),
        "",
        t(lang, `牌義：${d.description}`, `Meaning (zh): ${d.description}`),
        t(lang, `畫面：${d.scene}`, `Scene (zh): ${d.scene}`),
        t(lang, `象徵：${d.symbolism}`, `Symbolism (zh): ${d.symbolism}`),
        t(lang, `歷史：${d.history}`, `History (zh): ${d.history}`),
        "",
        `${d.url}`,
      ].join("\n");
      return ok(text, { ...d });
    },
  );
}
