/**
 * gameBalance.ts — ゲームバランス調整値の一元管理
 *
 * 散在していたマジックナンバーを集約。調整の根拠をコメントで残すこと。
 * (HP・ダメージ式は constants.ts の INITIAL_HP / calcDamage を参照)
 */

/** スピード対戦: 1ラウンドの制限時間（秒） */
export const SPEED_DUEL_TIME_LIMIT_SEC = 30;

/** スピード対戦: ラウンド開始前カウントダウン（ms） */
export const SPEED_DUEL_COUNTDOWN_MS = 1500;

/**
 * スピード対戦CPU — 動的難易度調整 (DDA)
 *
 * 旧実装は「一律5〜20秒・正答率65%」の固定値で、プレイヤーの実力と
 * 無関係だった。新実装はカードバトルと同じくプレイヤー自身の
 * 難易度別平均解答時間 (userLevelStats) を基準にCPUの速度を決める。
 * 狙い: プレイヤー勝率が常に5〜7割の「拮抗した勝負」を維持する
 * （フロー理論: 挑戦と技能の均衡が没入を生む。Csikszentmihalyi 1990）
 */
export const SPEED_CPU = {
  /** プレイヤー平均解答時間に掛ける揺らぎ（0.9〜1.4倍 → 平均してやや遅い＝プレイヤー有利） */
  DELAY_JITTER_MIN: 0.9,
  DELAY_JITTER_MAX: 1.4,
  /** CPUの解答時間の下限・上限（ms）。制限時間30秒内に収める */
  MIN_DELAY_MS: 4000,
  MAX_DELAY_MS: 26000,
  /** 解答記録が少ないときのフォールバック: 難易度×6秒 */
  FALLBACK_MS_PER_DIFFICULTY: 6000,
  /** フォールバックを使う記録数のしきい値 */
  MIN_SAMPLE_COUNT: 3,
} as const;

/**
 * スピード対戦CPUの正答率: 難易度が高いほど下がる
 *   Lv1: 84% / Lv2: 76% / Lv3: 68% / Lv4: 60% / Lv5: 52%
 * （旧: 全難易度一律65%）
 */
export const speedCpuAccuracy = (difficulty: number): number => {
  const acc = 0.92 - 0.08 * difficulty;
  return Math.min(0.85, Math.max(0.5, acc));
};

/**
 * スピード対戦の対戦報酬（旧実装は報酬なし＝報酬ループから漏れていた）
 * カードバトル（勝利500exp/300MP）より短時間で終わるため約6割に設定。
 * 敗北にも少額の経験値を与え「挑戦自体が前進」にする
 * （目標設定理論: Locke & Latham 1990）
 */
export const SPEED_DUEL_REWARDS = {
  win: { exp: 300, mp: 150 },
  draw: { exp: 150, mp: 0 },
  lose: { exp: 75, mp: 0 },
} as const;
