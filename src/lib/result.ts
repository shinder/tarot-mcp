// 工具回傳的小工具：文字 + 結構化內容，或錯誤。
// 錯誤一律用 isError 回給模型，讓它能看到訊息後自行修正再呼叫，
// 不要丟例外（例外會變成 JSON-RPC error，模型通常無法從中恢復）。

import type { Lang } from "../data/cards";

export interface ToolText {
  type: "text";
  text: string;
}

export function ok<T extends Record<string, unknown>>(text: string, structured: T) {
  return {
    content: [{ type: "text", text } satisfies ToolText],
    structuredContent: structured,
  };
}

export function fail(text: string) {
  return {
    content: [{ type: "text", text } satisfies ToolText],
    isError: true as const,
  };
}

/** 依語言挑字串 */
export function t(lang: Lang, zh: string, en: string): string {
  return lang === "en" ? en : zh;
}

/** 依語言決定列表分隔符：中文用頓號，英文用逗號 */
export function joinList(lang: Lang, items: string[]): string {
  return items.join(lang === "en" ? ", " : "、");
}
