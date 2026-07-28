// ── 問題の「重み」＝ 難易度 × 所要工程 による報酬の傾斜配分 ────────────────────
//
// 課題（テストプレイでの指摘）:
//   「一瞬で答えられる問題」と「何工程もある問題」が同じポイントなのは不公平で、
//   ゲームバランスを欠く。
//
// 設計方針:
//   報酬 = 基準値 × m、m = 難易度係数 × 所要工程係数（0.6〜2.0 にクランプ）
//
//   ・難易度係数: 既存の `difficultyMap`（全96サブトピックに 1〜5 を付与ずみ。
//     学習指導要領の系統性にもとづき単元内の順序で難度を割り当てたもの）を再利用する。
//     新しい難易度表を別に作らないことで、カードバトルの `calcDamage` と
//     CAT-WARS の報酬が同じ難易度観を共有する（単一ソース）。
//   ・所要工程係数: 「解答にかかる操作の工程数」を問題タイプから推定する。
//       guided（筆算シミュレーター・エラーハンター等）… 位ごとに商→積→差を書く多工程 → 重い
//       選択肢（options）……………………………………… 見て選ぶだけの即答 → 軽い
//       図つき（svg）………………………………………… 図の読み取りが1工程加わる → やや重い
//
// エビデンス:
//   ・[レベル2: 確立した理論の応用] 認知負荷理論 (Sweller 1988; Sweller et al. 2011)。
//     課題の「要素相互作用性(element interactivity)」＝同時に保持すべき要素数が
//     内在的認知負荷を決める。多工程の筆算は要素相互作用性が高く、単発の大小判断は低い。
//     報酬を負荷に比例させることは、負荷の高い課題を回避する動機を打ち消す。
//   ・[レベル2] 努力に見合わない報酬は、行動経済学でいう努力割引(effort discounting;
//     Botvinick et al. 2009)により回避行動を生む。均一報酬下では最短時間で解ける
//     項目のみを周回するのが合理的戦略になり、実際に本アプリでもそれが可能だった。
//   ・[レベル3: 実務上の定石] 学習ゲームでは「報酬 ∝ 学習上の価値」が原則
//     (Lomas et al. 2013, CHI; Deci, Koestner & Ryan 1999 の過剰正当化効果を避ける設計)。
//
// 注: 既存の MP(mathPoints) システムには手を触れない。ここで傾斜をかけるのは
//     CAT-WARS の 💠クレジット / ⚡エナジー / 部隊XP のみ。

import { difficultyMap } from '../../constants';
import type { Problem } from '../../types';

/** 報酬倍率の下限・上限（極端な差でバランスが壊れないようにする） */
export const MIN_MULTIPLIER = 0.6;
export const MAX_MULTIPLIER = 2.0;

/**
 * 難易度(1〜5) → 係数。
 * 差がつきすぎると「かんたんな単元をやる意味がない」と感じさせてしまうため、
 * 1段階あたり +0.14 のゆるやかな傾斜にしている（難度1と5で約1.65倍）。
 */
export function difficultyFactor(difficulty: number): number {
  const d = Math.max(1, Math.min(5, difficulty || 3));
  return 0.72 + 0.14 * d;
}

/** サブトピック名 → 難易度(1〜5)。未知の項目は中庸の3として扱う。 */
export function difficultyOfSubtopic(subtopic?: string): number {
  if (!subtopic) return 3;
  return difficultyMap[subtopic] ?? 3;
}

/**
 * 問題タイプ → 所要工程係数。
 * 「答えを出すまでに何回の判断・入力を要するか」の近似。
 */
export function stepFactor(problem?: Problem | null): number {
  if (!problem) return 1;
  const data = (problem.data ?? {}) as { options?: unknown; svg?: unknown };

  // 選択肢問題は「読む→選ぶ」の1工程。一瞬で答えられるので軽い。
  if (Array.isArray(data.options)) return 0.78;

  // guided は筆算シミュレーター等。位ごとに複数回の入力・判定を行う多工程タイプ。
  if (problem.type === 'guided') return 1.45;

  // 図（角度・面積・数直線・展開図など）は読み取りの工程が1つ増える。
  if (data.svg) return 1.12;

  return 1;
}

/**
 * この問題1問ぶんの報酬倍率（0.6〜2.0）。
 * subtopic は `getMixedProblemSet` が付与する `category`、または学習記録の単元名。
 */
export function problemRewardMultiplier(problem?: Problem | null, subtopic?: string): number {
  const sub = subtopic ?? (problem as { category?: string } | null | undefined)?.category;
  const m = difficultyFactor(difficultyOfSubtopic(sub)) * stepFactor(problem);
  return Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, m));
}

/** 子どもに見せる用の短いラベル（なぜ多くもらえたのかを可視化する） */
export function rewardTierLabel(multiplier: number): { label: string; color: string } | null {
  if (multiplier >= 1.6) return { label: 'むずかしい問題ボーナス', color: '#f472b6' };
  if (multiplier >= 1.25) return { label: 'てごたえボーナス', color: '#facc15' };
  return null;
}
