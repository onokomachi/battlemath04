/**
 * utils/fraction.ts — 分数の解析・整形・比較(小4「分数」ドメインの中核)
 *
 * 表記の規約:
 *  - 仮分数・真分数: "3/4", "7/5"
 *  - 帯分数:         "2と3/4"  (整数部と分数部を「と」でつなぐ)
 *  - 整数:           "3"
 *
 * 採点の規約(docs/DESIGN.md §6):
 *  - 計算問題(requireForm 未指定 = 'any'): 値が等しく、かつ分母が同じ表現
 *    (例: 7/5 と 1と2/5)を両方正答とする。約分形(6/8 に対する 3/4)は
 *    値は等しいが分母が異なるため正答としない(約分は5年の内容)。
 *  - 変換問題: requireForm で 'mixed' | 'improper' | 'integer' を指定し、
 *    指定された形のみ正答とする(値の一致は前提)。
 */

export interface Frac {
  /** 整数部(帯分数以外は 0) */
  whole: number;
  /** 分子(整数のときは 0) */
  num: number;
  /** 分母(整数のときは 1) */
  den: number;
}

export type FractionForm = 'integer' | 'proper' | 'improper' | 'mixed';

export type RequireForm = 'mixed' | 'improper' | 'integer' | 'any';

/** 全角→半角・空白除去の軽い正規化(answerChecker と重複しない範囲) */
const normalize = (s: string): string =>
  (s || '')
    .replace(/[０-９／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '')
    .replace(/／/g, '/');

/**
 * 分数文字列を解析する。解析できない場合は null。
 *  "3" → {whole:3, num:0, den:1}
 *  "3/4" → {whole:0, num:3, den:4}
 *  "2と3/4" → {whole:2, num:3, den:4}
 */
export const parseFraction = (raw: string): Frac | null => {
  const s = normalize(raw);
  if (!s) return null;
  const mixed = s.match(/^(\d+)と(\d+)\/(\d+)$/);
  if (mixed) {
    const den = parseInt(mixed[3], 10);
    if (den === 0) return null;
    return { whole: parseInt(mixed[1], 10), num: parseInt(mixed[2], 10), den };
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const den = parseInt(frac[2], 10);
    if (den === 0) return null;
    return { whole: 0, num: parseInt(frac[1], 10), den };
  }
  const int = s.match(/^(\d+)$/);
  if (int) return { whole: parseInt(int[1], 10), num: 0, den: 1 };
  return null;
};

/** 文字列が分数(または整数)として解析可能か */
export const isFractionLike = (s: string): boolean => parseFraction(s) !== null;

/** 見た目の形を分類する(値ではなく表記に基づく) */
export const classifyForm = (f: Frac): FractionForm => {
  if (f.num === 0) return 'integer';
  if (f.whole > 0) return 'mixed';
  return f.num >= f.den ? 'improper' : 'proper';
};

/** 仮分数表現に統一 {num, den} (whole は 0 になる) */
export const toImproper = (f: Frac): Frac => ({ whole: 0, num: f.whole * f.den + f.num, den: f.den });

/** 帯分数(または整数)表現に統一 */
export const toMixed = (f: Frac): Frac => {
  const total = f.whole * f.den + f.num;
  const whole = Math.floor(total / f.den);
  const num = total - whole * f.den;
  return num === 0 ? { whole, num: 0, den: 1 } : { whole, num, den: f.den };
};

/** 値の比較: a - b の符号(通分せず交差乗算) */
export const compareFraction = (a: Frac, b: Frac): number => {
  const av = (a.whole * a.den + a.num) * b.den;
  const bv = (b.whole * b.den + b.num) * a.den;
  return av === bv ? 0 : av > bv ? 1 : -1;
};

/** 正規表記の文字列へ(整数は "3"、帯分数は "2と3/4"、それ以外 "7/5") */
export const formatFraction = (f: Frac): string => {
  if (f.num === 0) return String(f.whole);
  if (f.whole > 0) return `${f.whole}と${f.num}/${f.den}`;
  return `${f.num}/${f.den}`;
};

/**
 * 分数として採点する。
 * - どちらかが分数として解析できなければ null を返す(呼び出し側が文字列比較へフォールバック)。
 * - requireForm 指定時: 値が等しく、かつユーザーの表記が指定形であること。
 * - 'any'(既定): 値が等しく、分母が両立すること
 *   (両方に分数部があるときは同じ分母。整数どうし・値が整数のときの整数解答は常に許容)。
 */
export const checkFractionAnswer = (
  userRaw: string,
  correctRaw: string,
  requireForm: RequireForm = 'any',
): boolean | null => {
  const user = parseFraction(userRaw);
  const correct = parseFraction(correctRaw);
  if (!user || !correct) return null;

  if (compareFraction(user, correct) !== 0) return false;

  // 分母の両立: 両方に分数部があるときは同じ分母を要求する
  // (約分・分母の拡張は4年未習。requireForm 指定時も同様に守る)
  if (user.num > 0 && correct.num > 0 && user.den !== correct.den) return false;

  const userForm = classifyForm(user);
  switch (requireForm) {
    case 'integer':
      return userForm === 'integer';
    case 'mixed':
      // 「帯分数で答える」問題。値が整数になるケースはデータ側で 'integer' を使う。
      return userForm === 'mixed' || userForm === 'integer';
    case 'improper':
      return userForm === 'improper';
    case 'any':
    default: {
      // 値は等しい。分母の両立を確認する(約分・拡張分数は未習のため不可)。
      if (user.num === 0 || correct.num === 0) return true; // どちらかが整数表記(値が整数)
      return user.den === correct.den;
    }
  }
};

// ============================
// 表示用マークアップの解析
// ============================

export type FractionTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'frac'; frac: Frac };

/**
 * 問題文マークアップを分解する。
 * "{3/4}Lと{1と2/4}Lをあわせると?" → [frac 3/4]["Lと"][frac 1と2/4]["Lをあわせると?"]
 * 波かっこの中が分数として解析できなければそのまま文字列として残す。
 */
export const parseFractionMarkup = (text: string): FractionTextSegment[] => {
  const segments: FractionTextSegment[] = [];
  const re = /\{([^{}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    const frac = parseFraction(m[1]);
    if (frac) segments.push({ kind: 'frac', frac });
    else segments.push({ kind: 'text', text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
};

/** 入力途中の解答("2と3/" など)も含めて表示用セグメントに変換する */
export const parsePartialAnswer = (
  raw: string,
): { whole: string; num: string; den: string; hasFracPart: boolean } => {
  const s = normalize(raw);
  const toIdx = s.indexOf('と');
  let whole = '';
  let rest = s;
  if (toIdx >= 0) {
    whole = s.slice(0, toIdx);
    rest = s.slice(toIdx + 1);
  }
  const slashIdx = rest.indexOf('/');
  if (slashIdx < 0) {
    // 分数部がまだない: 「と」が押されていれば分子入力中とみなす
    if (toIdx >= 0) return { whole, num: rest, den: '', hasFracPart: true };
    return { whole: rest, num: '', den: '', hasFracPart: false };
  }
  return { whole, num: rest.slice(0, slashIdx), den: rest.slice(slashIdx + 1), hasFracPart: true };
};
