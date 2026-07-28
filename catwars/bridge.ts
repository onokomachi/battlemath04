// ── CAT-WARS 経済ブリッジ ───────────────────────────────────────────────
// battlemath04 の学習（練習/スピード/復習）で問題に正解するたびに、
// CAT-WARS 側の通貨・部隊育成へ「加算的に」報酬を流し込む。
// 既存の mathPoints(MP) システムには一切手を触れない（後戻り可能・低リスク）。
//
// 2通貨設計（詳細は docs/CATWARS_DESIGN.md）:
//   💠 クレジット(CR) … 永続通貨。建設・強化・レアネコ解放の元手。正解でコツコツ貯まる。
//   ⚡ エナジー(EN)   … 当日リセット。出撃バフ／防衛配置／戦闘の元手。今日の学習ぶんは今日つかう。
//   部隊XP           … 通貨ではなく自動成長。学習で薄く・戦闘で厚く育ち、レベル→進化する。
//   （内部の store フィールド名 resources.gold=CR / dailyStars=EN は後方互換のため据え置き）

import { usePlayerStore } from './store/usePlayerStore';
import { useProgressStore } from './store/useProgressStore';
import { useArmyStore } from './store/useArmyStore';
import { CHARACTERS } from './data/characters';
import { difficultyFactor, difficultyOfSubtopic } from './data/problemWeights';

export const CREDIT_PER_CORRECT = 12;   // 難易度3(標準)の問題1問あたりのクレジット(CR)
export const ENERGY_PER_CORRECT = 2;    // 難易度3の問題1問あたりのエナジー(EN・当日)
export const STUDY_XP_PER_CORRECT = 4;  // 難易度3の問題1問あたり、各スターター系統へ配分するXP

const STARTER_IDS = CHARACTERS.filter(c => c.isStarter).map(c => c.id);

/**
 * ③ 学習報酬の傾斜配分。
 * recordAttempt からは単元(サブトピック)名しか渡ってこないため、ここでは
 * `difficultyMap` にもとづく難易度係数のみを適用する（問題タイプ補正は、問題オブジェクトが
 * 手元にある戦闘中クイズ側で適用される）。難易度3を基準の1.0とし、
 * 難易度1で約0.75倍、難易度5で約1.25倍になる。
 */
function studyMultiplier(subtopic?: string): number {
  const base = difficultyFactor(3); // = 1.14
  return difficultyFactor(difficultyOfSubtopic(subtopic)) / base;
}

/**
 * 1問ぶんの解答結果を CAT-WARS 経済に反映する。
 * battlemath04 の recordAttempt（全モード共通の解答シンク）から呼ばれる。
 * @param unitId 学習記録上の単元名（＝サブトピック名）。報酬の重みづけにも使う。
 */
export function grantStudyReward(isCorrect: boolean, unitId?: string): void {
  const progress = useProgressStore.getState();
  // 学習量を記録（バフのティア解放条件・連続日数・SM-2 の更新）
  try { progress.recordAnswer(unitId ?? 'study', isCorrect); } catch { /* noop */ }
  if (!isCorrect) return;

  const m = studyMultiplier(unitId);

  // 💠 クレジット（永続・建設/解放の元手）
  usePlayerStore.getState().addResources(Math.round(CREDIT_PER_CORRECT * m));
  // ⚡ エナジー（当日・バフ/防衛/戦闘の元手）。0にならないよう最低1は保証する。
  progress.addDailyStars(Math.max(1, Math.round(ENERGY_PER_CORRECT * m)));
  // 学習でネコがすこし育つ（スターター系統へ薄く配分。主XP源は戦闘）
  const army = useArmyStore.getState();
  const xp = Math.max(1, Math.round(STUDY_XP_PER_CORRECT * m));
  for (const id of STARTER_IDS) army.addXp(id, xp);
}

/** まとめ報酬（本番テスト完了時など、複数問ぶんをまとめて付与したい場面用） */
export function grantBulkReward(correctCount: number): void {
  if (correctCount <= 0) return;
  usePlayerStore.getState().addResources(CREDIT_PER_CORRECT * correctCount);
  useProgressStore.getState().addDailyStars(Math.round(ENERGY_PER_CORRECT * correctCount));
}
