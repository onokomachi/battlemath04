
import type { ProblemCard, Category, Ability, AbilityType, DailyQuestDef, BadgeDef, ShopItemDef, TitleDef } from './types';
import {
  fractionBasicsProblems,
  fractionKindsProblems,
  fractionConversionProblems,
  fractionSizeProblems,
  fractionAdditionProblems,
  fractionSubtractionProblems,
  fractionApplicationProblems,
} from './data/fractionProblems';
import { bigNumberProblems } from './data/bigNumberProblems';
import { graphTableProblems } from './data/graphTableProblems';
import { division1Problems, division2Problems } from './data/divisionProblems';
import { angleProblems } from './data/angleProblems';
import { decimalProblems, decimalMulDivProblems } from './data/decimalProblems';
import { roundingProblems } from './data/roundingProblems';
import { calcRulesProblems, areaProblems, changeProblems, solidProblems } from './data/mixedUnitsProblems';
import { ratioProblems } from './data/ratioProblems';

export const DEFAULT_SCHOOL_YEAR = 2025;

// 自校のみの簡易ログイン用(学校選択は行わない)。
// 学校名は環境変数 VITE_SCHOOL_NAME で差し替え可能。学年は4で固定。
export const SCHOOL_NAME: string =
  (import.meta as any).env?.VITE_SCHOOL_NAME || '小学校';
export const TARGET_GRADE = 4;

