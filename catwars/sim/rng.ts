// ── 決定論的な乱数（ロックステップ同期の前提）─────────────────────────────
//
// 既存の catwars/utils/random.ts の LCG (seed*9301+49297 % 233280) は
// 決定論的ではあるが、周期が 233280 と短く、とりうる値がその数種類に限られる。
// また LCG は下位ビットの分布が偏るため、`Math.floor(next()*n)` のような
// 使い方で偏りが出やすい。
// ここでは mulberry32 を使う。整数演算（Math.imul / ビット演算）だけで
// 構成されているため、**どのJSエンジンでもビット単位で同じ結果**になる。
//
// 重要: 乱数を引く順序が両クライアントで完全に一致していなければならない。
// そのため「シミュレーション用」と「演出用」でインスタンスを必ず分けること。
// 演出用の乱数をシミュレーション用インスタンスから引くと、描画の都合だけで
// 同期が壊れる（docs/PVP_LOCKSTEP.md §7-4 参照）。

export class DetRNG {
  private s: number;

  constructor(seed: number) {
    // 0 は mulberry32 の劣化点なので避ける
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** [0, 1) の一様乱数 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [0, n) の整数 */
  int(n: number): number {
    return n <= 0 ? 0 : Math.floor(this.next() * n) % n;
  }

  /** [min, max) の実数 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** 配列から1つ選ぶ（空配列なら undefined） */
  pick<T>(arr: readonly T[]): T | undefined {
    return arr.length === 0 ? undefined : arr[this.int(arr.length)];
  }

  /** 内部状態の取り出し（スナップショット・チェックサム用） */
  getState(): number {
    return this.s >>> 0;
  }

  /** 内部状態の復元 */
  setState(s: number): void {
    this.s = (s >>> 0) || 0x9e3779b9;
  }

  clone(): DetRNG {
    const r = new DetRNG(1);
    r.setState(this.s);
    return r;
  }
}
