// 牌陣定義：位置名稱與「這個位置在問什麼」。
// 來源是塔羅站的抽牌工具（src/i18n/zh.ts、en.ts 的 spreads）
// 與兩篇文章〈凱爾特十字詳解〉〈主題牌陣〉。
// 抉擇牌陣（decision）只在文章裡有、抽牌工具沒有，這裡一併收進來。

import type { Lang } from "./cards";

export type Localized = Record<Lang, string>;

export interface SpreadPosition {
  /** 1 起算的位置編號 */
  index: number;
  name: Localized;
  /** 這個位置在問什麼 */
  meaning: Localized;
}

export interface ReadingStep {
  title: Localized;
  text: Localized;
  /** 這一步要看哪幾個位置（1 起算） */
  positions: number[];
}

export interface Spread {
  id: string;
  name: Localized;
  cardCount: number;
  /** 適用情境 */
  use: Localized;
  positions: SpreadPosition[];
  /** 洗牌前給問卜者的提問引導 */
  question: Localized;
  /** 讀法提示 */
  hint: Localized;
  /** 建議的解讀順序（目前只有凱爾特十字） */
  readingOrder?: ReadingStep[];
  /** 對應的教學文章 */
  article?: string;
}

const L = (zh: string, en: string): Localized => ({ zh, en });

const ARTICLE = "https://tarot.shinder.work/learn";