export const getCurrentSchoolYear = (): number => {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

export const MAX_SCORE = 5;
export const DECK_SIZE = 20;
export const HAND_SIZE = 5;
export const MAX_DUPLICATES = 2;

// HP Battle System (aicardbattle2 integration)
// エビデンスA: Testing Effect (Roediger & Butler 2011) — 想起回数が学習効果に比例
// HP40 + 新ダメージ式 → 平均7-8ラウンド/試合（旧: 2-3ラウンド）
export const INITIAL_HP = 40;

// Damage formula: difficulty × 1.5 + 1
// Lv1=2.5→3, Lv2=4, Lv3=5.5→6, Lv4=7, Lv5=8.5→9
// HP40 ÷ 平均5.5dmg ≈ 7.3ラウンド（学習量2-3倍に増加）
export const calcDamage = (difficulty: number): number =>
  Math.round(difficulty * 1.5 + 1);

// Admin settings
// 管理画面アクセスはこのメールアドレスのGoogleログインのみ。
// クライアント側の判定はUI制御にすぎないため、実効的な保護は
// firestore.rules の isAdmin() と必ず同期させること。
export const ADMIN_EMAILS: string[] = ['ono.yosuke@isesaki-school.ed.jp'];

export const DECK_CONSTRAINTS: Record<number, number> = {
  4: 7,
  5: 3,
};

// 小学4年算数の全単元(東京書籍『新編 新しい算数 4上・4下』の単元順)。
// わり算筆算・がい数・小数・倍の見方は参照リポジトリ(wari-hissann3 /
// syo4-gaisu / syo4-syousu / syo4-bainomikata)の問題項目を移植。
// 設計根拠: docs/DESIGN.md
export const MATH_CATEGORIES: Category[] = [
    {
        name: "大きい数のしくみ",
        groups: [
            { name: "よみかき・しくみ", subtopics: ["大きい数のよみかき", "何の位・いくつ分", "大きい数のいろいろな見方"] },
            { name: "数直線と10倍・1/10", subtopics: ["数直線(億・兆)", "10倍した数", "10分の1にした数"] },
            { name: "かけ算と整数づくり", subtopics: ["3けた×3けたのかけ算", "末尾に0のあるかけ算", "数字カードで整数づくり"] }
        ]
    },
    {
        name: "折れ線グラフと表",
        groups: [
            { name: "折れ線グラフ", subtopics: ["折れ線グラフのよみとり", "変わり方の大きさ", "グラフのくふう"] },
            { name: "表の整理", subtopics: ["二次元表のよみとり", "二次元表に整理する", "組み合わせグラフ"] }
        ]
    },
    {
        name: "わり算の筆算(÷1けた)",
        groups: [
            { name: "あんざんと筆算", subtopics: ["九九のはんい", "あまりのあるわり算", "何十のわり算", "何百のわり算", "2けた÷1けた", "3けた÷1けた", "商に0がたつわり算"] },
            { name: "わり算のきまり", subtopics: ["何十÷何十", "何百÷何百", "あまりにちゅうい", "くふうして筆算", "あまりのわなを見ぬけ", "商が等しい式をさがせ", "□にあてはまる数(わり算)"] },
            { name: "たしかめ算", subtopics: ["わりきれるとき", "あまりのあるとき", "大きな数でちょうせん", "けん算の式を書く", "ある数をもとめる"] },
            { name: "文章題", subtopics: ["同じ数ずつ分ける", "いくつ分とれる", "あまりのあるもんだい", "あまりを切り上げる", "あまりを切り捨てる"] }
        ]
    },
    {
        name: "角の大きさ",
        groups: [
            { name: "角のよみとり", subtopics: ["分度器と角", "交わる直線の角"] },
            { name: "角の計算", subtopics: ["180°をこえる角", "三角じょうぎの角"] }
        ]
    },
    {
        name: "小数のしくみ",
        groups: [
            { name: "小数の位取り", subtopics: ["数をつくる", "あつめた数", "何十倍・何分の一", "○の位の数字は"] },
            { name: "数直線と大小", subtopics: ["数直線を読む", "大小をくらべよう", "小数をならべかえよう"] },
            { name: "単位と小数", subtopics: ["長さの単位を小数で", "重さの単位を小数で"] },
            { name: "たし算・ひき算", subtopics: ["小数のたし算(同じ位)", "小数のたし算(けたがちがう)", "小数のひき算(同じ位)", "小数のひき算(けたがちがう)", "小数のひき算(空位に注意)", "小数のたし算の文章題", "小数のひき算の文章題"] }
        ]
    },
    {
        name: "わり算の筆算(÷2けた)",
        groups: [
            { name: "見当づけと筆算", subtopics: ["どの位にたつ", "商は何けた", "仮の商の見当", "□に入る数字は", "2けた÷2けた", "3けた÷2けた"] },
            { name: "考える問題", subtopics: ["仮の商の修正", "何倍かをもとめる(わり算)", "大きな数のもんだい"] }
        ]
    },
    {
        name: "がい数",
        groups: [
            { name: "がい数のいみ", subtopics: ["大きな数を「約何万」で", "「約何千」で表そう", "がい数をつかう場面は？"] },
            { name: "四捨五入でがい数に", subtopics: ["指定の位までのがい数", "上から1けたのがい数", "上から2けたのがい数", "2つの条件に合う数は？"] },
            { name: "もとの数のはんい", subtopics: ["十の位までのはんい", "百の位までのはんい", "千の位までのはんい"] },
            { name: "和や差の見積もり", subtopics: ["たし算の見積もり", "ひき算の見積もり", "3つの数の見積もり"] },
            { name: "積や商の見積もり", subtopics: ["かけ算の見積もり", "わり算の見積もり", "文章題で見積もり"] },
            { name: "切り上げ・切り捨てで考えよう", subtopics: ["切り上げ・切り捨てのれんしゅう", "どの見積もり方がいい？", "予算で考えよう"] }
        ]
    },
    {
        name: "計算のきまり",
        groups: [
            { name: "きまりとくふう", subtopics: ["計算の順じょ", "計算のくふう"] }
        ]
    },
    {
        name: "面積",
        groups: [
            { name: "長方形と正方形", subtopics: ["長方形の面積", "正方形の面積", "辺の長さを求める"] },
            { name: "大きな面積とくふう", subtopics: ["大きな面積の単位", "L字型の面積"] }
        ]
    },
    {
        name: "小数のかけ算とわり算",
        groups: [
            { name: "かけ算", subtopics: ["小数×整数(小数第一位)", "小数×整数(小数第二位)"] },
            { name: "わり算", subtopics: ["小数÷整数(小数第一位)", "小数÷整数(小数第二位)", "わり進むわり算", "商とあまり(小数)"] },
            { name: "文章題", subtopics: ["小数×の文章題", "小数÷の文章題"] }
        ]
    },
    {
        name: "分数",
        groups: [
            { name: "分数のきほん(3年)", subtopics: ["分数のよみかき", "単位分数のいくつ分", "1をつくる分数", "たし算のふくしゅう", "ひき算のふくしゅう"] },
            { name: "いろいろな分数と数直線", subtopics: ["真分数・仮分数・帯分数", "帯分数のよみとり", "数直線をよむ(1まで)", "数直線をよむ(1より大きい)"] },
            { name: "仮分数と帯分数", subtopics: ["仮分数を帯分数に(基本)", "仮分数を帯分数に(標準)", "仮分数と整数", "帯分数を仮分数に(基本)", "帯分数を仮分数に(標準)"] },
            { name: "大きさと等しい分数", subtopics: ["同じ分母の大小", "仮分数と帯分数の大小", "単位分数の大小", "等しい分数(数直線)"] },
            { name: "分数のたし算", subtopics: ["和が1をこえるたし算", "和が整数になるたし算", "帯分数+真分数", "帯分数+帯分数", "くり上がりのあるたし算"] },
            { name: "分数のひき算", subtopics: ["1や整数からひく", "仮分数のひき算", "帯分数−真分数", "くり下がりのあるひき算"] },
            { name: "文しょうだいと活用", subtopics: ["たし算の文しょうだい", "ひき算の文しょうだい", "まちがい探し", "整数になる分数"] }
        ]
    },
    {
        name: "変わり方調べ",
        groups: [
            { name: "変わり方", subtopics: ["変わり方と表"] }
        ]
    },
    {
        name: "直方体と立方体",
        groups: [
            { name: "形のせいしつ", subtopics: ["面・辺・頂点", "展開図"] },
            { name: "垂直・平行と位置", subtopics: ["面や辺の垂直・平行", "位置の表し方"] }
        ]
    },
    {
        name: "倍の見方",
        groups: [
            { name: "倍の三用法(きほん)", subtopics: ["何倍かを求める(きほん)", "くらべられる量を求める(きほん)", "もとにする量を求める(きほん)"] },
            { name: "倍の三用法(大きな数)", subtopics: ["何倍かを求める(大きな数)", "くらべられる量を求める(大きな数)", "もとにする量を求める(大きな数)"] },
            { name: "割合の見方", subtopics: ["割合でくらべる(きほん)", "割合でくらべる(差のわな)"] },
            { name: "文章題", subtopics: ["倍の文章題(何倍か)", "倍の文章題(くらべられる量)", "倍の文章題(もとにする量)", "倍の文章題(割合でくらべる)"] },
            { name: "まちがいをなおそう", subtopics: ["まちがいをなおそう(倍の見方)"] }
        ]
    }
];

/**
 * 単元名 → 内部キー(バッジID・分析データのフィールド名に使用)。
 * ワールド番号は MATH_CATEGORIES の並び順(=学習順)と一致する。
 */
export const UNIT_KEYS: Record<string, string> = {
  '大きい数のしくみ': 'bignum',
  '折れ線グラフと表': 'graph',
  'わり算の筆算(÷1けた)': 'div1',
  '角の大きさ': 'angle',
  '小数のしくみ': 'decimal',
  'わり算の筆算(÷2けた)': 'div2',
  'がい数': 'rounding',
  '計算のきまり': 'calcrules',
  '面積': 'area',
  '小数のかけ算とわり算': 'decmuldiv',
  '分数': 'fraction',
  '変わり方調べ': 'change',
  '直方体と立方体': 'solid',
  '倍の見方': 'ratio',
};

// 難度1〜5: カードバトルのダメージ(calcDamage)とデッキ制約(DECK_CONSTRAINTS)に接続。
export const difficultyMap: Record<string, number> = {
    // --- 大きい数のしくみ ---
    "大きい数のよみかき": 2, "何の位・いくつ分": 1, "大きい数のいろいろな見方": 4,
    "数直線(億・兆)": 3, "10倍した数": 2, "10分の1にした数": 2,
    "3けた×3けたのかけ算": 3, "末尾に0のあるかけ算": 3, "数字カードで整数づくり": 4,

    // --- 折れ線グラフと表 ---
    "折れ線グラフのよみとり": 2, "変わり方の大きさ": 3, "グラフのくふう": 4,
    "二次元表のよみとり": 2, "二次元表に整理する": 3, "組み合わせグラフ": 4,

    // --- わり算の筆算(÷1けた) ---
    "九九のはんい": 1, "あまりのあるわり算": 1, "何十のわり算": 2, "何百のわり算": 2,
    "2けた÷1けた": 2, "3けた÷1けた": 3, "商に0がたつわり算": 4,
    "何十÷何十": 2, "何百÷何百": 3, "あまりにちゅうい": 4, "くふうして筆算": 3,
    "あまりのわなを見ぬけ": 4, "商が等しい式をさがせ": 4, "□にあてはまる数(わり算)": 4,
    "わりきれるとき": 2, "あまりのあるとき": 3, "大きな数でちょうせん": 4,
    "けん算の式を書く": 4, "ある数をもとめる": 4,
    "同じ数ずつ分ける": 2, "いくつ分とれる": 2, "あまりのあるもんだい": 3,
    "あまりを切り上げる": 4, "あまりを切り捨てる": 4,

    // --- 角の大きさ ---
    "分度器と角": 1, "交わる直線の角": 2, "180°をこえる角": 3, "三角じょうぎの角": 4,

    // --- 小数のしくみ ---
    "数をつくる": 2, "あつめた数": 2, "何十倍・何分の一": 2, "○の位の数字は": 2,
    "数直線を読む": 2, "大小をくらべよう": 2, "小数をならべかえよう": 3,
    "長さの単位を小数で": 3, "重さの単位を小数で": 3,
    "小数のたし算(同じ位)": 3, "小数のたし算(けたがちがう)": 3,
    "小数のひき算(同じ位)": 3, "小数のひき算(けたがちがう)": 3, "小数のひき算(空位に注意)": 4,
    "小数のたし算の文章題": 4, "小数のひき算の文章題": 4,

    // --- わり算の筆算(÷2けた) ---
    "どの位にたつ": 3, "商は何けた": 3, "仮の商の見当": 3, "□に入る数字は": 5,
    "2けた÷2けた": 3, "3けた÷2けた": 4,
    "仮の商の修正": 4, "何倍かをもとめる(わり算)": 4, "大きな数のもんだい": 4,

    // --- がい数 ---
    "大きな数を「約何万」で": 1, "「約何千」で表そう": 1, "がい数をつかう場面は？": 2,
    "指定の位までのがい数": 2, "上から1けたのがい数": 3, "上から2けたのがい数": 3, "2つの条件に合う数は？": 4,
    "十の位までのはんい": 3, "百の位までのはんい": 3, "千の位までのはんい": 4,
    "たし算の見積もり": 3, "ひき算の見積もり": 3, "3つの数の見積もり": 4,
    "かけ算の見積もり": 4, "わり算の見積もり": 4, "文章題で見積もり": 5,
    "切り上げ・切り捨てのれんしゅう": 3, "どの見積もり方がいい？": 4, "予算で考えよう": 5,

    // --- 計算のきまり ---
    "計算の順じょ": 3, "計算のくふう": 4,

    // --- 面積 ---
    "長方形の面積": 2, "正方形の面積": 2, "辺の長さを求める": 3, "大きな面積の単位": 4, "L字型の面積": 4,

    // --- 小数のかけ算とわり算 ---
    "小数×整数(小数第一位)": 3, "小数×整数(小数第二位)": 3,
    "小数÷整数(小数第一位)": 3, "小数÷整数(小数第二位)": 3, "わり進むわり算": 4, "商とあまり(小数)": 4,
    "小数×の文章題": 4, "小数÷の文章題": 4,

    // --- 分数 ---
    "分数のよみかき": 1, "単位分数のいくつ分": 1, "1をつくる分数": 1,
    "たし算のふくしゅう": 2, "ひき算のふくしゅう": 2,
    "真分数・仮分数・帯分数": 1, "帯分数のよみとり": 2,
    "数直線をよむ(1まで)": 2, "数直線をよむ(1より大きい)": 3,
    "仮分数を帯分数に(基本)": 2, "仮分数を帯分数に(標準)": 3, "仮分数と整数": 2,
    "帯分数を仮分数に(基本)": 2, "帯分数を仮分数に(標準)": 3,
    "同じ分母の大小": 1, "仮分数と帯分数の大小": 3, "単位分数の大小": 3, "等しい分数(数直線)": 3,
    "和が1をこえるたし算": 3, "和が整数になるたし算": 3,
    "帯分数+真分数": 3, "帯分数+帯分数": 4, "くり上がりのあるたし算": 5,
    "1や整数からひく": 3, "仮分数のひき算": 4,
    "帯分数−真分数": 3, "くり下がりのあるひき算": 5,
    "たし算の文しょうだい": 4, "ひき算の文しょうだい": 4, "まちがい探し": 4, "整数になる分数": 3,

    // --- 変わり方調べ ---
    "変わり方と表": 3,

    // --- 直方体と立方体 ---
    "面・辺・頂点": 1, "展開図": 3, "面や辺の垂直・平行": 3, "位置の表し方": 2,

    // --- 倍の見方 ---
    "何倍かを求める(きほん)": 2, "くらべられる量を求める(きほん)": 2, "もとにする量を求める(きほん)": 3,
    "何倍かを求める(大きな数)": 3, "くらべられる量を求める(大きな数)": 3, "もとにする量を求める(大きな数)": 4,
    "割合でくらべる(きほん)": 4, "割合でくらべる(差のわな)": 5,
    "倍の文章題(何倍か)": 3, "倍の文章題(くらべられる量)": 3, "倍の文章題(もとにする量)": 4, "倍の文章題(割合でくらべる)": 5,
    "まちがいをなおそう(倍の見方)": 4,
};

const getDifficulty = (category: string): number => {
    return difficultyMap[category] || 3;
};

const ABILITIES: Ability[] = [
    { type: 'DEFENSIVE_STANCE', description: '[防御] このラウンドで敗北しても失点しない。' },
    { type: 'TIME_PRESSURE', value: 3, description: '[速攻] 相手の解答時間を3秒短縮する。' },
    { type: 'SCORE_BOOST', value: 1, description: '[激励] このラウンドで勝利した場合、追加で1スコアを得る。' },
];

/**
 * 能力の付与は id から決まる決定的なハッシュで行う。
 * (Math.random だとクライアントごとにカード能力が食いちがい、PvPで不整合が起きるため)
 */
const assignAbility = (card: ProblemCard): Ability | undefined => {
    if (card.difficulty < 3) return undefined;
    const abilityMap: { [key: string]: AbilityType[] } = {
        "大きい数のしくみ": ['SCORE_BOOST'],
        "折れ線グラフと表": ['DEFENSIVE_STANCE'],
        "わり算の筆算(÷1けた)": ['TIME_PRESSURE'],
        "角の大きさ": ['DEFENSIVE_STANCE'],
        "小数のしくみ": ['SCORE_BOOST'],
        "わり算の筆算(÷2けた)": ['TIME_PRESSURE', 'SCORE_BOOST'],
        "がい数": ['DEFENSIVE_STANCE', 'SCORE_BOOST'],
        "計算のきまり": ['TIME_PRESSURE'],
        "面積": ['DEFENSIVE_STANCE'],
        "小数のかけ算とわり算": ['TIME_PRESSURE'],
        "分数": ['TIME_PRESSURE', 'SCORE_BOOST'],
        "変わり方調べ": ['SCORE_BOOST'],
        "直方体と立方体": ['DEFENSIVE_STANCE'],
        "倍の見方": ['DEFENSIVE_STANCE', 'SCORE_BOOST'],
    };
    const possibleTypes = abilityMap[card.mainCategory];
    if (!possibleTypes) return undefined;
    const hash = (card.id * 2654435761) >>> 0;
    if (hash % 100 < 25) {
        const randomType = possibleTypes[hash % possibleTypes.length];
        return ABILITIES.find(a => a.type === randomType);
    }
    return undefined;
}

const processProblems = (): ProblemCard[] => {
    const allProblems: ProblemCard[] = [];
    let idCounter = 0;
    const fractionAll = {
        ...fractionBasicsProblems,
        ...fractionKindsProblems,
        ...fractionConversionProblems,
        ...fractionSizeProblems,
        ...fractionAdditionProblems,
        ...fractionSubtractionProblems,
        ...fractionApplicationProblems,
    };
    const sets = [
        { mainCat: "大きい数のしくみ", problems: bigNumberProblems },
        { mainCat: "折れ線グラフと表", problems: graphTableProblems },
        { mainCat: "わり算の筆算(÷1けた)", problems: division1Problems },
        { mainCat: "角の大きさ", problems: angleProblems },
        { mainCat: "小数のしくみ", problems: decimalProblems },
        { mainCat: "わり算の筆算(÷2けた)", problems: division2Problems },
        { mainCat: "がい数", problems: roundingProblems },
        { mainCat: "計算のきまり", problems: calcRulesProblems },
        { mainCat: "面積", problems: areaProblems },
        { mainCat: "小数のかけ算とわり算", problems: decimalMulDivProblems },
        { mainCat: "分数", problems: fractionAll },
        { mainCat: "変わり方調べ", problems: changeProblems },
        { mainCat: "直方体と立方体", problems: solidProblems },
        { mainCat: "倍の見方", problems: ratioProblems },
    ];
    for (const set of sets) {
        for (const category in set.problems) {
            const difficulty = getDifficulty(category);
            for (const problem of set.problems[category]) {
                const card: ProblemCard = {
                    id: idCounter++,
                    mainCategory: set.mainCat,
                    category,
                    difficulty,
                    problem,
                };
                card.ability = assignAbility(card);
                allProblems.push(card);
            }
        }
    }
    return allProblems;
}

export const CARD_DEFINITIONS: ProblemCard[] = processProblems();

// ============================
// Gamification Helpers
// ============================
export const getTodayStr = (): string => new Date().toISOString().slice(0, 10);

export const getWeekStart = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
};

