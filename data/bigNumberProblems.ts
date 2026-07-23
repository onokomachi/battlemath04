/**
 * data/bigNumberProblems.ts — 単元「大きい数のしくみ」(東書4上①)
 * 新学社まとめテスト「1.大きい数のしくみ」(表100点/裏50点)の出題形式に準拠。
 * 億兆の解答は「180億」「18000000000」の両表記を正答(utils/japaneseNumber.ts)。
 *
 * 各サブトピック20問以上(かけ算・かんたんな計算系は30問以上)を確保するため、
 * 漢数字変換・億兆表記フォーマッタ・位の名前を関数化し、決定的に問題を生成する。
 */
import type { Problem } from '../types';
import { labeledNumberLineSvg } from '../utils/mathSvg';

interface TextExtra {
  svg?: string;
  options?: string[];
  multiple?: boolean;
  hint?: string | string[];
}

const t = (question: string, answer: string, extra?: TextExtra): Problem => ({
  type: 'text',
  data: { question, ...extra },
  answer,
});

/**
 * 2桁×2桁以上の暗算では非現実的なかけ算は、単純な数値入力ではなく
 * 筆算の部分積を1つずつ確認できる guided 問題として出題する。
 */
const guidedMul = (a: number, b: number): Problem => ({
  type: 'guided',
  data: {
    guidedKind: 'multiplication-hissan',
    question: `${a} × ${b} の筆算をしましょう。`,
    a,
    b,
  },
  answer: String(a * b),
});

// ============================================================
// 大きい数のフォーマッタ(決定的生成に使う共通関数)
// ============================================================

const DIGIT_KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PLACE_KANJI = ['', '十', '百', '千'];
const GROUP_KANJI = ['', '万', '億', '兆'];

/** 0〜9999 の4桁グループを漢数字に(「一十」ではなく「十」のように1は省略) */
const fourDigitToKanji = (num: number): string => {
  if (num === 0) return '';
  const digits = [Math.floor(num / 1000) % 10, Math.floor(num / 100) % 10, Math.floor(num / 10) % 10, num % 10];
  let s = '';
  for (let i = 0; i < 4; i++) {
    const d = digits[i];
    if (d === 0) continue;
    s += (d === 1 && i < 3) ? PLACE_KANJI[3 - i] : DIGIT_KANJI[d] + PLACE_KANJI[3 - i];
  }
  return s;
};

/** 整数を漢数字表記に(兆まで対応) */
const numberToKanji = (n: number): string => {
  if (n === 0) return '零';
  const groups: number[] = [];
  let x = n;
  while (x > 0) { groups.push(x % 10000); x = Math.floor(x / 10000); }
  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    result += fourDigitToKanji(groups[i]) + GROUP_KANJI[i];
  }
  return result;
};

/** 整数を「3057億600万」のような数字+単位の混合表記に(問題文・解答の両表記に使う) */
const formatMixedJP = (n: number): string => {
  if (n === 0) return '0';
  const groups: number[] = [];
  let x = n;
  while (x > 0) { groups.push(x % 10000); x = Math.floor(x / 10000); }
  let s = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    s += String(groups[i]) + GROUP_KANJI[i];
  }
  return s;
};

/** 4桁グループ内の位置(0=一,1=十,2=百,3=千)と大単位(0=一,1=万,2=億,3=兆)から「〜の位」を作る */
const DIGIT_PLACE = ['一', '十', '百', '千'];
const placeName = (index: number): string => DIGIT_PLACE[index % 4] + GROUP_KANJI[Math.floor(index / 4)] + 'の位';
/** その位が表す量(「1000万」のような表示) */
const quantityLabel = (index: number): string => {
  const within = index % 4;
  const group = Math.floor(index / 4);
  return String(10 ** within) + GROUP_KANJI[group];
};

const fromCombo = (chou: number, oku: number, man: number, ichi = 0): number =>
  chou * 1e12 + oku * 1e8 + man * 1e4 + ichi;

