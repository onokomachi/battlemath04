
import type { Problem } from '../types';

/**
 * 問題の正解文字列から最適化されたキーパッドレイアウトを自動生成する。
 *
 * - 練習モード: subtopic内の全問題から共通キーセットを生成
 * - バトルモード: 個別問題の正解から動的にキーセットを生成
 * - デコイキーを追加して答えが直接バレないようにする
 * - 不要キーは完全非表示、グリッドを縮小
 */

// 文字タイプの分類
const DIGIT_POOL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const VARIABLE_POOL = ['x', 'y', 'a', 'b'];
const OPERATOR_POOL = ['+', '-', '×', '/', '=', '^', '.'];
const PAREN_POOL = ['(', ')'];
const GEOMETRY_SYMBOL_POOL = ['°', '△', '∠', '≡'];
const LETTER_POOL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'O', 'P'];
const JAPANESE_POOL = ['共通', '対応', 'あまり', '兆', '億', '万', '千'];
const INEQUALITY_POOL = ['≤', '≥', '<', '>'];
const SPECIAL_POOL = ['π', '²', '³', ','];

/**
 * 正解文字列から必要な文字を抽出する
 */
function extractRequiredChars(answer: string): Set<string> {
  const chars = new Set<string>();
  const str = answer.replace(/;/g, ''); // セミコロン区切りを除去

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    // 日本語キーワードの検出
    if (str.substring(i).startsWith('共通')) {
      chars.add('共通');
      i += 1;
      continue;
    }
    if (str.substring(i).startsWith('対応')) {
      chars.add('対応');
      i += 1;
      continue;
    }
    if (str.substring(i).startsWith('あまり')) {
      chars.add('あまり');
      i += 2;
      continue;
    }
    if (c === '億') { chars.add('億'); continue; }
    if (c === '兆') { chars.add('兆'); continue; }
    if (c === '万') { chars.add('万'); continue; }
    if (c === '千') { chars.add('千'); continue; }

    if (DIGIT_POOL.includes(c)) chars.add(c);
    else if (VARIABLE_POOL.includes(c)) chars.add(c);
    else if (['+', '-'].includes(c)) chars.add(c);
    else if (c === '*' || c === '×') chars.add('×');
    else if (c === '/') chars.add('/');
    else if (c === '=') chars.add('=');
    else if (c === '^') chars.add('^');
    else if (c === '.') chars.add('.');
    else if (c === '(' || c === ')') { chars.add('('); chars.add(')'); }
    else if (c === '°') chars.add('°');
    else if (c === '△') chars.add('△');
    else if (c === '∠') chars.add('∠');
    else if (c === '≡') chars.add('≡');
    else if (/^[A-Z]$/.test(c)) chars.add(c);
    else if (c === 'π') chars.add('π');
    else if (c === '²') chars.add('²');
    else if (c === '³') chars.add('³');
    else if (c === ',') chars.add(',');
    else if (c === '≤') chars.add('≤');
    else if (c === '≥') chars.add('≥');
    else if (c === '<') chars.add('<');
    else if (c === '>') chars.add('>');
    else if (c === 'と') chars.add('と'); // 帯分数の整数部と分数部の区切り
  }

  return chars;
}

/**
 * 必要文字セットにデコイキーを追加する
 */
function addDecoyKeys(required: Set<string>, decoyCount: number = 3): Set<string> {
  const all = new Set(required);

  // タイプ別にデコイを追加
  const requiredDigits = DIGIT_POOL.filter(d => required.has(d));
  const requiredVars = VARIABLE_POOL.filter(v => required.has(v));
  const requiredOps = OPERATOR_POOL.filter(o => required.has(o));
  const requiredLetters = LETTER_POOL.filter(l => required.has(l));
  const requiredGeom = GEOMETRY_SYMBOL_POOL.filter(g => required.has(g));
  const requiredInequality = INEQUALITY_POOL.filter(i => required.has(i));

  // 数字: 1つでも数字が必要なら全数字(0-9)を表示（自然なテンキー配置のため）
  if (requiredDigits.length > 0) {
    DIGIT_POOL.forEach(d => all.add(d));
  }

  // 変数: 使われていない変数を1-2個追加
  if (requiredVars.length > 0) {
    const unusedVars = VARIABLE_POOL.filter(v => !required.has(v));
    shuffleArray(unusedVars).slice(0, Math.min(2, unusedVars.length)).forEach(v => all.add(v));
  }

  // 演算子: 使われていない演算子を1-2個追加
  if (requiredOps.length > 0) {
    const unusedOps = OPERATOR_POOL.filter(o => !required.has(o));
    shuffleArray(unusedOps).slice(0, Math.min(2, unusedOps.length)).forEach(o => all.add(o));
  }

  // アルファベット文字: 使われていない文字を2-3個追加
  if (requiredLetters.length > 0) {
    const unusedLetters = LETTER_POOL.filter(l => !required.has(l));
    shuffleArray(unusedLetters).slice(0, Math.min(3, unusedLetters.length)).forEach(l => all.add(l));
  }

  // 幾何記号: 持っている記号に関連する記号を追加
  if (requiredGeom.length > 0) {
    GEOMETRY_SYMBOL_POOL.filter(g => !required.has(g)).forEach(g => all.add(g));
  }

  // 不等号: 対になる記号を追加
  if (requiredInequality.length > 0) {
    INEQUALITY_POOL.forEach(i => all.add(i));
  }

  // 括弧: 片方あれば両方入れる
  if (required.has('(') || required.has(')')) {
    all.add('(');
    all.add(')');
  }

  // 大きい数の単位: 万/億/兆のどれかが必要なら「千」も並べる
  // (「6000億」を「6千億」と書きたい児童のため。採点器はどちらも正答にする)
  if (required.has('万') || required.has('億') || required.has('兆')) {
    all.add('千');
  }

  return all;
}

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

