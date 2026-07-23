/**
 * services/practiceRewardService.ts
 *
 * 練習モードの「1項目クリア」MP報酬に歯止めをかける。
 * かんたんな項目を連続で周回して MP を荒稼ぎできてしまうと、報酬の意味が
 * 薄れ、本来ねらう「間隔をあけた自己テスト」の動機づけを損なう
 * (過剰正当化効果: Deci, Koestner & Ryan, 1999)。
 *
 * ルール: Bランク以上の結果でのみ MP を付与する。そのうえで、
 *   ・その項目でその日まだ MP を受け取っていない(その日はじめてのクリア)、または
 *   ・自己ベスト(全期間)を更新した
 * のどちらかを満たすときだけ実際に付与する。単なる周回では 0MP になる一方、
 * 何度でも挑戦して自己ベストを更新すれば必ず報われるので、反復練習そのものは
 * 妨げない。
 */
const BEST_KEY = 'battleMathPracticeBestBySubtopic';
const DAILY_KEY_PREFIX = 'battleMathPracticeDailyReward_';

const getTodayStr = (): string => new Date().toISOString().slice(0, 10);

const readBestMap = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { return {}; }
};
const writeBestMap = (m: Record<string, number>) => {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(m)); } catch {}
};
const readDailySet = (): Record<string, true> => {
  try { return JSON.parse(localStorage.getItem(DAILY_KEY_PREFIX + getTodayStr()) || '{}'); } catch { return {}; }
};
const writeDailySet = (m: Record<string, true>) => {
  try { localStorage.setItem(DAILY_KEY_PREFIX + getTodayStr(), JSON.stringify(m)); } catch {}
};

export type PracticeRewardReason = 'rank-too-low' | 'first-clear-today' | 'new-best' | 'already-cleared-today';

export interface PracticeRewardDecision {
  /** 実際に付与する MP(0のこともある) */
  award: number;
  reason: PracticeRewardReason;
  /** 参考表示用: この項目の自己ベストMP(付与判定後の値) */
  bestMp: number;
}

/**
 * 1項目クリア時に呼ぶ。副作用として自己ベスト・本日の受け取り状況を更新する。
 * 呼び出しは1クリアにつき1回だけにすること(PracticeSummary の初回マウント時など)。
 */
export function evaluatePracticeReward(subTopic: string, rank: string, computedMpReward: number): PracticeRewardDecision {
  const bestMap = readBestMap();
  const prevBest = bestMap[subTopic] ?? 0;

  if (!['S', 'A', 'B'].includes(rank)) {
    return { award: 0, reason: 'rank-too-low', bestMp: prevBest };
  }

  const dailySet = readDailySet();
  const isFirstToday = !dailySet[subTopic];
  const isNewBest = computedMpReward > prevBest;

  if (!isFirstToday && !isNewBest) {
    return { award: 0, reason: 'already-cleared-today', bestMp: prevBest };
  }

  if (isNewBest) {
    bestMap[subTopic] = computedMpReward;
    writeBestMap(bestMap);
  }
  if (isFirstToday) {
    dailySet[subTopic] = true;
    writeDailySet(dailySet);
  }

  return {
    award: computedMpReward,
    reason: isFirstToday ? 'first-clear-today' : 'new-best',
    bestMp: Math.max(prevBest, computedMpReward),
  };
}