// ---- 大きい数のよみかき ----
const yomikakiBase: Problem[] = [
  t('「七億九千二百万」を 数字で 書きましょう。', '792000000', {
    hint: ['一・十・百・千の 4つずつで「万」「億」「兆」と 位が 上がるよ。', '七億 → 7のあとに 億の位まで 0を ならべよう。7 9200 0000 だね。'],
  }),
  t('「三兆五百億」を 数字で 書きましょう。', '3050000000000', {
    hint: ['兆の下に 億の 部屋(4けた)が あるよ。', '3 0500 0000 0000。千億の位が 5に なるね。'],
  }),
  t('「二百四十九億八千万」を 数字で 書きましょう。', '24980000000', {
    hint: ['億の部屋に 249、万の部屋に 8000 を 入れよう。', '249 8000 0000 だね。'],
  }),
  t('「三兆五十七億六百万」を 数字で 書きましょう。', '3005706000000', {
    hint: ['兆: 3、億: 0057、万: 0600、一: 0000。', 'ない位には 0を わすれずに 書こう。'],
  }),
  t('1兆を 4こ、1億を 5こ あわせた数を 書きましょう。', '4000500000000', {
    hint: ['4兆 と 5億 を あわせるよ。', '4 0005 0000 0000。間の 位の 0に 気をつけて。'],
  }),
  t('1兆を 5こ、1億を 9こ あわせた数を 書きましょう。', '5000900000000', {
    hint: ['5兆 + 9億。億の 部屋は 0009 だね。'],
  }),
  t('1億を 26こ 集めた数を 書きましょう。', '2600000000', {
    hint: ['1億が 10こで 10億、26こなら 26億だね。', '26億 = 26 0000 0000。'],
  }),
  t('1億を 8こ、1000万を 2こ あわせた数を 書きましょう。', '820000000', {
    hint: ['8億 と 2000万 を あわせるよ。', '8億2000万 = 8 2000 0000。'],
  }),
];
// 追加12問: 漢数字変換を関数で生成(数の組み立てかたにバリエーションを持たせる)
const yomikakiCombos: [number, number, number][] = [
  [8, 0, 0], [0, 62, 0], [0, 0, 9000], [0, 1, 3500], [4, 80, 0], [3, 305, 600],
  [0, 7, 0], [50, 0, 0], [0, 999, 9999], [9, 0, 1], [0, 240, 50], [6, 3, 700],
];
const yomikakiExtra: Problem[] = yomikakiCombos.map(([chou, oku, man]) => {
  const n = fromCombo(chou, oku, man);
  const kanji = numberToKanji(n);
  return t(`「${kanji}」を 数字で 書きましょう。`, String(n), {
    hint: [
      '一・十・百・千の 4つずつで「万」「億」「兆」と 位が 上がるよ。',
      `${formatMixedJP(n)} を 位ごとに 分けて、ない位には 0を わすれずに 書こう。`,
    ],
  });
});
const yomikaki: Problem[] = [...yomikakiBase, ...yomikakiExtra];