// ============================
// Badge Definitions
// エビデンスB: 達成バッジ × 自己決定理論（有能感欲求）
// ============================
export const BADGE_DEFS: BadgeDef[] = [
  // --- 正解マイルストーン ---
  { id: 'first_correct', title: '初正解', description: 'はじめて問題に正解した', icon: '⭐' },
  { id: 'correct_50', title: '50問達成', description: '通算50問正解した', icon: '🎯' },
  { id: 'correct_100', title: '100問達成', description: '通算100問正解した', icon: '💯' },
  { id: 'correct_500', title: '500問達成', description: '通算500問正解した', icon: '🌟' },
  { id: 'correct_1000', title: '1000問達成', description: '通算1000問正解した', icon: '🏅' },
  // --- PvPバトル ---
  { id: 'first_pvp_win', title: '初勝利', description: 'はじめてPvPで勝利した', icon: '⚔️' },
  { id: 'pvp_10wins', title: 'PvP10勝', description: 'PvPで10勝した', icon: '🏆' },
  { id: 'pvp_50wins', title: 'PvP50勝', description: 'PvPで50勝した', icon: '🥇' },
  { id: 'first_cpu_win', title: 'CPU撃破', description: 'はじめてCPU戦に勝利した', icon: '🤖' },
  { id: 'perfect_battle', title: '完全勝利', description: 'HP満タンで勝利した', icon: '💎' },
  // --- ログインストリーク ---
  { id: 'streak_3', title: '3日連続', description: '3日連続でログインした', icon: '🔥' },
  { id: 'streak_7', title: '7日連続', description: '7日連続でログインした', icon: '🔥🔥' },
  { id: 'streak_14', title: '14日連続', description: '14日連続でログインした', icon: '🔥🔥🔥' },
  { id: 'streak_30', title: '30日連続', description: '30日連続でログインした', icon: '👑' },
  // --- 連鎖 ---
  { id: 'chain_5', title: '5連鎖', description: '5問連続正解した', icon: '⚡' },
  { id: 'chain_10', title: '10連鎖', description: '10問連続正解した', icon: '⚡⚡' },
  { id: 'chain_20', title: '20連鎖', description: '20問連続正解した', icon: '⚡⚡⚡' },
  // --- ワールドクリア(単元の全サブトピックで1問以上正解) ---
  { id: 'world_bignum', title: 'ワールド1 クリア', description: '大きい数のしくみの全単元で正解した', icon: '🚩' },
  { id: 'world_graph', title: 'ワールド2 クリア', description: '折れ線グラフと表の全単元で正解した', icon: '🚩' },
  { id: 'world_div1', title: 'ワールド3 クリア', description: 'わり算の筆算(÷1けた)の全単元で正解した', icon: '🚩' },
  { id: 'world_angle', title: 'ワールド4 クリア', description: '角の大きさの全単元で正解した', icon: '🚩' },
  { id: 'world_decimal', title: 'ワールド5 クリア', description: '小数のしくみの全単元で正解した', icon: '🚩' },
  { id: 'world_div2', title: 'ワールド6 クリア', description: 'わり算の筆算(÷2けた)の全単元で正解した', icon: '🚩' },
  { id: 'world_rounding', title: 'ワールド7 クリア', description: 'がい数の全単元で正解した', icon: '🚩' },
  { id: 'world_calcrules', title: 'ワールド8 クリア', description: '計算のきまりの全単元で正解した', icon: '🚩' },
  { id: 'world_area', title: 'ワールド9 クリア', description: '面積の全単元で正解した', icon: '🚩' },
  { id: 'world_decmuldiv', title: 'ワールド10 クリア', description: '小数のかけ算とわり算の全単元で正解した', icon: '🚩' },
  { id: 'world_fraction', title: 'ワールド11 クリア', description: '分数の全単元で正解した', icon: '🚩' },
  { id: 'world_change', title: 'ワールド12 クリア', description: '変わり方調べの全単元で正解した', icon: '🚩' },
  { id: 'world_solid', title: 'ワールド13 クリア', description: '直方体と立方体の全単元で正解した', icon: '🚩' },
  { id: 'world_ratio', title: 'ワールド14 クリア', description: '倍の見方の全単元で正解した', icon: '🚩' },
  // --- 単元マスター(小4全14単元) ---
  { id: 'master_bignum', title: '大きい数マスター', description: '大きい数のしくみの正答率85%以上', icon: '🔢' },
  { id: 'master_graph', title: 'グラフと表マスター', description: '折れ線グラフと表の正答率85%以上', icon: '📈' },
  { id: 'master_div1', title: 'わり算マスターⅠ', description: 'わり算の筆算(÷1けた)の正答率85%以上', icon: '➗' },
  { id: 'master_angle', title: '角度マスター', description: '角の大きさの正答率85%以上', icon: '📐' },
  { id: 'master_decimal', title: '小数マスター', description: '小数のしくみの正答率85%以上', icon: '🔟' },
  { id: 'master_div2', title: 'わり算マスターⅡ', description: 'わり算の筆算(÷2けた)の正答率85%以上', icon: '➗' },
  { id: 'master_rounding', title: 'がい数マスター', description: 'がい数の正答率85%以上', icon: '🌀' },
  { id: 'master_calcrules', title: '計算のきまりマスター', description: '計算のきまりの正答率85%以上', icon: '🧮' },
  { id: 'master_area', title: '面積マスター', description: '面積の正答率85%以上', icon: '⬜' },
  { id: 'master_decmuldiv', title: '小数×÷マスター', description: '小数のかけ算とわり算の正答率85%以上', icon: '✖️' },
  { id: 'master_fraction', title: '分数マスター', description: '分数の正答率85%以上', icon: '🍰' },
  { id: 'master_change', title: '変わり方マスター', description: '変わり方調べの正答率85%以上', icon: '🔄' },
  { id: 'master_solid', title: '直方体マスター', description: '直方体と立方体の正答率85%以上', icon: '📦' },
  { id: 'master_ratio', title: '倍の見方マスター', description: '倍の見方の正答率85%以上', icon: '⚖️' },
  { id: 'all_master', title: '全単元制覇', description: '全14単元の正答率85%以上', icon: '🎓' },
  // --- 本番テスト(表=知識・技能100点 / 裏=思考・判断・表現50点) ---
  { id: 'test_omote_50', title: '表テスト50', description: '本番テスト(表)で50点以上', icon: '📋' },
  { id: 'test_omote_75', title: '表テスト75', description: '本番テスト(表)で75点以上', icon: '📋' },
  { id: 'test_omote_90', title: '表テスト90', description: '本番テスト(表)で90点以上', icon: '📋' },
  { id: 'test_omote_100', title: '表テスト満点', description: '本番テスト(表)で100点満点', icon: '🏆' },
  { id: 'test_ura_25', title: '裏テスト25', description: '本番テスト(裏)で25点以上', icon: '📘' },
  { id: 'test_ura_40', title: '裏テスト40', description: '本番テスト(裏)で40点以上', icon: '📘' },
  { id: 'test_ura_50', title: '裏テスト満点', description: '本番テスト(裏)で50点満点', icon: '🏅' },
  { id: 'test_total_100', title: '両面テスト100', description: '両面テストで合計100点以上', icon: '💠' },
  { id: 'test_total_140', title: '両面テスト140', description: '両面テストで合計140点以上', icon: '💠' },
  { id: 'test_total_150', title: '両面テスト満点', description: '両面テストで150点満点', icon: '👑' },
  { id: 'test_omote_perfect_3', title: '表マイスター', description: '本番テスト(表)で満点を3回', icon: '🛡️' },
  { id: 'test_ura_perfect_3', title: '裏マイスター', description: '本番テスト(裏)で満点を3回', icon: '🛡️' },
  { id: 'test_total_perfect_3', title: '両面マイスター', description: '両面テストで満点を3回', icon: '💎' },
  // --- コレクション ---
  { id: 'deck_full', title: 'フルデッキ', description: 'カードを50枚以上所持', icon: '🃏' },
  { id: 'shop_first', title: '初めての買い物', description: 'ショップで初購入', icon: '🛒' },
  { id: 'title_collector', title: '称号コレクター', description: '称号を3つ以上購入', icon: '🏷️' },
  // --- クエスト ---
  { id: 'daily_complete', title: 'デイリー完遂', description: '全デイリークエストを達成', icon: '📋' },
  { id: 'weekly_complete', title: 'ウィークリー完遂', description: '全ウィークリークエストを達成', icon: '📅' },
  // --- チュートリアル ---
  { id: 'tutorial_clear', title: 'チュートリアル完了', description: 'チュートリアルバトルをクリア', icon: '🎮' },
  // --- スペシャル ---
  { id: 'speed_demon', title: 'スピードデーモン', description: '3秒以内に正解した', icon: '⏱️' },
  { id: 'comeback', title: '逆転勝利', description: 'HP5以下から勝利した', icon: '🔄' },
];

