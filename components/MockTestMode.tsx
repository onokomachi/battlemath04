import React, { useMemo, useState, useCallback } from 'react';
import type { Problem } from '../types';
import { ALL_PROBLEM_SETS } from '../data';
import { checkAnswer } from '../utils/answerChecker';
import { generateBattleKeypadLayout } from '../utils/keypadLayoutGenerator';
import Keypad from './Keypad';
import FractionText, { PartialFractionDisplay } from './FractionText';
import { recordTestResult, recordProblemLog, getTestBests, type TestStepResult, type TestBests } from '../services/learningLogService';
import { BackIcon } from './Icons';
import GuidedAnswerHost from './guided/GuidedAnswerHost';

/**
 * 本番テストモード — 学校のワークテスト形式(表=知識・技能100点 / 裏=思考・判断・表現50点)。
 * 新学社まとめテスト(東書4年)の大問構成・配点に準拠した複数のテストセットを収録。
 *
 * 本番形式の特徴(docs/DESIGN.md §4.7):
 *  - 解答中は正誤を表示しない(遅延フィードバック=検索練習の本番転移)
 *  - ヒントなし(足場の完全撤去段階)
 *  - 採点後に大問別の得点と全設問の詳細を表示し、学習のきろくに保存
 */

type TestMode = '表' | '裏' | 'ぜんぶ';

interface BlueprintItem {
  daimon: number;
  title: string;
  section: '表' | '裏';
  subTopic: string;
  count: number;
  pointsEach: number;
}

interface TestSet {
  id: string;
  name: string;
  desc: string;
  blueprint: BlueprintItem[];
}