/**
 * キーセットをグリッドレイアウトに配置する
 * 数字はテンキー配置（7,8,9 / 4,5,6 / 1,2,3 / 0）を維持
 */
function arrangeLayout(keys: Set<string>): string[][] {
  const digits = DIGIT_POOL.filter(d => keys.has(d));
  const vars = VARIABLE_POOL.filter(v => keys.has(v));
  const ops = OPERATOR_POOL.filter(o => keys.has(o));
  const parens = PAREN_POOL.filter(p => keys.has(p));
  const letters = LETTER_POOL.filter(l => keys.has(l));
  const geomSymbols = GEOMETRY_SYMBOL_POOL.filter(g => keys.has(g));
  const jpKeys = JAPANESE_POOL.filter(j => keys.has(j));
  const ineqs = INEQUALITY_POOL.filter(i => keys.has(i));
  const specials = SPECIAL_POOL.filter(s => keys.has(s));

  // レイアウトモード判定
  const hasLetters = letters.length > 0;
  const hasDigits = digits.length > 0;
  const hasGeomSymbols = geomSymbols.length > 0 || jpKeys.length > 0;

  // === 証明問題系: 文字＋記号中心 ===
  if (hasLetters && !hasDigits) {
    const allKeys = [...letters, ...geomSymbols, ...jpKeys];
    const cols = allKeys.length <= 9 ? 3 : allKeys.length <= 16 ? 4 : 6;
    return chunkArray(allKeys, cols);
  }

  // === 文字＋数字混合（証明問題で数値も使う場合） ===
  if (hasLetters && hasDigits) {
    const symbolKeys = [...letters, ...geomSymbols];
    const numericKeys = arrangeDigitsWithExtras(digits, ops, vars, parens, [...specials, ...jpKeys], ineqs);
    const cols = Math.max(numericKeys[0]?.length || 3, symbolKeys.length <= 3 ? 3 : symbolKeys.length <= 4 ? 4 : 6);
    const symbolRows = chunkArray(symbolKeys, cols);
    // 数字行の幅を合わせる
    const adjustedNumericKeys = numericKeys.map(row => {
      while (row.length < cols) row.push(' ');
      return row;
    });
    return [...symbolRows, ...adjustedNumericKeys];
  }

  // === 数字中心のレイアウト ===
  if (hasDigits) {
    return arrangeDigitsWithExtras(digits, ops, vars, parens, [...specials, ...jpKeys], ineqs);
  }

  // === 記号のみ ===
  if (hasGeomSymbols) {
    const allKeys = [...geomSymbols, ...jpKeys];
    return chunkArray(allKeys, 3);
  }

  return [['0']]; // フォールバック
}

/**
 * 数字をテンキー配置にし、追加キーを右側に配置
 */