// ============================
// Quest Definitions
// エビデンスA: 目標設定理論（Locke & Latham 1990, d=0.48）
// 3層設計: Easy(確実達成) → Medium(努力で達成) → Hard(チャレンジ)
// ============================
export const DAILY_QUEST_DEFS: DailyQuestDef[] = [
  // Easy層: ほぼ全員が達成でき、毎日の起動動機になる
  { id: 'dq_5', title: '今日の5問', description: '5問正解しよう', target: 5, reward: { mp: 150, exp: 80 }, icon: '⚡' },
  // Medium層: 15-20分の学習を要する。目標設定理論の最適難度
  { id: 'dq_15', title: '15問突破', description: '15問正解しよう', target: 15, reward: { mp: 400, exp: 200 }, icon: '🔥' },
  // Hard層: 30分以上+高品質。達成感が最大のチャレンジ目標
  { id: 'dq_30', title: '30問＆正答率80%', description: '30問正解（正答率80%以上）', target: 30, reward: { mp: 1000, exp: 500 }, icon: '💎' },
  // PvP: 社会的動機づけ（SDT関係性欲求）
  { id: 'dq_pvp', title: 'PvP参戦', description: 'PvP対戦を1回行おう', target: 1, reward: { mp: 200, exp: 100 }, icon: '⚔️' },
];

