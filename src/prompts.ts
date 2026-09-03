// Prompts：預先寫好的對話範本。用戶端（例如 Claude Desktop）會列成可選指令，
// 使用者選了之後，這段文字就變成使用者訊息送給模型。
// 範本只安排「先呼叫哪些工具、用什麼態度解讀」，不塞牌義本身。

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Lang } from "./data/cards";

const LangSchema = z.enum(["zh", "en"]).default("zh");

function userMessage(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

const ETHOS: Record<Lang, string> = {
  zh: "態度：塔羅在這裡是學習與自我反思的工具，不是預測。不要斷言未來、不要替不在場的人讀心、不要給醫療、法律或財務指令。牌義一律以工具回傳的資料為準。",
  en: "Stance: tarot here is a tool for learning and reflection, not prediction. Do not assert the future, do not read absent people's minds, and give no medical, legal or financial directives. Ground every meaning in the tool results.",
};

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "daily_card",
    {
      title: "Daily card",
      description: "Draw one card for today and teach it from a learner's point of view.",
      argsSchema: z.object({ lang: LangSchema }),
    },
    async ({ lang }) =>
      userMessage(
        lang === "en"
          ? [
              "Draw today's card with draw_cards (spread: daily, lang: en), then call get_card for it.",
              "Describe the image first in two or three plain sentences, then give the keywords for its orientation, then one concrete thing to notice during the day.",
              "Keep it under 150 words. End with one question for me to check back on tonight.",
              ETHOS.en,
            ].join("\n")
          : [
              "用 draw_cards 抽今日一牌（spread: daily，lang: zh），再用 get_card 取得這張牌的資料。",
              "先用兩三句白話描述牌面，再說這個正逆位的關鍵字，最後給一件今天可以留意的具體事情。",
              "全文控制在 150 字以內。結尾留一個問題，讓我晚上回來對照。",
              ETHOS.zh,
            ].join("\n"),
      ),
  );

  server.registerPrompt(
    "three_card_reading",
    {
      title: "Three-card reading",
      description: "A guided three-card reading on a question the user provides.",
      argsSchema: z.object({
        question: z.string().min(1).describe("The question the user holds while shuffling."),
        spread: z.enum(["time", "action", "review"]).default("time").describe("time: past/present/future; action: situation/action/outcome; review: keep/release/learn."),
        lang: LangSchema,
      }),
    },
    async ({ question, spread, lang }) =>
      userMessage(
        lang === "en"
          ? [
              `My question: ${question}`,
              `Call get_spread (spread: ${spread}, lang: en) to load the positions, then draw_cards with the same spread, then get_card (detail: full) for each drawn card.`,
              "Read each card in its position first, one short paragraph each, combining the position meaning with the card's keywords and symbolism.",
              "Then tell the three cards as one story: how the first leads into the second, and the second shapes the third.",
              "Finish with one sentence on what this reading most wants to say, and one reflective question back to me.",
              ETHOS.en,
            ].join("\n")
          : [
              `我的問題：${question}`,
              `先用 get_spread（spread: ${spread}，lang: zh）載入位置意義，再用 draw_cards 以同一個牌陣抽牌，接著對每張牌呼叫 get_card（detail: full）。`,
              "先逐張讀：每張一小段，把位置意義和牌的關鍵字、象徵合起來講。",
              "再把三張串成一段故事：第一張如何導向第二張、第二張又如何影響第三張。",
              "最後用一句話說出這次占卜最想告訴我的重點，並回問我一個反思的問題。",
              ETHOS.zh,
            ].join("\n"),
      ),
  );

  server.registerPrompt(
    "learn_card",
    {
      title: "Learn a card",
      description: "Teach one card: image, upright and reversed meanings, common misreadings.",
      argsSchema: z.object({
        card: z.string().min(1).describe("Card slug, Chinese name or English name."),
        lang: LangSchema,
      }),
    },
    async ({ card, lang }) =>
      userMessage(
        lang === "en"
          ? [
              `Teach me the card "${card}". Call get_card (detail: full, lang: en) first.`,
              "Structure: 1) what the image shows and two or three key symbols; 2) upright meaning in everyday situations; 3) reversed meaning, stressing it is a shift in degree or direction, not simply the opposite; 4) one common misreading and how to avoid it; 5) a one-line memory hook.",
              "Translate the Chinese long-form fields for me where useful. Keep it under 300 words.",
              ETHOS.en,
            ].join("\n")
          : [
              `請教我「${card}」這張牌。先呼叫 get_card（detail: full，lang: zh）。`,
              "結構：1) 牌面畫了什麼、兩三個關鍵象徵；2) 正位在日常情境中的意思；3) 逆位的意思，強調它是程度或方向的變化，不只是相反；4) 一個常見誤讀與避免方法；5) 一句好記的記憶口訣。",
              "全文控制在 300 字以內。",
              ETHOS.zh,
            ].join("\n"),
      ),
  );
}
