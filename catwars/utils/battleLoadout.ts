import { BuildingType, BattleLoadout } from '../types';
import type { FacilityCounts } from '../store/useBaseStore';

/**
 * 「今日建てた施設」から、戦闘で使える能力を算出する。
 *
 * 施設は当日リセット制（useBaseStore）なので、今日たくさん問題を解いて
 * 施設をそろえた日ほど、出撃できる兵種も持ち込める防衛も増える。
 * ＝ 学習量がそのまま その日の戦力になる。
 */
export function computeBattleLoadout(built: FacilityCounts): BattleLoadout {
  const n = (type: BuildingType) => built[type] ?? 0;

  const barracks = n(BuildingType.BARRACKS);
  const armyCamps = n(BuildingType.ARMY_CAMP);
  const cannons = n(BuildingType.CANNON);
  const teslas = n(BuildingType.HIDDEN_TESLA);
  const walls = n(BuildingType.WALL);

  // 兵舎を建てるほど使える系統が増える（近接・タンクは常時開放）
  const unlockedTroopTypes = ['barbarian', 'giant'];
  if (barracks >= 1) unlockedTroopTypes.push('archer');
  if (barracks >= 2) unlockedTroopTypes.push('bomber');
  if (barracks >= 3) unlockedTroopTypes.push('magic');

  const availableBuildingTypes: BuildingType[] = [BuildingType.WALL];
  if (cannons > 0) availableBuildingTypes.push(BuildingType.CANNON);
  if (teslas > 0) availableBuildingTypes.push(BuildingType.HIDDEN_TESLA);

  return {
    unlockedTroopTypes,
    // 防衛スロット＝実際に建てた防衛施設の数（キャンプぶんの余裕を足す）
    maxBuildingSlots: cannons + teslas + armyCamps,
    canBringCannon: cannons > 0,
    canBringTesla: teslas > 0,
    maxWallSlots: walls,
    // 呪文はキャンプの数で増える（基本2 + キャンプ1つにつき1）
    healCharges: 2 + armyCamps,
    rageCharges: 2 + armyCamps,
    availableBuildingTypes,
  };
}
