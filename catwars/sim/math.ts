// ── 決定論的な数学ヘルパ ─────────────────────────────────────────────────
//
// ECMAScript 仕様では、四則演算と Math.sqrt は IEEE 754 で「正しく丸める」ことが
// 要求されており、どのエンジンでもビット単位で同じ結果になる。
// 一方 Math.pow / Math.hypot / Math.atan2 / Math.sin / Math.cos などは
// *implementation-approximated*（実装依存の近似でよい）と定められていて、
// V8 と JavaScriptCore（iPad Safari）で最下位ビットが変わりうる。
//
// 最下位ビット1つの差でも「距離 <= 射程」の判定が両者で食い違えば、
// そこから攻撃の有無・撃破・ターゲット選択が分岐し、状態は指数的に発散する。
// したがってシミュレーション内では、このファイルの関数だけを使うこと。
//
// 使用禁止: Math.pow, Math.hypot, Math.atan2, Math.sin, Math.cos, Math.tan,
//           Math.exp, Math.log, Math.cbrt, Math.random
// 使用可:   +, -, *, /, Math.sqrt, Math.floor, Math.ceil, Math.round,
//           Math.abs, Math.min, Math.max, Math.imul

/** 2点間の距離の2乗（平方根を取らない比較用。いちばん速く、いちばん安全） */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** 2点間の距離。Math.hypot ではなく sqrt を使う（hypot は実装依存） */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** ベクトルの長さ */
export function len(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * (dx, dy) 方向へ step だけ進む量を返す。
 * 元コードの `angle = atan2(dy,dx); cos(angle)*step, sin(angle)*step` と
 * 数学的に同値だが、三角関数を経由しないので決定論的（かつ高速）。
 */
export function stepToward(dx: number, dy: number, step: number): { x: number; y: number } {
  const l = len(dx, dy);
  if (l <= 1e-9) return { x: 0, y: 0 };
  return { x: (dx / l) * step, y: (dy / l) * step };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 浮動小数点の誤差を落として量子化する。
 * チェックサムに入れる前や、蓄積誤差を切りたい箇所で使う。
 */
export function quantize(v: number, scale = 1000): number {
  return Math.round(v * scale) / scale;
}