// ---- 何の位・いくつ分 ----
const kuraiBase: Problem[] = [
  t('1429400000000 の いちばん左の「1」は 何の位ですか。', '一兆の位', {
    options: ['一兆の位', '千億の位', '一億の位', '百億の位'],
    hint: ['右から 4けたずつ「万・億・兆」と 区切ってみよう。', '1 4294 0000 0000 → 1は 兆の部屋の 一の位、つまり 一兆の位だね。'],
  }),
  t('1429400000000 の「2」は 何の位ですか。', '百億の位', {
    options: ['百億の位', '十億の位', '千億の位', '一億の位'],
    hint: ['1 4294 0000 0000 と 区切ると、2は 億の部屋の 百の位だよ。'],
  }),
  t('79 2000 0000(七億九千二百万)の「9」は、何が 9こ あることを 表していますか。', '1000万', {
    options: ['1000万', '100万', '1億', '10億'],
    hint: ['9は 千万の位に あるね。', '1000万が 9こで 9000万だよ。'],
  }),
  t('35 9480 0000 0000(三十五兆九千四百八十億)の「3」は、何が 3こ あることを 表していますか。', '10兆', {
    options: ['10兆', '1兆', '1000億', '100億'],
    hint: ['3は 十兆の位に あるよ。10兆が 3こ分だね。'],
  }),
  t('9876543210 の「8」は 何の位ですか。', '億の位', {
    options: ['億の位', '十億の位', '千万の位', '百万の位'],
    hint: ['98 7654 3210 と 区切ろう。8は 億の部屋の 一の位だね。'],
  }),
];
// 追加15問: (数, 右から数えた位置index, 出題形式)を関数で処理
type KuraiSpec = { n: number; index: number; form: 'place' | 'quantity' };
const kuraiSpecs: KuraiSpec[] = [
  { n: 8000000000000, index: 12, form: 'place' },       // 8兆 の「8」
  { n: 6200000000, index: 9, form: 'place' },            // 62億 の「6」
  { n: 90000000, index: 7, form: 'place' },              // 9000万 の「9」
  { n: 135000000, index: 8, form: 'quantity' },          // 1億3500万 の「1」
  { n: 4008000000000, index: 12, form: 'place' },        // 4兆80億 の「4」
  { n: 4008000000000, index: 9, form: 'quantity' },      // 4兆80億 の「8」
  { n: 3005600000000, index: 11, form: 'place' },        // 3兆5億6000万 の「5」
  { n: 700000000, index: 8, form: 'quantity' },          // 7億 の「7」
  { n: 50000000000000, index: 13, form: 'place' },       // 50兆 の「5」
  { n: 9999900000000, index: 12, form: 'quantity' },     // 9兆9999億9000万 の「9」(兆の位)
  { n: 90000010000, index: 4, form: 'place' },           // 9兆1万 の「1」
  { n: 24000500000, index: 9, form: 'place' },           // 240億50万 の「4」
  { n: 6003700000000, index: 11, form: 'quantity' },     // 6兆3億700万 の「3」
  { n: 3600000000, index: 9, form: 'place' },            // 36億 の「6」
  { n: 8100000000000, index: 12, form: 'quantity' },     // 8兆1000億 の「8」
];
const digitAt = (n: number, index: number): string => {
  const s = String(n);
  const pos = s.length - 1 - index;
  return pos >= 0 ? s[pos] : '0';
};
const kuraiExtra: Problem[] = kuraiSpecs.map(({ n, index, form }) => {
  const d = digitAt(n, index);
  if (form === 'place') {
    const ans = placeName(index);
    const options = [placeName(index), placeName(Math.max(0, index - 1)), placeName(index + 1), placeName(Math.max(0, index - 4))];
    return t(`${n}(${numberToKanji(n)}) の「${d}」は 何の位ですか。`, ans, {
      options: [...new Set(options)].slice(0, 4),
      hint: ['右から 4けたずつ 区切って「万・億・兆」の 部屋を さがそう。', `${formatMixedJP(n)} の 中で、${d}は ${ans}に あるね。`],
    });
  }
  const ans = quantityLabel(index);
  return t(`${n}(${numberToKanji(n)}) の「${d}」は、何が ${d}こ あることを 表していますか。`, ans, {
    options: [quantityLabel(index), quantityLabel(Math.max(0, index - 4)), quantityLabel(index + 4), quantityLabel(Math.max(0, index - 1))].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4),
    hint: [`${d}は ${placeName(index)}に あるね。`, `${quantityLabel(index)}が ${d}こで ${formatMixedJP(Number(d) * 10 ** index)}だよ。`],
  });
});
const kurai: Problem[] = [...kuraiBase, ...kuraiExtra];

