// 抽牌邏輯：純函式，不碰協定，方便單元測試。

import { CARDS, type Card } from "../data/cards";
import { hashSeed, mulberry32, randomSeed, shuffle } from "./rng";

export interface DrawOptions {
  count: number;
  /** 是否允許逆位；允許時每張各 50% 機率 */
  allowReversed: boolean;
  /** 給定即可重現；不給則隨機產生並回傳 */
  seed?: string;
}

export interface DrawnCard {
  card: Card;
  reversed: boolean;
}

export interface DrawResult {
  seed: string;
  cards: DrawnCard[];
}

export const MAX_DRAW = 10;

export function drawCards(opts: DrawOptions, deck: readonly Card[] = CARDS): DrawResult {
  const count = Math.max(1, Math.min(MAX_DRAW, Math.floor(opts.count)));
  const seed = opts.seed?.trim() || randomSeed();
  const rand = mulberry32(hashSeed(seed));
  const shuffled = shuffle(deck, rand);
  const cards = shuffled.slice(0, count).map((card) => ({
    card,
    reversed: opts.allowReversed ? rand() < 0.5 : false,
  }));
  return { seed, cards };
}
