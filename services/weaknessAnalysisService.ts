/**
 * weaknessAnalysisService.ts — 弱点分析エンジン
 *
 * エビデンスA: Wang, Haertel & Walberg (1993) メタ認知メタ分析 (ES=0.69)
 *   学習者が自分の弱点を自覚することで学習効率が向上
 *
 * エビデンスA: Hattie (2009) Visible Learning — フィードバックES=0.73
 *   「何ができていて何ができていないか」の可視化が最重要
 *
 * データ: localStorage `bm_category_stats`
 * 構造: { [category]: { correct: number, total: number, lastAttempt: string } }
 */

export interface CategoryStat {
  correct: number;
  total: number;
  lastAttempt: string;
}

export interface WeaknessReport {
  category: string;
  accuracy: number;       // 0-100
  totalAttempts: number;
  status: 'mastered' | 'proficient' | 'developing' | 'struggling';
  recommendation: string;
}

const STORAGE_KEY = 'bm_category_stats';

const getTodayStr = (): string => new Date().toISOString().slice(0, 10);

/** 全カテゴリ統計を取得 */
export const getCategoryStats = (): Record<string, CategoryStat> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** 正解/不正解を記録 */
export const recordAttempt = (category: string, isCorrect: boolean): void => {
  const stats = getCategoryStats();
  if (!stats[category]) {
    stats[category] = { correct: 0, total: 0, lastAttempt: '' };
  }
  stats[category].total += 1;
  if (isCorrect) stats[category].correct += 1;
  stats[category].lastAttempt = getTodayStr();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
};

/** 正答率によるステータス判定 */
const getStatus = (accuracy: number, total: number): WeaknessReport['status'] => {
  if (total < 5) return 'developing'; // データ不足
  if (accuracy >= 85) return 'mastered';
  if (accuracy >= 65) return 'proficient';
  if (accuracy >= 40) return 'developing';
  return 'struggling';
};

/** 弱点レポートを生成（正答率昇順 = 弱い分野が先） */
export const getWeaknessReport = (): WeaknessReport[] => {
  const stats = getCategoryStats();
  const reports: WeaknessReport[] = [];

  Object.entries(stats).forEach(([category, stat]) => {
    const accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    const status = getStatus(accuracy, stat.total);

    let recommendation = '';
    if (status === 'struggling') {
      recommendation = 'この分野を重点的に練習しましょう';
    } else if (status === 'developing') {
      recommendation = stat.total < 5 ? 'もう少し問題を解いてみましょう' : '基礎をもう一度確認しましょう';
    } else if (status === 'proficient') {
      recommendation = '応用問題にもチャレンジしてみましょう';
    } else {
      recommendation = '素晴らしい理解力です！';
    }

    reports.push({
      category,
      accuracy,
      totalAttempts: stat.total,
      status,
      recommendation,
    });
  });

  // 弱い順にソート
  reports.sort((a, b) => a.accuracy - b.accuracy);
  return reports;
};

/** 最弱カテゴリを取得（練習推薦用） */
export const getWeakestCategory = (): string | null => {
  const reports = getWeaknessReport();
  const struggling = reports.filter(r => r.status === 'struggling' || r.status === 'developing');
  return struggling.length > 0 ? struggling[0].category : null;
};

/**
 * ZPDベースのカテゴリ重み付けを取得
 * エビデンスA: Vygotsky (1978) Zone of Proximal Development
 *   正答率40-75%の領域が最も学習効果が高い
 *
 * 重み: struggling(正答率<40%) = 3, developing/ZPD(40-75%) = 5, proficient(75-85%) = 2, mastered(85%+) = 1
 * 未出題カテゴリ = 2（探索促進）
 */
export const getCategoryWeights = (): Record<string, number> => {
  const stats = getCategoryStats();
  const weights: Record<string, number> = {};

  Object.entries(stats).forEach(([category, stat]) => {
    if (stat.total < 3) {
      weights[category] = 2; // データ不足 → 探索
      return;
    }
    const accuracy = (stat.correct / stat.total) * 100;
    if (accuracy < 40) {
      weights[category] = 3;      // 要復習
    } else if (accuracy < 75) {
      weights[category] = 5;      // ZPD — 最大重み
    } else if (accuracy < 85) {
      weights[category] = 2;      // 良好
    } else {
      weights[category] = 1;      // 習得済み
    }
  });

  return weights;
};

/** 全体の平均正答率 */
export const getOverallAccuracy = (): number => {
  const stats = getCategoryStats();
  let totalCorrect = 0;
  let totalAttempts = 0;
  Object.values(stats).forEach(s => {
    totalCorrect += s.correct;
    totalAttempts += s.total;
  });
  return totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
};