// ---- いろいろな見方 ----
const mikataBase: Problem[] = [
  t('17兆2000億は、100億を 何こ 集めた数ですか。', '1720', {
    hint: ['17兆2000億 = 17 2000 0000 0000。', '100億 = 100 0000 0000。0を 10こ とって くらべると 1720こ分だね。'],
  }),
  t('17兆2000億は、10兆を 1こ、1兆を 7こ、1000億を 何こ あわせた数ですか。', '2', {
    hint: ['10兆 + 7兆 = 17兆。のこりは 2000億。', '1000億が 2こで 2000億だね。'],
  }),
  t('17兆2000億は、1720億を 何倍した数ですか。', '100', {
    hint: ['1720億 → 17兆2000億 は 0が 2こ ふえているよ。', '10倍の10倍 = 100倍だね。'],
  }),
  t('3000億は、100億を 何こ 集めた数ですか。', '30', {
    hint: ['100億の 10こ分が 1000億。', '1000億が 3つ分だから 30こだね。'],
  }),
  t('5兆は、1000億を 何こ 集めた数ですか。', '50', {
    hint: ['1000億が 10こで 1兆。', '1兆が 5こなら 10×5 = 50こだね。'],
  }),
  t('26億は、1億を 何こ 集めた数ですか。', '26', {
    hint: ['「○億」は 1億が ○こ という意味だよ。'],
  }),
];
// 追加14問: (V, B) = V は B を何こ集めた数か
const mikataPairs: [number, number][] = [
  [4500000000, 1e7], [72000000000, 1e9], [6300000000000, 1e11], [8e12, 1e10],
  [2500000000000, 1e9], [9400000000, 1e6], [6e11, 1e8], [120000000000, 1e10],
  [3500000000000, 1e11], [48e12, 1e12], [9900000000, 1e7], [5e13, 1e10],
  [3e11, 1e7], [76000000000, 1e8],
];
const mikataExtra: Problem[] = mikataPairs.map(([v, b]) => {
  const ans = v / b;
  return t(`${formatMixedJP(v)}は、${formatMixedJP(b)}を 何こ 集めた数ですか。`, String(ans), {
    hint: ['大きい数どうしの わり算と 同じように 考えよう。', `${formatMixedJP(v)} ÷ ${formatMixedJP(b)} = ${ans}こ だね。`],
  });
});
const mikataArr: Problem[] = [...mikataBase, ...mikataExtra];

// ---- 数直線(億・兆) ----
const suuchokusenBase: Problem[] = [
  t('数直線の ↓の目もりが 表す数を 書きましょう。', '700億', {
    svg: labeledNumberLineSvg(11, { 0: '0', 1: '100億', 10: '1000億' }, 7),
    hint: ['1目もりは 100億だね。', '0から 7目もり分で 700億だよ。'],
  }),
  t('数直線の ↓の目もりが 表す数を 書きましょう。', '1兆4000億', {
    svg: labeledNumberLineSvg(11, { 0: '5000億', 5: '1兆' }, 9),
    hint: ['5000億から 1兆までが 5目もりだから、1目もりは 1000億。', '1兆から 4目もり右で 1兆4000億だね。'],
  }),
  t('数直線の ↓の目もりが 表す数を 書きましょう。', '300億', {
    svg: labeledNumberLineSvg(11, { 0: '0', 5: '500億', 10: '1000億' }, 3),
    hint: ['0から 500億までが 5目もり。1目もりは 100億だね。'],
  }),
  t('数直線の ↓の目もりが 表す数を 書きましょう。', '2兆5000億', {
    svg: labeledNumberLineSvg(11, { 0: '2兆', 10: '3兆' }, 5),
    hint: ['2兆から 3兆までが 10目もりだから、1目もりは 1000億。', 'まん中は 2兆5000億だね。'],
  }),
  t('数直線の ↓の目もりが 表す数を 書きましょう。', '8000万', {
    svg: labeledNumberLineSvg(11, { 0: '0', 10: '1億' }, 8),
    hint: ['0から 1億までが 10目もり。1目もりは 1000万だね。', '8目もり分で 8000万。'],
  }),
];
// 追加15問: (1目もりの大きさ, 目もりの数, ↓の位置)
const lineSpecs: [number, number, number][] = [
  [1e8, 8, 3], [1e9, 10, 4], [1e10, 9, 5], [1e11, 10, 7], [1e12, 8, 3],
  [1e7, 10, 6], [1e6, 10, 9], [5e9, 10, 7], [2e11, 10, 3], [25e7, 4, 3],
  [3e10, 6, 5], [4e12, 5, 2], [6e6, 10, 7], [15e9, 8, 5], [12e11, 10, 9],
];
const suuchokusenExtra: Problem[] = lineSpecs.map(([unit, ticks, point]) => {
  const total = formatMixedJP(unit * ticks);
  const ans = formatMixedJP(unit * point);
  return t('数直線の ↓の目もりが 表す数を 書きましょう。', ans, {
    svg: labeledNumberLineSvg(ticks + 1, { 0: '0', [ticks]: total }, point),
    hint: [`0から ${total}までが ${ticks}目もり。1目もりは ${formatMixedJP(unit)}だね。`, `0から ${point}目もり分で ${ans}だよ。`],
  });
});
const suuchokusen: Problem[] = [...suuchokusenBase, ...suuchokusenExtra];

