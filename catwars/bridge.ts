// ── CAT-WARS 経済ブリッジ ───────────────────────────────────────────────
// battlemath04 の学習（練習/スピード/復習）で問題に正解するたびに、
// CAT-WARS 側の通貨・部隊育成へ「加算的に」報酬を流し込む。
// 既存の mathPoints(MP) システムには一切手を触れない（後戻り可能・低リスク）。
//
// 3層通貨設計（詳細は docs/CATWARS_DESIGN.md）:
//   💰 ゴールド   … ソフト通貨。建設・出撃の元手。正解でどんどん貯まる。
//   ⭐ デイリースター … 出撃バフ／防衛施設配置の元手（当日かぎり）。
//   🌟 スーパースター … 希少。レアな宇宙ネコの解放。まれにドロップ。
//   部隊XP        … そのネコが強くなる。学習でも薄く育ち、戦闘で大きく育つ。

import { usePlayerStore } from './store/usePlayerStore';
import { useProgressStore } from './store/useProgressStore';
import { useArmyStore } from './store/useArmyStore';
import { CHARACTERS } from './data/characters';

export const GOLD_PER_CORRECT = 12;       // 正解1問あたりのゴールド
export const DAILY_STAR_PER_CORRECT = 1;  // 正解1問あたりのデイリースター
export const STUDY_XP_PER_CORRECT = 4;    // 正解1問あたり、各スターター系統へ配分するXP

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

  // 💰 ゴールド
  usePlayerStore.getState().addResources(GOLD_PER_CORRECT);
  // ⭐ デイリースター（バフ・施設の元手）
  progress.addDailyStars(DAILY_STAR_PER_CORRECT);
  // 🌟 まれにスーパースター
  progress.rollSuperStar();
  // 学習でネコがすこし育つ（スターター系統へ薄く配分。主XP源は戦闘）
  const army = useArmyStore.getState();
  for (const id of STARTER_IDS) army.addXp(id, STUDY_XP_PER_CORRECT);
}

/** まとめ報酬（本番テスト完了時など、複数問ぶんをまとめて付与したい場面用） */
export function grantBulkReward(correctCount: number): void {
  if (correctCount <= 0) return;
  usePlayerStore.getState().addResources(GOLD_PER_CORRECT * correctCount);
  useProgressStore.getState().addDailyStars(Math.round(DAILY_STAR_PER_CORRECT * correctCount));
}
