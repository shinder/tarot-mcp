// 可重現的亂數：同一個 seed 一定抽出同一組牌。
// 沒給 seed 時由 crypto 產生一個，並隨結果回傳，讓任何一次抽牌事後都能重現。

/** FNV-1a 32 位元雜湊：把任意字串變成 PRNG 的種子 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32：小而夠用的 32 位元 PRNG，回傳 [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 隨機產生一個短 seed（base36，約 10 字元） */
export function randomSeed(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return (buf[0].toString(36) + buf[1].toString(36)).slice(0, 10);
}

/** Fisher–Yates 洗牌，回傳新陣列，不動原陣列 */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
