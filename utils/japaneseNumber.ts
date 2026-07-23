/**
 * utils/japaneseNumber.ts — 大きい数の表記ゆれ対応
 *
 * 「180億」「7兆」「1兆4000億」「26000000000」のような表記を BigInt に解釈し、
 * 数値として等しければ正答にする(テストの模範解答も「700億(700 0000 0000)」の
 * ように両表記を併記しているため)。
 */

/** 万・億・兆を含む(または含まない)整数表記を BigInt に解釈。解釈できなければ null。 */
export const parseJapaneseNumber = (raw: string): bigint | null => {
  const s = (raw || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s,、]/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    try { return BigInt(s); } catch { return null; }
  }
  // 単位付き: 例 1兆4000億 / 180億 / 3057億600万 / 7兆 / 6千億(=6000億) / 9千万 / 8千
  if (/[^0-9兆億万千]/.test(s)) return null;
  // 「千」は 千兆・千億・千万 のように上位単位と組み合わせた複合単位として解釈する
  const UNIT_TOKENS: [string, bigint][] = [
    ['千兆', 10n ** 15n],
    ['兆', 10n ** 12n],
    ['千億', 10n ** 11n],
    ['億', 10n ** 8n],
    ['千万', 10n ** 7n],
    ['万', 10n ** 4n],
    ['千', 10n ** 3n],
  ];
  let total = 0n;
  let num = '';
  let lastUnit = 10n ** 16n; // 単位は降順でなければならない
  let sawUnit = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') {
      num += ch;
      continue;
    }
    // 最長一致で単位トークンを読む(千億 を 千+億 と誤読しない)
    const token = UNIT_TOKENS.find(([t]) => s.startsWith(t, i));
    if (!token || !num) return null;
    const u = token[1];
    if (u >= lastUnit) return null;
    total += BigInt(num) * u;
    num = '';
    lastUnit = u;
    sawUnit = true;
    i += token[0].length - 1;
  }
  if (!sawUnit) return null;
  if (num) {
    // 末尾の単位なし数字(例 3億500 → 3億+500)
    if (lastUnit <= 1n) return null;
    total += BigInt(num);
  }
  return total;
};

/** 両方が大きい数として解釈できるとき、数値として等しいか。どちらかが解釈不能なら null。 */
export const japaneseNumberEquals = (a: string, b: string): boolean | null => {
  const pa = parseJapaneseNumber(a);
  const pb = parseJapaneseNumber(b);
  if (pa === null || pb === null) return null;
  return pa === pb;
};

/** 両方が小数(または整数)表記のとき、数値として等しいか(1.60 = 1.6)。 */
export const decimalEquals = (a: string, b: string): boolean | null => {
  const re = /^\d+(\.\d+)?$/;
  const na = (a || '').trim();
  const nb = (b || '').trim();
  if (!re.test(na) || !re.test(nb)) return null;
  if (!na.includes('.') && !nb.includes('.')) return null; // 整数どうしは既存経路(分数採点)で処理
  return Math.abs(parseFloat(na) - parseFloat(nb)) < 1e-9;
};