// ---- 10倍・1/10(計算系: 30問) ----
const scaleCombos: [number, number, number][] = [
  [0, 3, 0], [0, 45, 0], [0, 0, 720], [0, 0, 8500], [1, 0, 0], [2, 50, 0],
  [0, 600, 0], [0, 9, 4000], [0, 0, 150], [3, 0, 0], [0, 72, 300], [0, 0, 60],
  [5, 800, 0], [0, 15, 0], [0, 0, 9990], [7, 0, 500], [0, 220, 0], [0, 0, 45],
  [9, 100, 0], [0, 3, 700], [4, 0, 0], [0, 66, 0], [0, 0, 999], [8, 250, 0],
];
const scaleBases: number[] = scaleCombos.map(([c, o, m]) => fromCombo(c, o, m));

const juubaiBase: [string, string][] = [
  ['18億', '180億'], ['7000億', '7兆'], ['34億', '340億'], ['600億', '6000億'], ['9500万', '9億5000万'], ['2兆', '20兆'],
];
const juubaiExtra: [string, string][] = scaleBases.map((base) => [formatMixedJP(base), formatMixedJP(base * 10)]);
const juubai: Problem[] = [...juubaiBase, ...juubaiExtra].map(([from, to]) =>
  t(`${from} を 10倍した数を 書きましょう。`, to, {
    hint: ['10倍すると 位が 1つ 上がるよ(0が 1こ ふえる)。', `${from} → ${to} だね。`],
  }),
);

const juubunnoichiBase: [string, string][] = [
  ['600億', '60億'], ['4兆', '4000億'], ['300億', '30億'], ['5000万', '500万'], ['1兆2000億', '1200億'], ['70億', '7億'],
];
const juubunnoichiExtra: [string, string][] = scaleBases.map((base) => [formatMixedJP(base * 10), formatMixedJP(base)]);
const juubunnoichi: Problem[] = [...juubunnoichiBase, ...juubunnoichiExtra].map(([from, to]) =>
  t(`${from} を 10分の1(1/10)にした数を 書きましょう。`, to, {
    hint: ['10分の1に すると 位が 1つ 下がるよ(0が 1こ へる)。', `${from} → ${to} だね。`],
  }),
);

// ---- 3けた×3けたのかけ算(計算系: 30問) ----
const kakezan3Pairs: [number, number][] = [
  [482, 156], [243, 713], [673, 806], [590, 307], [325, 248], [417, 632], [508, 194], [736, 425], [268, 914], [705, 463], [381, 527], [649, 208],
  [157, 624], [298, 451], [812, 137], [349, 586], [923, 214], [461, 738], [605, 192], [287, 943], [734, 356], [198, 867], [542, 671], [876, 239],
  [315, 498], [689, 124], [453, 782], [921, 167], [264, 839], [578, 316],
];
const kakezan3: Problem[] = kakezan3Pairs.map(([a, b]) => guidedMul(a, b));