function arrangeDigitsWithExtras(
  digits: string[],
  ops: string[],
  vars: string[],
  parens: string[],
  specials: string[],
  ineqs: string[]
): string[][] {
  const extras = [...vars, ...ops, ...parens, ...specials, ...ineqs];
  const hasAllDigits = digits.length === 10;
  const hasManyDigits = digits.length >= 7;

  // テンキー配置
  if (hasManyDigits) {
    // 追加キーの列数を決定
    const extraCols = extras.length <= 0 ? 0 : extras.length <= 4 ? 1 : 2;
    const totalCols = 3 + extraCols;

    const rows: string[][] = [];
    const digitRows = [
      digits.filter(d => ['7', '8', '9'].includes(d)),
      digits.filter(d => ['4', '5', '6'].includes(d)),
      digits.filter(d => ['1', '2', '3'].includes(d)),
      digits.filter(d => ['0'].includes(d)),
    ].map(row => {
      // ソートして正しい順序を保つ
      return row.sort((a, b) => {
        const order = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];
        return order.indexOf(a) - order.indexOf(b);
      });
    });

    // 空の行は除外、ただし各行を3キーにパディング
    const nonEmptyRows = digitRows.filter(r => r.length > 0);
    // 3キーに満たない行をパディング
    nonEmptyRows.forEach(row => {
      while (row.length < 3) row.push(' ');
    });

    // 追加キーを配分
    const extraChunks = chunkArray(extras, extraCols || 1);

    for (let i = 0; i < Math.max(nonEmptyRows.length, extraChunks.length); i++) {
      const digitRow = nonEmptyRows[i] || [' ', ' ', ' '];
      const extraRow = extraCols > 0 ? (extraChunks[i] || []) : [];
      while (extraRow.length < extraCols) extraRow.push(' ');
      rows.push([...digitRow, ...extraRow]);
    }

    return rows;
  }

  // 数字が少ない場合はフラットに配置
  const allKeys = [...digits.sort(), ...extras];
  const cols = allKeys.length <= 6 ? 3 : allKeys.length <= 12 ? 4 : 5;
  return chunkArray(allKeys, cols);
}

function chunkArray(arr: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    const chunk = arr.slice(i, i + size);
    // パディング
    while (chunk.length < size) chunk.push(' ');
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * 分数入力専用レイアウト。
 * 解答が数字・「/」・「と」だけで構成されるとき(=分数の答え)は、
 * デコイなしの固定テンキー+分数キーを返す(小4児童向けに一貫した配置を保つ)。
 */
const FRACTION_LAYOUT: string[][] = [
  ['7', '8', '9', 'と'],
  ['4', '5', '6', '/'],
  ['1', '2', '3', ' '],
  [' ', '0', ' ', ' '],
];

const isFractionCharset = (chars: Set<string>): boolean => {
  if (chars.size === 0) return false;
  let hasFracKey = false;
  for (const c of chars) {
    if (c === '/' || c === 'と') { hasFracKey = true; continue; }
    if (!DIGIT_POOL.includes(c)) return false;
  }
  return hasFracKey;
};

// ==============================
// 公開API
// ==============================

/**
 * 練習モード用: subtopic内の全問題からキーセットを生成
 * 同じsubtopicの全問題で共通のキーパッドを使う
 */
export function generateSubtopicKeypadLayout(problems: Problem[], problemType: string): string[][] {
  // 特殊タイプは固定レイアウトを返す（graphing, proof等）
  const fixedLayout = getFixedLayoutForType(problemType);
  if (fixedLayout) return fixedLayout;

  // 全問題の正解から必要文字を集計
  const allRequired = new Set<string>();
  for (const problem of problems) {
    const chars = extractRequiredChars(problem.answer);
    chars.forEach(c => allRequired.add(c));
  }

  if (allRequired.size === 0) return getDefaultLayout();

  // 分数の答え(数字+/+と)は固定の分数キーパッド
  if (isFractionCharset(allRequired)) return FRACTION_LAYOUT;

  // デコイを追加
  const withDecoys = addDecoyKeys(allRequired, 3);

  return arrangeLayout(withDecoys);
}

/**
 * バトルモード用: 個別問題の正解から動的にキーセットを生成
 * デコイを多め（4-5個）に入れて答えがバレにくくする
 */
export function generateBattleKeypadLayout(problem: Problem): string[][] {
  const fixedLayout = getFixedLayoutForType(problem.type);
  if (fixedLayout) return fixedLayout;

  const required = extractRequiredChars(problem.answer);

  if (required.size === 0) return getDefaultLayout();

  // 分数の答え(数字+/+と)は固定の分数キーパッド
  if (isFractionCharset(required)) return FRACTION_LAYOUT;

  // バトルモードではデコイを多めに入れる
  const withDecoys = addDecoyKeys(required, 5);

  return arrangeLayout(withDecoys);
}

/**
 * graphingやproof等、特定タイプは固定レイアウトを返す
 */
function getFixedLayoutForType(type: string): string[][] | null {
  // グラフ作成系: キーパッドは使わない（キャンバス入力）
  if (['graphing', 'graphing_with_table'].includes(type)) {
    return null; // nullは「キーパッドを表示しない」を意味する場合に使用
  }

  return null;
}

function getDefaultLayout(): string[][] {
  return [
    ['7', '8', '9', 'x', 'y'],
    ['4', '5', '6', '+', '-'],
    ['1', '2', '3', '/', '^'],
    ['0', '.', '=', '(', ')']
  ];
}