// 表の合計は各セット100点、裏は50点になるよう配点している
export const TEST_SETS: TestSet[] = [
  {
    id: 'bignum',
    name: '1. 大きい数のしくみ',
    desc: '億・兆／10倍・1/10／3けたのかけ算',
    blueprint: [
      { daimon: 1, title: '位の判断', section: '表', subTopic: '何の位・いくつ分', count: 4, pointsEach: 5 },
      { daimon: 2, title: '数字で書く', section: '表', subTopic: '大きい数のよみかき', count: 4, pointsEach: 5 },
      { daimon: 3, title: '数直線', section: '表', subTopic: '数直線(億・兆)', count: 2, pointsEach: 5 },
      { daimon: 4, title: '10倍した数', section: '表', subTopic: '10倍した数', count: 2, pointsEach: 5 },
      { daimon: 5, title: '1/10にした数', section: '表', subTopic: '10分の1にした数', count: 2, pointsEach: 5 },
      { daimon: 6, title: 'かけ算', section: '表', subTopic: '3けた×3けたのかけ算', count: 4, pointsEach: 5 },
      { daimon: 7, title: 'くふうして筆算', section: '表', subTopic: '末尾に0のあるかけ算', count: 2, pointsEach: 5 },
      { daimon: 8, title: 'いろいろな見方', section: '裏', subTopic: '大きい数のいろいろな見方', count: 3, pointsEach: 10 },
      { daimon: 9, title: '整数づくり', section: '裏', subTopic: '数字カードで整数づくり', count: 2, pointsEach: 10 },
    ],
  },
  {
    id: 'graph',
    name: '2. 折れ線グラフと表',
    desc: '折れ線グラフのよみとり／二次元表',
    blueprint: [
      { daimon: 1, title: '折れ線グラフのよみとり', section: '表', subTopic: '折れ線グラフのよみとり', count: 6, pointsEach: 5 },
      { daimon: 2, title: '変わり方の大きさ', section: '表', subTopic: '変わり方の大きさ', count: 2, pointsEach: 5 },
      { daimon: 3, title: '二次元表のよみとり', section: '表', subTopic: '二次元表のよみとり', count: 6, pointsEach: 5 },
      { daimon: 4, title: '表に整理する', section: '表', subTopic: '二次元表に整理する', count: 6, pointsEach: 5 },
      { daimon: 5, title: '組み合わせたグラフ', section: '裏', subTopic: '組み合わせグラフ', count: 3, pointsEach: 10 },
      { daimon: 6, title: 'グラフのくふう', section: '裏', subTopic: 'グラフのくふう', count: 2, pointsEach: 10 },
    ],
  },
  {
    id: 'division',
    name: '3. わり算の筆算',
    desc: '筆算・たしかめ算・見当づけ(wari-hissann3準拠)',
    blueprint: [
      { daimon: 1, title: 'あんざんわり算', section: '表', subTopic: '九九のはんい', count: 2, pointsEach: 5 },
      { daimon: 2, title: '筆算(2けた÷2けた)', section: '表', subTopic: '2けた÷2けた', count: 2, pointsEach: 5 },
      { daimon: 2, title: '筆算(3けた÷2けた)', section: '表', subTopic: '3けた÷2けた', count: 4, pointsEach: 5 },
      { daimon: 3, title: 'くふうして筆算(わり算のきまり)', section: '表', subTopic: 'くふうして筆算', count: 2, pointsEach: 5 },
      { daimon: 4, title: '商のたつ位', section: '表', subTopic: '商は何けた', count: 2, pointsEach: 5 },
      { daimon: 5, title: 'けん算(たしかめ算)', section: '表', subTopic: 'あまりのあるとき', count: 2, pointsEach: 5 },
      { daimon: 6, title: 'まちがい直し(商の0)', section: '表', subTopic: '商に0がたつわり算', count: 2, pointsEach: 5 },
      { daimon: 7, title: '筆算(÷1けた)', section: '表', subTopic: '3けた÷1けた', count: 2, pointsEach: 5 },
      { daimon: 8, title: '商の見当づけ', section: '表', subTopic: '仮の商の見当', count: 2, pointsEach: 5 },
      { daimon: 9, title: '文章題(÷1けた)', section: '裏', subTopic: 'あまりのあるもんだい', count: 1, pointsEach: 10 },
      { daimon: 10, title: '文章題(÷2けた)', section: '裏', subTopic: '大きな数のもんだい', count: 2, pointsEach: 10 },
      { daimon: 11, title: '仮の商の修正', section: '裏', subTopic: '仮の商の修正', count: 1, pointsEach: 10 },
      { daimon: 12, title: '何倍かを もとめる', section: '裏', subTopic: '何倍かをもとめる(わり算)', count: 1, pointsEach: 10 },
    ],
  },
  {
    id: 'rounding',
    name: '4. がい数の使い方と表し方',
    desc: '四捨五入・はんい・見積もり(syo4-gaisu準拠)',
    blueprint: [
      { daimon: 1, title: 'がい数のいみ', section: '表', subTopic: '大きな数を「約何万」で', count: 2, pointsEach: 5 },
      { daimon: 2, title: '四捨五入', section: '表', subTopic: '指定の位までのがい数', count: 3, pointsEach: 5 },
      { daimon: 3, title: '上から○けたのがい数', section: '表', subTopic: '上から1けたのがい数', count: 2, pointsEach: 5 },
      { daimon: 4, title: 'もとの数のはんい', section: '表', subTopic: '十の位までのはんい', count: 1, pointsEach: 15 },
      { daimon: 5, title: 'たし算・ひき算の見積もり', section: '表', subTopic: 'たし算の見積もり', count: 3, pointsEach: 10 },
      { daimon: 6, title: 'かけ算・わり算の見積もり', section: '表', subTopic: 'かけ算の見積もり', count: 2, pointsEach: 10 },
      { daimon: 7, title: '切り上げ・切り捨ての判断', section: '裏', subTopic: 'どの見積もり方がいい？', count: 2, pointsEach: 10 },
      { daimon: 8, title: '見積もりの文章題', section: '裏', subTopic: '文章題で見積もり', count: 1, pointsEach: 10 },
      { daimon: 9, title: 'はんいの応用', section: '裏', subTopic: '千の位までのはんい', count: 2, pointsEach: 10 },
    ],
  },
  {
    id: 'decimal',
    name: '5. 小数のしくみ',
    desc: '位取り・数直線・たし算ひき算(syo4-syousu準拠)',
    blueprint: [
      { daimon: 1, title: '位取りのしくみ', section: '表', subTopic: '数をつくる', count: 4, pointsEach: 5 },
      { daimon: 2, title: '数直線', section: '表', subTopic: '数直線を読む', count: 2, pointsEach: 5 },
      { daimon: 2, title: '大小くらべ', section: '表', subTopic: '大小をくらべよう', count: 2, pointsEach: 5 },
      { daimon: 3, title: '筆算 たし算', section: '表', subTopic: '小数のたし算(同じ位)', count: 4, pointsEach: 5 },
      { daimon: 4, title: '筆算 ひき算', section: '表', subTopic: '小数のひき算(同じ位)', count: 4, pointsEach: 5 },
      { daimon: 5, title: '小数×整数', section: '表', subTopic: '小数×整数(小数第一位)', count: 2, pointsEach: 5 },
      { daimon: 5, title: '小数÷整数', section: '表', subTopic: '小数÷整数(小数第一位)', count: 2, pointsEach: 5 },
      { daimon: 6, title: '多様な見方', section: '裏', subTopic: '○の位の数字は', count: 1, pointsEach: 10 },
      { daimon: 7, title: '小数の文章題(たし算)', section: '裏', subTopic: '小数のたし算の文章題', count: 1, pointsEach: 10 },
      { daimon: 7, title: '小数の文章題(ひき算)', section: '裏', subTopic: '小数のひき算の文章題', count: 1, pointsEach: 10 },
      { daimon: 8, title: 'わり進むわり算', section: '裏', subTopic: 'わり進むわり算', count: 1, pointsEach: 10 },
      { daimon: 9, title: '×÷の文章題', section: '裏', subTopic: '小数×の文章題', count: 1, pointsEach: 10 },
    ],
  },
  {
    id: 'fraction',
    name: '6. 分数',
    desc: '仮分数・帯分数／大小／たし算ひき算',
    blueprint: [
      { daimon: 1, title: '分数のなかま分け', section: '表', subTopic: '真分数・仮分数・帯分数', count: 3, pointsEach: 5 },
      { daimon: 2, title: '数直線', section: '表', subTopic: '数直線をよむ(1より大きい)', count: 2, pointsEach: 5 },
      { daimon: 3, title: '仮分数を帯分数に', section: '表', subTopic: '仮分数を帯分数に(基本)', count: 2, pointsEach: 5 },
      { daimon: 3, title: '帯分数を仮分数に', section: '表', subTopic: '帯分数を仮分数に(基本)', count: 1, pointsEach: 5 },
      { daimon: 3, title: '仮分数と整数', section: '表', subTopic: '仮分数と整数', count: 1, pointsEach: 5 },
      { daimon: 4, title: '大きさくらべ', section: '表', subTopic: '仮分数と帯分数の大小', count: 2, pointsEach: 5 },
      { daimon: 4, title: '大きさくらべ', section: '表', subTopic: '単位分数の大小', count: 1, pointsEach: 5 },
      { daimon: 5, title: 'たし算', section: '表', subTopic: '和が1をこえるたし算', count: 2, pointsEach: 5 },
      { daimon: 5, title: 'たし算', section: '表', subTopic: 'くり上がりのあるたし算', count: 2, pointsEach: 5 },
      { daimon: 5, title: 'ひき算', section: '表', subTopic: '1や整数からひく', count: 2, pointsEach: 5 },
      { daimon: 5, title: 'ひき算', section: '表', subTopic: 'くり下がりのあるひき算', count: 2, pointsEach: 5 },
      { daimon: 1, title: '等しい分数', section: '裏', subTopic: '等しい分数(数直線)', count: 1, pointsEach: 10 },
      { daimon: 2, title: 'まちがい探し', section: '裏', subTopic: 'まちがい探し', count: 2, pointsEach: 10 },
      { daimon: 3, title: 'たし算の文しょうだい', section: '裏', subTopic: 'たし算の文しょうだい', count: 1, pointsEach: 10 },
      { daimon: 3, title: 'ひき算の文しょうだい', section: '裏', subTopic: 'ひき算の文しょうだい', count: 1, pointsEach: 10 },
    ],
  },
  {
    id: 'term1',
    name: 'まとめ① 1学期(大きい数〜角)',
    desc: '大きい数・わり算・角・グラフと表',
    blueprint: [
      { daimon: 1, title: '大きい数', section: '表', subTopic: '大きい数のよみかき', count: 2, pointsEach: 5 },
      { daimon: 2, title: '10倍した数', section: '表', subTopic: '10倍した数', count: 1, pointsEach: 5 },
      { daimon: 2, title: '1/10にした数', section: '表', subTopic: '10分の1にした数', count: 1, pointsEach: 5 },
      { daimon: 3, title: 'わり算(2けた÷1けた)', section: '表', subTopic: '2けた÷1けた', count: 2, pointsEach: 5 },
      { daimon: 3, title: 'わり算(3けた÷1けた)', section: '表', subTopic: '3けた÷1けた', count: 2, pointsEach: 5 },
      { daimon: 3, title: 'わり算(商に0)', section: '表', subTopic: '商に0がたつわり算', count: 2, pointsEach: 5 },
      { daimon: 4, title: '交わる直線の角', section: '表', subTopic: '交わる直線の角', count: 1, pointsEach: 5 },
      { daimon: 4, title: '180°をこえる角', section: '表', subTopic: '180°をこえる角', count: 1, pointsEach: 5 },
      { daimon: 5, title: '三角じょうぎの角', section: '表', subTopic: '三角じょうぎの角', count: 2, pointsEach: 5 },
      { daimon: 6, title: '折れ線グラフ', section: '表', subTopic: '折れ線グラフのよみとり', count: 3, pointsEach: 5 },
      { daimon: 7, title: '二次元表', section: '表', subTopic: '二次元表のよみとり', count: 3, pointsEach: 5 },
      { daimon: 8, title: 'わり算の文章題', section: '裏', subTopic: 'あまりのあるもんだい', count: 2, pointsEach: 10 },
      { daimon: 9, title: '三角じょうぎの角', section: '裏', subTopic: '三角じょうぎの角', count: 1, pointsEach: 10 },
      { daimon: 10, title: '整数づくり', section: '裏', subTopic: '数字カードで整数づくり', count: 1, pointsEach: 10 },
      { daimon: 11, title: '表に整理する', section: '裏', subTopic: '二次元表に整理する', count: 1, pointsEach: 10 },
    ],
  },
  {
    id: 'zenki',
    name: 'まとめ② 前期(大きい数〜小数)',
    desc: '大きい数・小数・角・グラフ・わり算',
    blueprint: [
      { daimon: 1, title: '大きい数', section: '表', subTopic: '大きい数のよみかき', count: 2, pointsEach: 5 },
      { daimon: 2, title: '小数のしくみ', section: '表', subTopic: '数をつくる', count: 2, pointsEach: 5 },
      { daimon: 3, title: '交わる直線の角', section: '表', subTopic: '交わる直線の角', count: 1, pointsEach: 5 },
      { daimon: 4, title: '180°をこえる角', section: '表', subTopic: '180°をこえる角', count: 1, pointsEach: 5 },
      { daimon: 5, title: '折れ線グラフ', section: '表', subTopic: '折れ線グラフのよみとり', count: 2, pointsEach: 5 },
      { daimon: 6, title: 'わり算(3けた÷1けた)', section: '表', subTopic: '3けた÷1けた', count: 2, pointsEach: 5 },
      { daimon: 6, title: 'わり算(商に0)', section: '表', subTopic: '商に0がたつわり算', count: 2, pointsEach: 5 },
      { daimon: 6, title: 'わり算(2けた÷1けた)', section: '表', subTopic: '2けた÷1けた', count: 2, pointsEach: 5 },
      { daimon: 7, title: '小数のたし算', section: '表', subTopic: '小数のたし算(同じ位)', count: 2, pointsEach: 5 },
      { daimon: 7, title: '小数のひき算', section: '表', subTopic: '小数のひき算(同じ位)', count: 2, pointsEach: 5 },
      { daimon: 8, title: '数直線', section: '表', subTopic: '数直線(億・兆)', count: 2, pointsEach: 5 },
      { daimon: 9, title: 'わり算の文章題', section: '裏', subTopic: 'あまりのあるもんだい', count: 1, pointsEach: 10 },
      { daimon: 10, title: '小数の文章題(たし算)', section: '裏', subTopic: '小数のたし算の文章題', count: 1, pointsEach: 10 },
      { daimon: 10, title: '小数の文章題(ひき算)', section: '裏', subTopic: '小数のひき算の文章題', count: 1, pointsEach: 10 },
      { daimon: 11, title: '商のたつ位', section: '裏', subTopic: '商は何けた', count: 1, pointsEach: 10 },
      { daimon: 12, title: '三角じょうぎの角', section: '裏', subTopic: '三角じょうぎの角', count: 1, pointsEach: 10 },
    ],
  },
];