// ---- 末尾に0のあるかけ算(計算系: 30問) ----
const matsubi0Pairs: [number, number][] = [
  [2700, 50], [430, 6800], [3600, 40], [520, 3000], [890, 700], [4500, 60], [1800, 400], [260, 9000],
  [3200, 70], [150, 4600], [7200, 30], [840, 5000], [960, 700], [2100, 80], [330, 7500], [6400, 50],
  [190, 8200], [4700, 60], [520, 9300], [380, 6600], [8100, 40], [270, 5900], [950, 3400], [610, 7800],
  [3300, 90], [420, 8600], [7600, 50], [240, 6900], [890, 4100], [560, 7200],
];
const matsubi0: Problem[] = matsubi0Pairs.map(([a, b]) => {
  const za = String(a).match(/0+$/)?.[0].length ?? 0;
  const zb = String(b).match(/0+$/)?.[0].length ?? 0;
  const ca = a / 10 ** za;
  const cb = b / 10 ** zb;
  return t(`くふうして 計算しましょう。 ${a} × ${b} =`, String(a * b), {
    hint: [
      `終わりの 0を とって ${ca} × ${cb} を 先に 計算しよう。`,
      `${ca} × ${cb} = ${ca * cb}。とった 0を ${za + zb}こ つけもどして ${a * b} だね。`,
    ],
  });
});

// ---- 数字カードで整数づくり ----
/** 数字カードの集合から作れる最大・最小の整数(先頭は0不可)を求める */
const digitCards = (digits: number[]) => {
  const sorted = [...digits].sort((a, b) => a - b);
  const largestArr = [...sorted].reverse();
  const smallestArr = [...sorted];
  if (smallestArr[0] === 0) {
    const idx = smallestArr.findIndex((d) => d !== 0);
    if (idx > 0) { const tmp = smallestArr[0]; smallestArr[0] = smallestArr[idx]; smallestArr[idx] = tmp; }
  }
  return { largest: largestArr.join(''), smallest: smallestArr.join('') };
};
/** 末尾2けたを入れかえた「2ばんめ」の数 */
const swapLastTwo = (s: string): string => s.length < 2 ? s : s.slice(0, -2) + s[s.length - 1] + s[s.length - 2];

