
import { ALL_PROBLEM_SETS } from '../data';
import { Problem } from '../types';

const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

/**
 * 1セッションの出題数(サブトピックのタイプ別)。
 * エビデンス: 認知負荷理論 (Sweller, 2011) - タスクの複雑さに応じた適切な量の設定。
 * 文章題は1問あたりの読解・処理負荷が高いため少なめ、単純な大小判断のような
 * 一瞬で答えられる問題は負荷が低いため多めに出題して反復頻度を確保する。
 */
const WORD_PROBLEM_SESSION_SIZE = 3;
const QUICK_JUDGMENT_SESSION_SIZE = 8;
const DEFAULT_SESSION_SIZE = 5;

const isWordProblemSubTopic = (subTopic: string): boolean => /文章題|文しょうだい/.test(subTopic);
const isQuickJudgmentSubTopic = (subTopic: string): boolean => /大小/.test(subTopic);

/** サブトピック名から1セッションあたりの出題数を判定する */
export const getSessionSize = (subTopic: string): number => {
  if (isWordProblemSubTopic(subTopic)) return WORD_PROBLEM_SESSION_SIZE;
  if (isQuickJudgmentSubTopic(subTopic)) return QUICK_JUDGMENT_SESSION_SIZE;
  return DEFAULT_SESSION_SIZE;
};

/**
 * 指定された分野と単元の問題セットをシャッフルし、最適な数に制限して返す。
 */
export const getShuffledProblemSet = (category: string, subTopic: string): Problem[] => {
  const problemSet = ALL_PROBLEM_SETS[subTopic] || [];
  const shuffled = shuffleArray(problemSet);
  const sessionSize = getSessionSize(subTopic);
  return shuffled.slice(0, Math.min(sessionSize, shuffled.length));
};

/**
 * 複数サブトピックの問題をまとめてシャッフルし、指定件数に切り詰めて返す(ミックス演習用)。
 * エビデンスA: インターリーブ効果 (Rohrer & Taylor, 2007) — 類題を混ぜて出題すると
 * 解法を毎回自分で判別する負荷が生まれ、ブロック練習より長期定着率が高い。
 * 各問題には元のサブトピック名を category として付与し、学習記録・弱点分析・SRSへの
 * 記録が単元別に正しく振り分けられるようにする。
 */
export const getMixedProblemSet = (subtopics: string[], count: number): (Problem & { category: string })[] => {
  const pooled = subtopics.flatMap(subTopic =>
    (ALL_PROBLEM_SETS[subTopic] || []).map(p => ({ ...p, category: subTopic }))
  );
  const shuffled = shuffleArray(pooled);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};