interface TestQuestion {
  bp: BlueprintItem;
  problem: Problem;
}

const sample = <T,>(arr: T[], n: number): T[] =>
  [...arr].sort(() => Math.random() - 0.5).slice(0, n);

const buildTest = (set: TestSet, mode: TestMode): TestQuestion[] => {
  const items = set.blueprint.filter((b) => (mode === 'ぜんぶ' ? true : b.section === mode));
  const qs: TestQuestion[] = [];
  for (const bp of items) {
    const pool = ALL_PROBLEM_SETS[bp.subTopic] || [];
    for (const problem of sample(pool, bp.count)) {
      qs.push({ bp, problem });
    }
  }
  return qs;
};

interface MockTestModeProps {
  onExit: () => void;
  /** テスト結果のバッジ判定・Firestore同期(App側で progressionStore に接続) */
  onTestFinished?: (bests: TestBests, detail: { mode: TestMode; omoteScore: number; uraScore: number; total: number }) => void;
}

const MockTestMode: React.FC<MockTestModeProps> = ({ onExit, onTestFinished }) => {
  const [phase, setPhase] = useState<'select' | 'setup' | 'testing' | 'result'>('select');
  const [testSet, setTestSet] = useState<TestSet>(TEST_SETS[0]);
  const [mode, setMode] = useState<TestMode>('表');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [steps, setSteps] = useState<TestStepResult[]>([]);
  const [scores, setScores] = useState({ omote: 0, omoteMax: 0, ura: 0, uraMax: 0 });
  const bests = getTestBests();

  const startTest = (m: TestMode) => {
    setMode(m);
    setQuestions(buildTest(testSet, m));
    setAnswers([]);
    setCurrent('');
    setIndex(0);
    setPhase('testing');
  };

  const q = questions[index];
  const qData: any = q?.problem.data;

  const keypadLayout = useMemo(
    () => (q ? generateBattleKeypadLayout(q.problem) : [['0']]),
    [q],
  );
  const isFractionKeypad = useMemo(
    () => keypadLayout.some((row) => row.includes('と')),
    [keypadLayout],
  );

  const handleKey = useCallback((key: string) => {
    if (key === 'BACKSPACE') setCurrent((p) => p.slice(0, -1));
    else if (key === 'CLEAR') setCurrent('');
    else setCurrent((p) => p + key);
  }, []);

  const finishTest = (finalAnswers: string[]) => {
    let omote = 0, omoteMax = 0, ura = 0, uraMax = 0;
    const stepResults: TestStepResult[] = questions.map((tq, i) => {
      const d: any = tq.problem.data;
      const user = finalAnswers[i] || '';
      const correct = checkAnswer(user, tq.problem.answer, {
        multiple: !!d?.multiple,
        requireForm: d?.requireForm,
      });
      const earned = correct ? tq.bp.pointsEach : 0;
      if (tq.bp.section === '表') { omote += earned; omoteMax += tq.bp.pointsEach; }
      else { ura += earned; uraMax += tq.bp.pointsEach; }
      recordProblemLog({
        mode: 'test',
        subTopic: tq.bp.subTopic,
        question: String(d?.question || ''),
        userAnswer: user,
        correct,
      });
      return {
        daimon: tq.bp.daimon,
        title: `${tq.bp.section} 大問${tq.bp.daimon} ${tq.bp.title}`,
        q: String(d?.question || ''),
        a: tq.problem.answer,
        user,
        points: tq.bp.pointsEach,
        earned,
        correct,
      };
    });
    setSteps(stepResults);
    setScores({ omote, omoteMax, ura, uraMax });
    const newBests = recordTestResult({
      mode,
      setName: testSet.name,
      omoteScore: omote,
      omoteMax,
      uraScore: ura,
      uraMax,
      total: omote + ura,
      totalMax: omoteMax + uraMax,
      steps: stepResults,
    });
    onTestFinished?.(newBests, { mode, omoteScore: omote, uraScore: ura, total: omote + ura });
    setPhase('result');
  };

  const handleNext = () => {
    const next = [...answers];
    next[index] = current;
    setAnswers(next);
    setCurrent('');
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      finishTest(next);
    }
  };

  // 本番テストは「足場の完全撤去(ヒントなし)」段階のため、guided問題は
  // マスターモード(ヒントなし・最後に一括採点)を強制して起動する。
  const guidedTestProblem = useMemo(() => {
    if (!q || q.problem.type !== 'guided') return null;
    return { ...q.problem, data: { ...(q.problem.data as any), masterMode: true } };
  }, [q]);

  const handleGuidedComplete = (isCorrect: boolean) => {
    if (!q) return;
    const val = isCorrect ? q.problem.answer : '__guided_incorrect__';
    const next = [...answers];
    next[index] = val;
    setAnswers(next);
    setCurrent('');
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      finishTest(next);
    }
  };

  // ============ テストセット選択 ============
  if (phase === 'select') {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center p-4 text-white overflow-y-auto">
        <div className="hud-panel rounded-2xl p-6 sm:p-10 max-w-2xl w-full shadow-2xl my-4">
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-red-300">📝 本番テスト</h1>
          <p className="text-white/60 text-sm mb-6">
            学校のテストと同じ形式に ちょうせん! うけたい テストを えらぼう。
          </p>
          <div className="grid gap-2.5 mb-6">
            {TEST_SETS.map((set) => (
              <button
                key={set.id}
                onClick={() => { setTestSet(set); setPhase('setup'); }}
                className="w-full text-left p-4 rounded-xl border-2 border-red-900/40 bg-slate-900/60 hover:border-red-500/60 hover:bg-slate-800/60 transition-all"
              >
                <p className="font-black text-base text-red-200">{set.name}</p>
                <p className="text-xs text-white/50">{set.desc}</p>
              </button>
            ))}
          </div>
          <button onClick={onExit} className="btn-tactical w-full py-3 rounded-xl font-bold text-red-400 border-red-400/40 flex items-center justify-center gap-2">
            <BackIcon className="w-4 h-4" /> メニューにもどる
          </button>
        </div>
      </div>
    );
  }

  // ============ 表/裏/ぜんぶ の選択 ============
  if (phase === 'setup') {
    const omoteCount = testSet.blueprint.filter(b => b.section === '表').reduce((a, b) => a + b.count, 0);
    const uraCount = testSet.blueprint.filter(b => b.section === '裏').reduce((a, b) => a + b.count, 0);
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center p-4 text-white overflow-y-auto">
        <div className="hud-panel rounded-2xl p-6 sm:p-10 max-w-2xl w-full shadow-2xl">
          <h1 className="text-xl sm:text-2xl font-black mb-1 text-red-300">{testSet.name}</h1>
          <p className="text-white/60 text-sm mb-6">
            とちゅうでは 答え合わせを しないよ。さいごに まとめて 採点するよ。
          </p>
          <div className="grid gap-3 mb-6">
            {([
              ['表', `知識・技能(100点満点・${omoteCount}問)`, `自己ベスト(全テスト): ${bests.bestOmote}点`],
              ['裏', `思考・判断・表現(50点満点・${uraCount}問)`, `自己ベスト(全テスト): ${bests.bestUra}点`],
              ['ぜんぶ', `表と裏を続けて(150点満点・${omoteCount + uraCount}問)`, `自己ベスト(全テスト): ${bests.bestTotal}点`],
            ] as [TestMode, string, string][]).map(([m, desc, best]) => (
              <button
                key={m}
                onClick={() => startTest(m)}
                className="w-full text-left p-4 rounded-xl border-2 border-red-900/40 bg-slate-900/60 hover:border-red-500/60 hover:bg-slate-800/60 transition-all"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-black text-lg text-red-200">{m}のテスト</p>
                    <p className="text-xs text-white/50">{desc}</p>
                  </div>
                  <p className="text-xs text-amber-400 font-bold">{best}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setPhase('select')} className="btn-tactical w-full py-3 rounded-xl font-bold text-red-400 border-red-400/40 flex items-center justify-center gap-2">
            <BackIcon className="w-4 h-4" /> テストをえらびなおす
          </button>
        </div>
      </div>
    );
  }

  // ============ 結果 ============
  if (phase === 'result') {
    const total = scores.omote + scores.ura;
    const totalMax = scores.omoteMax + scores.uraMax;
    const isPerfect = total === totalMax;
    const daimonKeys = [...new Set(steps.map((s) => s.title))];
    return (
      <div className="h-[100dvh] w-full flex items-start justify-center p-4 text-white overflow-y-auto">
        <div className="hud-panel rounded-2xl p-5 sm:p-8 max-w-3xl w-full shadow-2xl my-4">
          <p className="text-xs text-white/40 font-bold">{testSet.name}</p>
          <h1 className="text-2xl font-black mb-1 text-red-300">採点結果</h1>
          <div className="flex items-end gap-4 mb-4">
            <p className="text-5xl font-black text-amber-400">{total}<span className="text-lg text-white/50"> / {totalMax}点</span></p>
            {isPerfect && <p className="text-xl font-black text-emerald-400 animate-pulse">🎉 満点!</p>}
          </div>
          {mode !== '裏' && <p className="text-sm text-white/70 mb-1">表(知識・技能): <span className="font-bold text-red-200">{scores.omote} / {scores.omoteMax}点</span></p>}
          {mode !== '表' && <p className="text-sm text-white/70 mb-4">裏(思考・判断・表現): <span className="font-bold text-red-200">{scores.ura} / {scores.uraMax}点</span></p>}

          <div className="space-y-4 mb-6">
            {daimonKeys.map((title) => {
              const group = steps.filter((s) => s.title === title);
              const got = group.reduce((a, s) => a + s.earned, 0);
              const max = group.reduce((a, s) => a + s.points, 0);
              return (
                <div key={title} className="bg-slate-950/50 rounded-xl border border-red-500/10 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-red-300 text-sm">{title}</p>
                    <p className={`font-black text-sm ${got === max ? 'text-emerald-400' : 'text-amber-400'}`}>{got} / {max}点</p>
                  </div>
                  <div className="space-y-1.5">
                    {group.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-black/30 rounded-lg p-2">
                        <span className={s.correct ? 'text-emerald-400' : 'text-red-400'}>{s.correct ? '○' : '×'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 truncate"><FractionText text={s.q} /></p>
                          {!s.correct && (
                            <p className="text-white/50 mt-0.5">
                              あなた: <FractionText text={s.user || '未入力'} auto className="text-red-300" />
                              {' '}/ 正解: <FractionText text={s.a} auto className="text-emerald-300" />
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={onExit} className="btn-tactical w-full py-3 rounded-xl font-bold text-red-400 border-red-400/40">
            メニューにもどる
          </button>
        </div>
      </div>
    );
  }

  // ============ テスト中 ============
  if (!q) return null;
  return (
    <div className="h-[100dvh] w-full flex items-start justify-center p-3 text-white overflow-y-auto">
      <div className="hud-panel rounded-2xl p-4 sm:p-6 max-w-3xl w-full shadow-2xl my-2">
        <header className="flex justify-between items-center mb-3 border-b border-red-500/10 pb-2">
          <div>
            <p className="text-[10px] text-red-400 font-bold tracking-widest">{testSet.name}({mode})</p>
            <p className="text-sm font-bold text-white">{q.bp.section} 大問{q.bp.daimon} {q.bp.title} <span className="text-amber-400">({q.bp.pointsEach}点)</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-red-400 font-bold">問題</p>
            <p className="text-lg font-black font-mono text-red-300">{index + 1} <span className="text-xs text-red-600">/ {questions.length}</span></p>
          </div>
        </header>

        <div className="bg-slate-950/40 rounded-xl p-4 border border-red-500/5 mb-3 text-center">
          <p className="text-base sm:text-lg leading-snug mb-2">
            <FractionText text={qData?.question || ''} />
          </p>
          {qData?.svg && (
            <div className="svg-container w-full max-w-md mx-auto my-2 p-1.5 bg-slate-950 rounded-lg border border-red-500/10" dangerouslySetInnerHTML={{ __html: qData.svg }} />
          )}
          {qData?.options && (
            <div className="grid gap-2 max-w-lg mx-auto mt-2">
              {(qData.options as string[]).map((opt: string, i: number) => {
                const isSelected = qData.multiple
                  ? current.split(',').map((s) => s.trim()).includes(opt)
                  : current === opt;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (qData.multiple) {
                        const cur = current ? current.split(',').map((s) => s.trim()).filter(Boolean) : [];
                        setCurrent(cur.includes(opt) ? cur.filter((s) => s !== opt).join(',') : [...cur, opt].join(','));
                      } else {
                        setCurrent(opt);
                      }
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm
                      ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50'}`}
                  >
                    <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>
                    <FractionText text={opt} auto />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {guidedTestProblem && (
          <div className="max-w-lg mx-auto">
            {/* key必須: 問題が変わったらエンジンを作り直す(前問の完了状態の持ち越し防止) */}
            <GuidedAnswerHost key={index} problem={guidedTestProblem} onComplete={handleGuidedComplete} />
          </div>
        )}

        {!qData?.options && !guidedTestProblem && (
          <div className="max-w-lg mx-auto">
            <div className="min-h-[3rem] p-3 bg-slate-950/60 rounded-xl border-2 border-red-500/30 flex items-center mb-2">
              <span className="text-xs font-bold text-red-400 mr-3">解答:</span>
              {isFractionKeypad ? (
                <span className="text-xl font-mono text-red-200 font-bold">
                  <PartialFractionDisplay raw={current} placeholder="キーパッドで入力..." />
                </span>
              ) : (
                <span className="text-xl font-mono text-red-200 font-bold">{current || <span className="text-red-800 text-sm">キーパッドで入力...</span>}</span>
              )}
            </div>
            <Keypad onKeyClick={handleKey} layout={keypadLayout} />
          </div>
        )}

        <div className="flex gap-2 mt-3 max-w-lg mx-auto">
          <button
            onClick={() => { if (window.confirm('テストを中止しますか? (記録は のこりません)')) onExit(); }}
            className="btn-tactical px-4 py-3 rounded-xl font-bold text-white/40 border-white/10 text-xs"
          >
            中止
          </button>
          {!guidedTestProblem && (
            <button
              onClick={handleNext}
              disabled={!current}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white font-bold py-3 rounded-xl transition-all border border-blue-400/30"
            >
              {index < questions.length - 1 ? 'つぎの問題へ' : '答え合わせをする'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MockTestMode;