export const SPREADS: Record<string, Spread> = {
  daily: {
    id: "daily",
    name: L("每日一牌", "Daily card"),
    cardCount: 1,
    use: L(
      "每天一張，練習用自己的話描述牌面，晚上回頭對照。",
      "One card a day: describe the image in your own words, then check back in the evening.",
    ),
    positions: [
      {
        index: 1,
        name: L("今日一牌", "Today's card"),
        meaning: L("今天適合把注意力放在哪裡", "Where attention is best placed today"),
      },
    ],
    question: L("今天我適合把注意力放在哪裡？", "Where is my attention best placed today?"),
    hint: L(
      "先看圖說一句話，晚上回來對照：這張牌今天在哪裡出現過？同一天別重抽。",
      "Say one sentence about the image now, then check back tonight: where did this card show up in your day? Do not redraw the same day.",
    ),
    article: `${ARTICLE}/daily-practice`,
  },
  time: {
    id: "time",
    name: L("三張牌：過去、現在、未來", "Three cards: past, present, future"),
    cardCount: 3,
    use: L("看一件事的來龍去脈。", "How a situation came about and where it is heading."),
    positions: [
      { index: 1, name: L("過去", "Past"), meaning: L("已發生、仍在影響現在的因素", "What has happened and still shapes the present") },
      { index: 2, name: L("現在", "Present"), meaning: L("此刻的核心狀態", "The core of the situation right now") },
      { index: 3, name: L("未來", "Future"), meaning: L("照目前走向的下一步", "The next step along the current trajectory") },
    ],
    question: L(
      "洗牌前，心裡先想好一個問題：這件事的來龍去脈是什麼？",
      "Before you shuffle, settle on a question: how did this situation come about?",
    ),
    hint: L(
      "先各自讀出三張的意思，再串成一段故事：第一張如何導向第二張、第二張又如何影響第三張。",
      "Take each card on its own first, then string them into one story: how does the first lead into the second, and the second shape the third?",
    ),
    article: `${ARTICLE}/how-to-read`,
  },
  action: {
    id: "action",
    name: L("三張牌：情況、行動、結果", "Three cards: situation, action, outcome"),
    cardCount: 3,
    use: L("面對一個處境，想知道能做什麼。", "Facing a situation and wanting to know what can be done."),
    positions: [
      { index: 1, name: L("情況", "Situation"), meaning: L("我正面對什麼", "What I am facing") },
      { index: 2, name: L("行動", "Action"), meaning: L("我能做什麼", "What I can do") },
      { index: 3, name: L("結果", "Outcome"), meaning: L("這樣做會走向哪裡", "Where that leads") },
    ],
    question: L(
      "洗牌前，心裡先想好一個問題：我面對什麼、能做什麼、會走向哪裡？",
      "Before you shuffle, settle on a question: what am I facing, what can I do, where does it lead?",
    ),
    hint: L(
      "位置 2 是這個牌陣的重點：它給的是可以採取的姿態，不是命令。",
      "Position 2 is the heart of this spread: it offers a stance to take, not an order.",
    ),
    article: `${ARTICLE}/how-to-read`,
  },
  review: {
    id: "review",
    name: L("三張牌：該保留、該放下、該學習", "Three cards: keep, release, learn"),
    cardCount: 3,
    use: L("回顧一個階段。", "Looking back on a chapter."),
    positions: [
      { index: 1, name: L("該保留", "Keep"), meaning: L("這個階段值得帶走的", "What from this chapter is worth carrying forward") },
      { index: 2, name: L("該放下", "Release"), meaning: L("該留在這個階段的", "What should stay behind") },
      { index: 3, name: L("該學習", "Learn"), meaning: L("它教會我的功課", "The lesson it taught") },
    ],
    question: L(
      "洗牌前，想一個想回顧的階段：它留給我什麼？",
      "Before you shuffle, think of a chapter you want to look back on: what did it leave you with?",
    ),
    hint: L(
      "適合年末、生日、一段關係或工作結束時使用。",
      "Suits year's end, birthdays, or the close of a relationship or a job.",
    ),
    article: `${ARTICLE}/how-to-read`,
  },
  relation: {
    id: "relation",
    name: L("關係牌陣（五張）", "Relationship spread (five cards)"),
    cardCount: 5,
    use: L(
      "感情、友誼、家人、合作關係，任何「我和某人之間」的疑問。",
      "Romance, friendship, family, collaboration: any question about \"me and someone\".",
    ),
    positions: [
      { index: 1, name: L("我的位置", "You"), meaning: L("我在這段關係裡的狀態與姿態", "My state and stance within the relationship") },
      { index: 2, name: L("對方的位置", "The other person"), meaning: L("對方在關係中呈現的樣子，不是讀心術", "How the other person shows up in the relationship; not mind reading") },
      { index: 3, name: L("關係本身", "The relationship"), meaning: L("這段關係現在的體質", "The current constitution of the relationship itself") },
      { index: 4, name: L("挑戰", "Challenge"), meaning: L("目前最需要面對的張力", "The tension most in need of attention") },
      { index: 5, name: L("潛力", "Potential"), meaning: L("好好經營的話，它能長成什麼", "What it can grow into if tended well") },
    ],
    question: L(
      "洗牌前，想好一段想理解的關係：我們之間現在是什麼樣子？",
      "Before you shuffle, think of a relationship you want to understand: what is it like between you right now?",
    ),
    hint: L(
      "讀法重點在對照位置 1 和 2：兩張牌的元素與節奏差異，常常就是答案的一半。替不在場的人斷言想法是塔羅最容易被濫用的地方，把焦點放回關係與自己。",
      "Compare positions 1 and 2: the difference in element and tempo is often half the answer. Asserting what an absent person thinks is where tarot is most easily abused; keep the focus on the relationship and yourself.",
    ),
    article: `${ARTICLE}/themed-spreads`,
  },
  decision: {
    id: "decision",
    name: L("抉擇牌陣（六張）", "Decision spread (six cards)"),
    cardCount: 6,
    use: L("二選一的處境。", "A choice between two options."),
    positions: [
      { index: 1, name: L("選項 A 的本質", "Option A: what it is"), meaning: L("這條路實際上是什麼，不是你以為的它", "What this path actually is, not what you assume") },
      { index: 2, name: L("選項 A 的發展", "Option A: how it unfolds"), meaning: L("走這條路會展開什麼", "What opens up along this path") },
      { index: 3, name: L("選項 B 的本質", "Option B: what it is"), meaning: L("另一條路實際上是什麼", "What the other path actually is") },
      { index: 4, name: L("選項 B 的發展", "Option B: how it unfolds"), meaning: L("走另一條路會展開什麼", "What opens up along the other path") },
      { index: 5, name: L("我沒看見的", "What I am not seeing"), meaning: L("影響這個決定、但還沒意識到的盲點", "A blind spot shaping the decision that has not surfaced yet") },
      { index: 6, name: L("提醒", "Reminder"), meaning: L("不管選哪條都要帶上的一句話", "One line to carry whichever path is chosen") },
    ],
    question: L(
      "洗牌前，把兩個選項各用一句話說清楚。",
      "Before you shuffle, state each option in one clear sentence.",
    ),
    hint: L(
      "最有價值的常是位置 5：二選一的糾結多半是因為有第三個因素沒被看見。牌陣不會替你選，它把兩條路攤開，讓選擇有材料。",
      "Position 5 is usually the most valuable: a two-way dilemma often hides a third factor. The spread does not choose for you; it lays both paths out so the choice has material.",
    ),
    article: `${ARTICLE}/themed-spreads`,
  },
  self: {
    id: "self",
    name: L("自我探索牌陣（五張）", "Self-exploration spread (five cards)"),
    cardCount: 5,
    use: L("沒有具體事件，只是想整理自己：年末回顧、生日、迷惘期。", "No specific event; taking stock of yourself: year's end, birthday, a lost stretch."),
    positions: [
      { index: 1, name: L("我現在是誰", "Who I am now"), meaning: L("目前的核心狀態", "My core state right now") },
      { index: 2, name: L("我的資源", "My resources"), meaning: L("手上已經有、但可能低估的力量", "Strength already in hand but perhaps underrated") },
      { index: 3, name: L("我的陰影", "My shadow"), meaning: L("不想看、卻一直在影響我的部分", "What I avoid looking at yet keeps shaping me") },
      { index: 4, name: L("我在迴避什麼", "What I avoid"), meaning: L("一直被排到「以後再說」的事", "The thing forever pushed to \"later\"") },
      { index: 5, name: L("成長的方向", "Direction of growth"), meaning: L("下一步往哪裡走最有養分", "Where the next step is most nourishing") },
    ],
    question: L(
      "不需要具體事件，洗牌前想著「我想整理現在的自己」就好。",
      "No specific event needed; before you shuffle, just hold the thought: I want to take stock of who I am now.",
    ),
    hint: L(
      "位置 3、4 本來就在問陰影，抽到沉重的牌別怕：它是照明，不是判決。",
      "Positions 3 and 4 ask about shadow material, so a heavy card there is no cause for alarm: it is a light, not a verdict.",
    ),
    article: `${ARTICLE}/themed-spreads`,
  },
  celtic: {
    id: "celtic",
    name: L("凱爾特十字（十張）", "Celtic Cross (ten cards)"),
    cardCount: 10,
    use: L("想把一件事看透。", "Seeing one matter through from every angle."),
    positions: [
      { index: 1, name: L("現況", "Present"), meaning: L("此刻身處的狀態、事情的核心", "The state you are in and the core of the matter") },
      { index: 2, name: L("阻礙", "Challenge"), meaning: L("橫在眼前的張力，壓在現況上；不一定是壞事", "The force lying across the present; not necessarily bad") },
      { index: 3, name: L("根源", "Root"), meaning: L("事情的深層基礎，可能是沒意識到的", "The deep foundation of the matter, perhaps unconscious") },
      { index: 4, name: L("過去", "Past"), meaning: L("正在遠去、但仍有影響的因素", "What is receding yet still influential") },
      { index: 5, name: L("目標", "Goal"), meaning: L("意識上追求的、或事情可能的高點", "What you consciously pursue, or the matter's possible high point") },
      { index: 6, name: L("近未來", "Near future"), meaning: L("接下來一小段時間的走向", "The direction of the next short while") },
      { index: 7, name: L("你自己", "Yourself"), meaning: L("面對這件事的姿態與自我認知", "Your stance and self-image in facing this") },
      { index: 8, name: L("環境", "Environment"), meaning: L("身邊的人與外在條件怎麼影響你", "How people and outer conditions affect you") },
      { index: 9, name: L("希望與恐懼", "Hopes and fears"), meaning: L("最深的期待，往往同時是最深的害怕", "Your deepest hope, which is often also your deepest fear") },
      { index: 10, name: L("結果", "Outcome"), meaning: L("照目前軌跡走下去的走向，不是判決", "Where the current trajectory leads; not a verdict") },
    ],
    question: L(
      "洗牌前，心裡想好一件想看透的事：十張牌會從十個角度剖析它。",
      "Before you shuffle, settle on one thing you want to see clearly: ten cards will look at it from ten angles.",
    ),
    hint: L(
      "先看大牌多不多、哪個牌組最多。大牌多代表這件事層次很深；某個牌組特別多，重心就在那個生活面向。",
      "First check how many Majors there are and which suit dominates. Many Majors means the matter runs deep; a dominant suit points to that area of life.",
    ),
    readingOrder: [
      {
        title: L("整體掃一眼", "Take it all in"),
        text: L("先感受整體氛圍：大牌幾張、哪個牌組最多。", "Feel the whole first: how many Majors, which suit dominates."),
        positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
      {
        title: L("核心張力", "The core tension"),
        text: L(
          "位置 1 與 2 合起來，通常就是問題的一句話摘要：試著說出「我覺得……，但……」。位置 2 不一定是壞事，它是「橫」在現況上的力量。",
          "Positions 1 and 2 together are usually a one-sentence summary: try \"I feel ..., but ...\". Position 2 is not necessarily bad news; it is the force lying across the present.",
        ),
        positions: [1, 2],
      },
      {
        title: L("時間線", "The timeline"),
        text: L(
          "根源、過去、現在、近未來：把事情的來龍去脈說成四句的故事。",
          "Root, past, present, near future: tell how this came about in four sentences.",
        ),
        positions: [3, 4, 1, 6],
      },
      {
        title: L("目標與走向", "Goal and trajectory"),
        text: L(
          "你想去的地方對照目前的軌跡：一致是順風；落差大，功課就在下一步的三張。位置 10 不是判決，回頭調整 2、7、8，軌跡就會變。",
          "Where you want to go versus where you are heading: aligned is a tailwind; a wide gap means the work sits in the next three cards. Position 10 is not a verdict; adjust 2, 7 and 8 and the trajectory changes.",
        ),
        positions: [5, 10],
      },
      {
        title: L("人的因素", "The human factors"),
        text: L(
          "你自己、環境、希望與恐懼。位置 9 把「最渴望」與「最害怕」放在同一格，經常說出你不敢說的真心話。",
          "Yourself, your environment, your hopes and fears. Position 9 puts what you most want and most fear in one slot; it often says what you would not say out loud.",
        ),
        positions: [7, 8, 9],
      },
      {
        title: L("收尾", "Closing"),
        text: L(
          "回到問題，用一句話說出這次占卜最想告訴你的重點。",
          "Come back to the question and say, in one sentence, what this reading most wants to tell you.",
        ),
        positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
    ],
    article: `${ARTICLE}/celtic-cross`,
  },
};

export const SPREAD_IDS = Object.keys(SPREADS) as [string, ...string[]];

export function getSpread(id: string): Spread | undefined {
  return SPREADS[id.trim().toLowerCase()];
}

/** 給模型看的精簡清單 */
export function listSpreads(lang: Lang) {
  return Object.values(SPREADS).map((s) => ({
    id: s.id,
    name: s.name[lang],
    cardCount: s.cardCount,
    use: s.use[lang],
  }));
}

/** 單一牌陣的本地化輸出 */
export function localizeSpread(s: Spread, lang: Lang) {
  return {
    id: s.id,
    name: s.name[lang],
    cardCount: s.cardCount,
    use: s.use[lang],
    question: s.question[lang],
    hint: s.hint[lang],
    positions: s.positions.map((p) => ({
      index: p.index,
      name: p.name[lang],
      meaning: p.meaning[lang],
    })),
    readingOrder: s.readingOrder?.map((step) => ({
      title: step.title[lang],
      text: step.text[lang],
      positions: step.positions,
    })),
    article: s.article,
  };
}