const seisuuzukuriBase: Problem[] = [
  t('0〜9の 数字カードを 1回ずつ 使って、いちばん大きい 10けたの整数を つくりましょう。', '9876543210', {
    options: ['9876543210', '9876543201', '9087654321', '9998765432'],
    hint: ['大きい数字から じゅんに 左から ならべよう。'],
  }),
  t('0〜9の 数字カードを 1回ずつ 使って、いちばん小さい 10けたの整数を つくりましょう。', '1023456789', {
    options: ['1023456789', '0123456789', '1234567890', '1032456789'],
    hint: ['いちばん上の位に 0は 使えないよ。', '1を 先頭に、次に 0、あとは 小さい順だね。'],
  }),
  t('0〜9の 数字カードを 1回ずつ 使って、2ばんめに 大きい 10けたの整数を つくりましょう。', '9876543201', {
    options: ['9876543201', '9876543210', '9876543120', '8976543210'],
    hint: ['いちばん大きいのは 9876543210。', '2ばんめは 終わりの 10 を 01 に 入れかえた数だよ。'],
  }),
  t('0〜9の 数字カードを 1回ずつ 使って、2ばんめに 小さい 10けたの整数を つくりましょう。', '1023456798', {
    options: ['1023456798', '1023456789', '1023456879', '1032456789'],
    hint: ['いちばん小さいのは 1023456789。', '終わりの 89 を 98 に 入れかえると 2ばんめだね。'],
  }),
  t('5、2、8、0 の 4まいのカードを 1回ずつ 使って、いちばん大きい 4けたの整数を つくりましょう。', '8520', {
    hint: ['大きい数字から じゅんに ならべよう。8 → 5 → 2 → 0 だね。'],
  }),
  t('5、2、8、0 の 4まいのカードを 1回ずつ 使って、いちばん小さい 4けたの整数を つくりましょう。', '2058', {
    hint: ['先頭に 0は 使えないよ。', '0以外で いちばん小さい 2を 先頭に、次に 0 → 5 → 8 だね。'],
  }),
];
// 追加14問: 4けたセット×2(大小) + 6けたセット×2(大小) + 5けたセット2ばんめ×2
const cardSets4: number[][] = [[7, 1, 4, 9], [6, 0, 3, 5], [9, 2, 8, 1], [4, 7, 0, 6]];
const cardSets4Extra: Problem[] = cardSets4.flatMap((digits) => {
  const { largest, smallest } = digitCards(digits);
  const list = [...digits].sort((a, b) => b - a).join('、');
  return [
    t(`${list} の 4まいのカードを 1回ずつ 使って、いちばん大きい 4けたの整数を つくりましょう。`, largest, {
      hint: ['大きい数字から じゅんに ならべよう。'],
    }),
    t(`${list} の 4まいのカードを 1回ずつ 使って、いちばん小さい 4けたの整数を つくりましょう。`, smallest, {
      hint: digits.includes(0)
        ? ['先頭に 0は 使えないよ。', '0以外で いちばん小さい数字を 先頭に、あとは 小さい じゅんに ならべよう。']
        : ['小さい数字から じゅんに ならべよう。'],
    }),
  ];
});
const cardSets6: number[][] = [[1, 3, 5, 7, 9, 0], [2, 4, 6, 8, 0, 9]];
const cardSets6Extra: Problem[] = cardSets6.flatMap((digits) => {
  const { largest, smallest } = digitCards(digits);
  const list = [...digits].sort((a, b) => b - a).join('、');
  return [
    t(`${list} の 6まいのカードを 1回ずつ 使って、いちばん大きい 6けたの整数を つくりましょう。`, largest, {
      hint: ['大きい数字から じゅんに ならべよう。'],
    }),
    t(`${list} の 6まいのカードを 1回ずつ 使って、いちばん小さい 6けたの整数を つくりましょう。`, smallest, {
      hint: ['先頭に 0は 使えないよ。', '0以外で いちばん小さい数字を 先頭に、あとは 小さい じゅんに ならべよう。'],
    }),
  ];
});
const cardSets2nd: number[][] = [[2, 9, 4, 6, 1]];
const cardSets2ndExtra: Problem[] = cardSets2nd.flatMap((digits) => {
  const { largest, smallest } = digitCards(digits);
  const list = [...digits].sort((a, b) => b - a).join('、');
  return [
    t(`${list} の 5まいのカードを 1回ずつ 使って、2ばんめに 大きい 5けたの整数を つくりましょう。`, swapLastTwo(largest), {
      hint: [`いちばん大きい数は ${largest}。`, '終わりの 2けたを 入れかえると 2ばんめに 大きい数に なるよ。'],
    }),
    t(`${list} の 5まいのカードを 1回ずつ 使って、2ばんめに 小さい 5けたの整数を つくりましょう。`, swapLastTwo(smallest), {
      hint: [`いちばん小さい数は ${smallest}。`, '終わりの 2けたを 入れかえると 2ばんめに 小さい数に なるよ。'],
    }),
  ];
});
const seisuuzukuri: Problem[] = [...seisuuzukuriBase, ...cardSets4Extra, ...cardSets6Extra, ...cardSets2ndExtra];

export const bigNumberProblems: Record<string, Problem[]> = {
  '大きい数のよみかき': yomikaki,
  '何の位・いくつ分': kurai,
  '大きい数のいろいろな見方': mikataArr,
  '数直線(億・兆)': suuchokusen,
  '10倍した数': juubai,
  '10分の1にした数': juubunnoichi,
  '3けた×3けたのかけ算': kakezan3,
  '末尾に0のあるかけ算': matsubi0,
  '数字カードで整数づくり': seisuuzukuri,
};
