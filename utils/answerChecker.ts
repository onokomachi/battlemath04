/**
 * answerChecker.ts — 統一採点ロジック
 *
 * これまでカードバトル(App.tsx)・スピード対戦(App.tsx)・練習モード(ProblemScreen.tsx)で
 * 3種類の異なる採点関数が存在し、同じ答えでもモードによって正誤判定が変わっていた。
 * 本モジュールが唯一の採点経路 (single source of truth)。
 *
 * 重要な仕様:
 *  - ';' は「複数入力欄の区切り」(穴埋め証明・筆算・ガイド付き方程式)。別解の区切りではない。
 *  - 単位 (度, 円, 個 など) は「数値+単位」の形のときだけ除去する。
 *    'm' や '分' を無条件に除去すると "a=2m-b" のような変数 m を含む答えを壊すため。
 *  - data.multiple な問題は ',' 区切りの順不同集合として比較する。
 */

import { checkFractionAnswer, type RequireForm } from './fraction';
import { japaneseNumberEquals, decimalEquals } from './japaneseNumber';

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'm': 'ᵐ',
};

/**
 * 数値の直後に付く単位のみ除去（変数を含む式は壊さない）。
 * 単一文字の m/g/l は数式の変数と区別できないため除去しない
 * (実データの単位付き答えは ° のみ — 2026-06 時点の全 data/ 調査による)。
 */
const stripTrailingUnits = (s: string): string =>
  s.replace(/(-?[0-9.\/]+)(?:cm²|cm³|km|cm|mm|kg|ml|[度円個枚本人匹点分秒])$/u, '$1');

export const normalizeAnswer = (str: string): string => {
  if (!str) return '';
  const normalized = str
    // 全角英数記号 → 半角 (０．５ｘ → 0.5x)
    .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '')
    .replace(/＝/g, '=')
    .replace(/／/g, '/')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    // ° は数式中どこでも単位 (x=50° 等)
    .replace(/°/g, '')
    // ^2 → ² (キーボード入力の冪表記をデータ側の上付き文字に揃える)
    .replace(/\^([0-9+\-nm]+)/g, (_, digits: string) =>
      digits.split('').map(c => SUPERSCRIPT_MAP[c] || c).join(''))
    .replace(/pi/gi, 'π')
    // 小数係数の分数表記ゆれ (0.5x ↔ 1/2x)
    .replace(/(^|[+\-(=])0\.5([a-zπ])/g, '$11/2$2')
    .toLowerCase();
  return stripTrailingUnits(normalized);
};

/** ',' 区切りを順不同の集合として正規化 (例: "∠a,∠b" ≡ "∠b,∠a") */
const asSortedSet = (s: string): string => s.split(',').map(p => p.trim()).sort().join(',');

export interface CheckAnswerOptions {
  /** data.multiple — ',' 区切り順不同比較を行う */
  multiple?: boolean;
  /**
   * data.requireForm — 分数問題の解答形式指定。
   * 'mixed'(帯分数) | 'improper'(仮分数) | 'integer'(整数) | 'any'(既定)。
   * 分数として解析できる解答は値+形式で採点する(utils/fraction.ts)。
   */
  requireForm?: RequireForm;
}

/**
 * 採点する。correctAnswer に ';' が含まれる場合は複数入力欄問題として
 * 各欄を個別に正規化して全欄一致を要求する。
 * 分数(「3/4」「2と3/4」)として解析できる場合は分数採点器を優先する。
 */
export const checkAnswer = (
  userAnswer: string,
  correctAnswer: string,
  options?: CheckAnswerOptions,
): boolean => {
  if (correctAnswer.includes(';')) {
    const correctParts = correctAnswer.split(';');
    const userParts = (userAnswer || '').split(';');
    if (userParts.length !== correctParts.length) return false;
    return correctParts.every((part, i) => {
      const fracResult = checkFractionAnswer(userParts[i], part, options?.requireForm);
      if (fracResult !== null) return fracResult;
      return normalizeAnswer(userParts[i]) === normalizeAnswer(part);
    });
  }
  if (options?.multiple) {
    return asSortedSet(normalizeAnswer(userAnswer)) === asSortedSet(normalizeAnswer(correctAnswer));
  }
  // 分数採点: 単位付き解答("3/4L" 等)にも対応できるよう、まず単位を除去してから試す
  const userNorm = stripTrailingUnits(normalizeAnswer(userAnswer));
  const correctNorm = stripTrailingUnits(normalizeAnswer(correctAnswer));
  const fracResult = checkFractionAnswer(userNorm, correctNorm, options?.requireForm);
  if (fracResult !== null) return fracResult;
  // 大きい数の表記ゆれ("180億" = "18000000000")
  const bigResult = japaneseNumberEquals(userNorm, correctNorm);
  if (bigResult !== null) return bigResult;
  // 小数の数値比較("1.60" = "1.6")
  const decResult = decimalEquals(userNorm, correctNorm);
  if (decResult !== null) return decResult;
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
};