export const WEEKLY_QUEST_DEFS: DailyQuestDef[] = [
  { id: 'wq_50', title: '週50問チャレンジ', description: '今週50問正解しよう', target: 50, reward: { mp: 800, exp: 400 }, icon: '🌟' },
  { id: 'wq_pvp3', title: '週3回PvP', description: '今週PvPを3回行おう', target: 3, reward: { mp: 800, exp: 400 }, icon: '🏆' },
  { id: 'wq_100', title: '週100問マスター', description: '今週100問正解しよう', target: 100, reward: { mp: 2000, exp: 1000 }, icon: '👑' },
];

/**
 * MPシンク — 称号・ストリークシールド・テーマ
 * エビデンスB: 仮想経済バランス（Castronova 2005）
 *   消費先がないとインフレ → モチベーション低下
 */
export const SHOP_ITEMS: ShopItemDef[] = [
  // ストリークシールド（ログイン連続日数を1回保護）
  { id: 'streak_shield', name: 'ストリークシールド', description: 'ログイン途切れを1回だけ防ぐ', cost: 2000, icon: '🛡️', type: 'streak_shield' },
  // バトルテーマ
  { id: 'theme_fire', name: '炎のテーマ', description: 'バトル画面が炎に包まれる', cost: 4000, icon: '🔴', type: 'theme' },
  { id: 'theme_ice', name: '氷のテーマ', description: '冷徹な戦場で戦う', cost: 4000, icon: '🔵', type: 'theme' },
  { id: 'theme_gold', name: '黄金のテーマ', description: '栄光のゴールドバトル', cost: 8000, icon: '🟡', type: 'theme' },
  // 消耗品
  { id: 'mp_booster', name: '2倍MPブースター', description: '1時間MPの獲得量が2倍になる', cost: 3000, icon: '⚡', type: 'mp_booster', durationMs: 3600000 },
  { id: 'hint_token', name: 'ヒントトークン', description: 'バトル中に1問ヒントが使える（1個）', cost: 500, icon: '💡', type: 'hint_token' },
  { id: 'exp_booster', name: '経験値ブースター', description: '次のバトルで獲得EXPが2倍', cost: 1500, icon: '🌟', type: 'exp_booster' },
];

