// 牌義資料層：78 張 RWS 塔羅牌。
// cards.json 由塔羅站（../tarot_shinder_work/src/cards/cards.json）同步而來，
// 用 `pnpm sync-data` 更新；不要直接手改本專案的 cards.json。

import raw from "./cards.json";

export type Lang = "zh" | "en";
export type Arcana = "major" | "minor";
export type Suit = "wands" | "cups" | "swords" | "pentacles";

export interface Card {
  slug: string;
  name: string;
  enName: string;
  arcana: Arcana;
  /** 顯示分組，例如「大阿爾克那」「權杖（火）」 */
  group: string;
  /** 大牌編號 0–21 */
  number?: number;
  suit?: Suit;
  suitCn?: string;
  /** 小牌等級 1–14（11–14 為宮廷牌） */
  rank?: number;
  rankCn?: string;
  element: string;
  /** 星象對應，主要在大牌 */
  astro?: string;
  description: string;
  upright: string[];
  enUpright: string[];
  reversed: string[];
  enReversed: string[];
  /** 畫面的客觀描述 */
  explicit: string;
  symbolism: string;
  history: string;
  image: string;
  thumb: string;
}

/** 塔羅站網址：牌義頁與牌圖都掛在這裡 */
export const SITE_URL = "https://tarot.shinder.work";

export const CARDS: readonly Card[] = raw as Card[];

const SUIT_EN: Record<Suit, string> = {
  wands: "Wands",
  cups: "Cups",
  swords: "Swords",
  pentacles: "Pentacles",
};

const ELEMENT_EN: Record<string, string> = {
  火: "Fire",
  水: "Water",
  風: "Air",
  土: "Earth",
};

/** 正規化查詢字串：去頭尾空白、小寫、去掉英文冠詞 the */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ");
}

/**
 * 依 slug、中文名或英文名找牌。英文名不分大小寫、可省略 "The"。
 * 找不到回傳 undefined，由呼叫端決定要不要給建議。
 */
export function findCard(query: string): Card | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  return (
    CARDS.find((c) => c.slug === q) ??
    CARDS.find((c) => c.name === query.trim()) ??
    CARDS.find((c) => normalize(c.enName) === q)
  );
}

/** 找不到牌時的候選：子字串比對，最多 n 張 */
export function suggestCards(query: string, n = 5): Card[] {
  const q = normalize(query);
  if (!q) return [];
  return CARDS.filter(
    (c) =>
      c.slug.includes(q) ||
      c.name.includes(query.trim()) ||
      normalize(c.enName).includes(q),
  ).slice(0, n);
}

export interface ListFilter {
  arcana?: Arcana;
  suit?: Suit;
}

export function listCards(filter: ListFilter = {}): Card[] {
  return CARDS.filter(
    (c) =>
      (!filter.arcana || c.arcana === filter.arcana) &&
      (!filter.suit || c.suit === filter.suit),
  );
}

/** 精簡摘要：抽牌結果與清單用，控制 token 用量 */
export interface CardSummary {
  slug: string;
  name: string;
  arcana: Arcana;
  suit?: string;
  element: string;
  upright: string[];
  reversed: string[];
  url: string;
}

export function cardSummary(card: Card, lang: Lang): CardSummary {
  const en = lang === "en";
  return {
    slug: card.slug,
    name: en ? card.enName : card.name,
    arcana: card.arcana,
    suit: card.suit ? (en ? SUIT_EN[card.suit] : card.suitCn) : undefined,
    element: en ? (ELEMENT_EN[card.element] ?? card.element) : card.element,
    upright: en ? card.enUpright : card.upright,
    reversed: en ? card.enReversed : card.reversed,
    url: `${SITE_URL}/cards/${card.slug}`,
  };
}

/** 完整資料：get_card 用。長文（description、symbolism、history）目前只有正體中文。 */
export interface CardDetail extends CardSummary {
  altName: string;
  number?: number;
  rank?: number;
  astro?: string;
  description: string;
  scene: string;
  symbolism: string;
  history: string;
  image: string;
  /** 英文模式下提醒：長文欄位為中文 */
  note?: string;
}

export function cardDetail(card: Card, lang: Lang): CardDetail {
  const en = lang === "en";
  return {
    ...cardSummary(card, lang),
    altName: en ? card.name : card.enName,
    number: card.number,
    rank: card.rank,
    astro: card.astro,
    description: card.description,
    scene: card.explicit,
    symbolism: card.symbolism,
    history: card.history,
    image: `${SITE_URL}${card.image}`,
    note: en
      ? "description, scene, symbolism and history are in Traditional Chinese; translate for the user as needed."
      : undefined,
  };
}
