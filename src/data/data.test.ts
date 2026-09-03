import { describe, expect, it } from "vitest";
import { CARDS, cardDetail, cardSummary, findCard, listCards, suggestCards } from "./cards";
import { getSpread, localizeSpread, SPREADS } from "./spreads";

describe("牌義資料", () => {
  it("78 張：22 大牌、56 小牌，slug 不重複", () => {
    expect(CARDS.length).toBe(78);
    expect(listCards({ arcana: "major" }).length).toBe(22);
    expect(listCards({ arcana: "minor" }).length).toBe(56);
    expect(listCards({ suit: "cups" }).length).toBe(14);
    expect(new Set(CARDS.map((c) => c.slug)).size).toBe(78);
  });

  it("slug、中文名、英文名（可省 The、不分大小寫）都找得到", () => {
    expect(findCard("00-fool")?.slug).toBe("00-fool");
    expect(findCard("愚者")?.slug).toBe("00-fool");
    expect(findCard("The Fool")?.slug).toBe("00-fool");
    expect(findCard("fool")?.slug).toBe("00-fool");
    expect(findCard("four of cups")?.slug).toBe("cups-04");
    expect(findCard("不存在")).toBeUndefined();
  });

  it("找不到時給候選", () => {
    const s = suggestCards("cups");
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((c) => c.suit === "cups")).toBe(true);
  });

  it("英文摘要用英文名與英文關鍵字", () => {
    const fool = findCard("00-fool")!;
    const en = cardSummary(fool, "en");
    expect(en.name).toBe("The Fool");
    expect(en.upright).toEqual(fool.enUpright);
    expect(en.url).toBe("https://tarot.shinder.work/cards/00-fool");
    const zh = cardSummary(fool, "zh");
    expect(zh.name).toBe("愚者");
  });

  it("完整資料含絕對圖片網址，英文模式附註長文為中文", () => {
    const d = cardDetail(findCard("cups-04")!, "en");
    expect(d.image).toMatch(/^https:\/\/tarot\.shinder\.work\/cards\//);
    expect(d.note).toBeTruthy();
    expect(cardDetail(findCard("cups-04")!, "zh").note).toBeUndefined();
  });
});

describe("牌陣資料", () => {
  it("每個牌陣的位置數與 cardCount 一致，且兩種語言都有", () => {
    for (const s of Object.values(SPREADS)) {
      expect(s.positions.length).toBe(s.cardCount);
      s.positions.forEach((p, i) => {
        expect(p.index).toBe(i + 1);
        expect(p.name.zh).toBeTruthy();
        expect(p.name.en).toBeTruthy();
        expect(p.meaning.zh).toBeTruthy();
        expect(p.meaning.en).toBeTruthy();
      });
    }
  });

  it("凱爾特十字有十步以內的解讀順序，位置編號在範圍內", () => {
    const celtic = getSpread("celtic")!;
    expect(celtic.readingOrder?.length).toBeGreaterThan(0);
    for (const step of celtic.readingOrder!) {
      for (const p of step.positions) expect(p).toBeGreaterThanOrEqual(1), expect(p).toBeLessThanOrEqual(10);
    }
  });

  it("本地化輸出只剩單一語言", () => {
    const en = localizeSpread(getSpread("relation")!, "en");
    expect(en.positions[0].name).toBe("You");
    expect(typeof en.question).toBe("string");
  });
});