/**
 * バトルテーマ設定
 */
export const THEME_CONFIGS: Record<string, { bgClass: string; accentColor: string }> = {
  theme_fire: {
    bgClass: 'bg-gradient-to-br from-red-950 via-orange-900/20 to-red-950',
    accentColor: '#ef4444',
  },
  theme_ice: {
    bgClass: 'bg-gradient-to-br from-blue-950 via-cyan-900/20 to-slate-950',
    accentColor: '#06b6d4',
  },
  theme_gold: {
    bgClass: 'bg-gradient-to-br from-amber-950 via-yellow-900/20 to-amber-950',
    accentColor: '#f59e0b',
  },
};

/**
 * 称号定義（条件達成で自動付与）
 * エビデンスA: 自己決定理論（Deci & Ryan 1985）— 有能感・達成感による内発的動機づけ
 */
export const TITLE_DEFS: TitleDef[] = [
  // スターター
  { id: 'title_newcomer', name: '新入生', description: 'ゲームを始めた証', icon: '🔰', condition: { type: 'any' }, rarity: 'common' },

  // 正解数マイルストーン
  { id: 'title_correct_50', name: '問題解き師', description: '50問正解した', icon: '📝', condition: { type: 'total_correct', value: 50 }, rarity: 'common' },
  { id: 'title_correct_100', name: '百問突破', description: '100問正解した', icon: '💯', condition: { type: 'total_correct', value: 100 }, rarity: 'common' },
  { id: 'title_correct_500', name: '解答機械', description: '500問正解した', icon: '⚙️', condition: { type: 'total_correct', value: 500 }, rarity: 'rare' },
  { id: 'title_correct_1000', name: '千問達人', description: '1000問正解した', icon: '🏅', condition: { type: 'total_correct', value: 1000 }, rarity: 'rare' },
  { id: 'title_correct_5000', name: '算数マスター', description: '5000問正解した', icon: '🌟', condition: { type: 'total_correct', value: 5000 }, rarity: 'epic' },

  // PvP勝利
  { id: 'title_first_pvp_win', name: '初陣', description: 'PvPで初勝利', icon: '⚔️', condition: { type: 'badge_owned', badgeId: 'first_pvp_win' }, rarity: 'common' },
  { id: 'title_pvp_10wins', name: '闘士', description: 'PvPで10勝した', icon: '🗡️', condition: { type: 'badge_owned', badgeId: 'pvp_10wins' }, rarity: 'common' },
  { id: 'title_pvp_50wins', name: '戦士', description: 'PvPで50勝した', icon: '🏆', condition: { type: 'badge_owned', badgeId: 'pvp_50wins' }, rarity: 'rare' },
  { id: 'title_pvp_100wins', name: '猛将', description: 'PvPで100勝した', icon: '👑', condition: { type: 'total_wins', value: 100 }, rarity: 'epic' },

  // ログインストリーク
  { id: 'title_streak_3', name: '習慣者', description: '3日連続ログイン', icon: '🔥', condition: { type: 'login_streak', value: 3 }, rarity: 'common' },
  { id: 'title_streak_7', name: '精勤', description: '7日連続ログイン', icon: '🔥', condition: { type: 'login_streak', value: 7 }, rarity: 'common' },
  { id: 'title_streak_30', name: '皆勤賞', description: '30日連続ログイン', icon: '🏆', condition: { type: 'login_streak', value: 30 }, rarity: 'epic' },
  { id: 'title_streak_90', name: '鉄人', description: '90日連続ログイン', icon: '💪', condition: { type: 'login_streak', value: 90 }, rarity: 'legendary' },

  // 連鎖コンボ
  { id: 'title_chain_5', name: '連続正解者', description: '5問連続正解した', icon: '⚡', condition: { type: 'badge_owned', badgeId: 'chain_5' }, rarity: 'common' },
  { id: 'title_chain_10', name: '怒涛の連撃', description: '10問連続正解した', icon: '⚡', condition: { type: 'badge_owned', badgeId: 'chain_10' }, rarity: 'rare' },
  { id: 'title_chain_20', name: '無敵連鎖', description: '20問連続正解した', icon: '⚡', condition: { type: 'badge_owned', badgeId: 'chain_20' }, rarity: 'epic' },

  // レベル
  { id: 'title_level_10', name: '一人前', description: 'レベル10に到達', icon: '📈', condition: { type: 'level', value: 10 }, rarity: 'common' },
  { id: 'title_level_30', name: '熟練者', description: 'レベル30に到達', icon: '🎖️', condition: { type: 'level', value: 30 }, rarity: 'rare' },
  { id: 'title_level_50', name: '上級者', description: 'レベル50に到達', icon: '🌠', condition: { type: 'level', value: 50 }, rarity: 'epic' },

  // 単元マスター称号(代表的な単元)
  { id: 'title_master_bignum', name: '大きい数の達人', description: '大きい数のしくみの正答率85%以上', icon: '🔢', condition: { type: 'badge_owned', badgeId: 'master_bignum' }, rarity: 'rare' },
  { id: 'title_master_div1', name: 'わり算の達人', description: 'わり算の筆算(÷1けた)の正答率85%以上', icon: '➗', condition: { type: 'badge_owned', badgeId: 'master_div1' }, rarity: 'rare' },
  { id: 'title_master_decimal', name: '小数の達人', description: '小数のしくみの正答率85%以上', icon: '🔟', condition: { type: 'badge_owned', badgeId: 'master_decimal' }, rarity: 'rare' },
  { id: 'title_master_rounding', name: 'がい数の達人', description: 'がい数の正答率85%以上', icon: '🌀', condition: { type: 'badge_owned', badgeId: 'master_rounding' }, rarity: 'rare' },
  { id: 'title_master_area', name: '面積の達人', description: '面積の正答率85%以上', icon: '⬜', condition: { type: 'badge_owned', badgeId: 'master_area' }, rarity: 'rare' },
  { id: 'title_master_fraction', name: '分数の達人', description: '分数の正答率85%以上', icon: '🍰', condition: { type: 'badge_owned', badgeId: 'master_fraction' }, rarity: 'rare' },
  { id: 'title_master_ratio', name: '倍の見方の達人', description: '倍の見方の正答率85%以上', icon: '⚖️', condition: { type: 'badge_owned', badgeId: 'master_ratio' }, rarity: 'rare' },
  { id: 'title_all_master', name: '算数はかせ', description: '全14単元85%以上の正答率', icon: '🎓', condition: { type: 'badge_owned', badgeId: 'all_master' }, rarity: 'legendary' },
  { id: 'title_test_omote_100', name: 'テストの王者', description: '本番テスト(表)で満点', icon: '🏆', condition: { type: 'badge_owned', badgeId: 'test_omote_100' }, rarity: 'epic' },
  { id: 'title_test_total_150', name: '完全無欠', description: '両面テストで150点満点', icon: '👑', condition: { type: 'badge_owned', badgeId: 'test_total_150' }, rarity: 'legendary' },

  // スペシャル
  { id: 'title_perfect_battle', name: '完璧主義者', description: 'HP満タンで勝利した', icon: '💎', condition: { type: 'badge_owned', badgeId: 'perfect_battle' }, rarity: 'epic' },
  { id: 'title_comeback', name: '逆転の帝王', description: 'HP5以下から勝利した', icon: '🔄', condition: { type: 'badge_owned', badgeId: 'comeback' }, rarity: 'rare' },
  { id: 'title_speed_demon', name: 'スピードデーモン', description: '3秒以内に正解した', icon: '⏱️', condition: { type: 'badge_owned', badgeId: 'speed_demon' }, rarity: 'rare' },
  { id: 'title_first_cpu_win', name: 'CPU撃破者', description: 'CPUに初勝利した', icon: '🤖', condition: { type: 'badge_owned', badgeId: 'first_cpu_win' }, rarity: 'common' },

  // 月次限定（動的 — 1位のみ装備可能）
  { id: 'title_monthly_champion', name: '算数王', description: '今月の総合勝利数1位のみ装備可能', icon: '👑', condition: { type: 'monthly_top1' }, isMonthly: true, rarity: 'legendary' },
];
