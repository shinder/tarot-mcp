import { describe, expect, it } from "vitest";
import { CARDS } from "../data/cards";
import { drawCards, MAX_DRAW } from "./draw";
import { hashSeed, mulberry32, shuffle } from "./rng";

describe("亂數與洗牌", () => {
  it("同一個 seed 產生同一串亂數", () => {
    const a = mulberry32(hashSeed("abc"));
    const b = mulberry32(hashSeed("abc"));
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("洗牌不動原陣列、不掉牌", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, mulberry32(1));
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("抽牌", () => {
  it("同一個 seed 抽出同一組牌與正逆位", () => {
    const a = drawCards({ count: 10, allowReversed: true, seed: "test" });
    const b = drawCards({ count: 10, allowReversed: true, seed: "test" });
    expect(a.cards.map((c) => [c.card.slug, c.reversed])).toEqual(
      b.cards.map((c) => [c.card.slug, c.reversed]),
    );
  });

  it("沒給 seed 會產生一個並回傳，且可用它重現", () => {
    const first = drawCards({ count: 3, allowReversed: true });
    expect(first.seed.length).toBeGreaterThan(0);
    const again = drawCards({ count: 3, allowReversed: true, seed: first.seed });
    expect(again.cards.map((c) => c.card.slug)).toEqual(first.cards.map((c) => c.card.slug));
  });

  it("不重複抽到同一張牌", () => {
    const r = drawCards({ count: MAX_DRAW, allowReversed: true, seed: "unique" });
    expect(new Set(r.cards.map((c) => c.card.slug)).size).toBe(MAX_DRAW);
  });

  it("不允許逆位時全部正位", () => {
    const r = drawCards({ count: 10, allowReversed: false, seed: "upright" });
    expect(r.cards.every((c) => !c.reversed)).toBe(true);
  });

  it("張數夾在 1 到 MAX_DRAW 之間", () => {
    expect(drawCards({ count: 0, allowReversed: true, seed: "x" }).cards.length).toBe(1);
    expect(drawCards({ count: 99, allowReversed: true, seed: "x" }).cards.length).toBe(MAX_DRAW);
  });

  it("牌組共 78 張", () => {
    expect(CARDS.length).toBe(78);
  });
});
