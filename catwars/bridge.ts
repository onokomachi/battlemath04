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

export const CREDIT_PER_CORRECT = 12;   // 正解1問あたりのクレジット(CR)
export const ENERGY_PER_CORRECT = 2;    // 正解1問あたりのエナジー(EN・当日)
export const STUDY_XP_PER_CORRECT = 4;  // 正解1問あたり、各スターター系統へ配分するXP

const STARTER_IDS = CHARACTERS.filter(c => c.isStarter).map(c => c.id);

/**
 * 1問ぶんの解答結果を CAT-WARS 経済に反映する。
 * battlemath04 の recordAttempt（全モード共通の解答シンク）から呼ばれる。
 */
export function grantStudyReward(isCorrect: boolean, unitId?: string): void {
  const progress = useProgressStore.getState();
  // 学習量を記録（バフのティア解放条件・連続日数・SM-2 の更新）
  try { progress.recordAnswer(unitId ?? 'study', isCorrect); } catch { /* noop */ }
  if (!isCorrect) return;

  // 💠 クレジット（永続・建設/解放の元手）
  usePlayerStore.getState().addResources(CREDIT_PER_CORRECT);
  // ⚡ エナジー（当日・バフ/防衛/戦闘の元手）
  progress.addDailyStars(ENERGY_PER_CORRECT);
  // 学習でネコがすこし育つ（スターター系統へ薄く配分。主XP源は戦闘）
  const army = useArmyStore.getState();
  for (const id of STARTER_IDS) army.addXp(id, STUDY_XP_PER_CORRECT);
}

/** まとめ報酬（本番テスト完了時など、複数問ぶんをまとめて付与したい場面用） */
export function grantBulkReward(correctCount: number): void {
  if (correctCount <= 0) return;
  usePlayerStore.getState().addResources(CREDIT_PER_CORRECT * correctCount);
  useProgressStore.getState().addDailyStars(Math.round(ENERGY_PER_CORRECT * correctCount));
}
