// ── 拠点 → 戦場 への自動転写 ─────────────────────────────────────────────
//
// 課題（①）: 「拠点づくり」で組んだ拠点と、出撃直前の「作戦立案」での再配置が
// 二重になっていた。しかも `computeBattleLoadout()` の結果はどの画面でも参照されて
// おらず、拠点づくりで建てた施設は戦闘にまったく影響していなかった。
//
// 解決: 拠点づくりを唯一の拠点編集画面とし、出撃時に**その配置をそのまま戦場へ
// 転写する**。プレイヤーは同じ作業を2度やらされない。
//
// 転写のルール:
//   1. 戦場に出るのは 🏰コア / 壁 / 大砲 / テスラ / キャンプ のみ（金山・兵舎は経済・解放用）
//   2. 持ち込める数は `BattleLoadout` で制限する（＝拠点づくりの規模が戦力に直結する）
//   3. コアを自陣ゾーンの「最も奥」に置き、他の施設は拠点での**相対位置を保ったまま**配置
//   4. 相対位置が使えないとき（ゾーンが狭い・地形が邪魔）は、最も近い置ける場所へずらす

import {
  Building, BuildingType, BattleMap, BattleLoadout, DeployedBuilding, GRID_SIZE,
} from '../types';
import { BUILDING_STATS } from '../constants';

/** 戦場に転写する施設タイプ（このほかは拠点内の経済・解放専用） */
const FIELD_TYPES: BuildingType[] = [
  BuildingType.TOWN_HALL,
  BuildingType.ARMY_CAMP,
  BuildingType.CANNON,
  BuildingType.HIDDEN_TESLA,
  BuildingType.WALL,
];

/** 配置の優先順位（コア→防衛→キャンプ→壁）。枠が足りないときは後ろから落ちる。 */
const PRIORITY: Record<string, number> = {
  [BuildingType.TOWN_HALL]: 0,
  [BuildingType.CANNON]: 1,
  [BuildingType.HIDDEN_TESLA]: 1,
  [BuildingType.ARMY_CAMP]: 2,
  [BuildingType.WALL]: 3,
};

const impassableSet = (map: BattleMap): Set<string> => {
  const s = new Set<string>();
  for (const t of map.terrain) {
    if (t.type === 'WATER' || t.type === 'ROCK') s.add(`${t.x},${t.y}`);
  }
  return s;
};

const enemyCells = (map: BattleMap): Set<string> => {
  const s = new Set<string>();
  for (const e of map.enemyBase) {
    const st = BUILDING_STATS[e.type];
    for (let dy = 0; dy < st.height; dy++)
      for (let dx = 0; dx < st.width; dx++) s.add(`${e.x + dx},${e.y + dy}`);
  }
  return s;
};

/**
 * 拠点の建物リストから「戦場に持ち込む建物リスト」を選ぶ。
 * loadout の上限を超えるぶんは、優先度の低いものから切り捨てる。
 */
export function selectDeployableBuildings(
  buildings: Building[],
  loadout: BattleLoadout,
): Building[] {
  const th = buildings.find(b => b.type === BuildingType.TOWN_HALL);
  const rest = buildings
    .filter(b => b.type !== BuildingType.TOWN_HALL && FIELD_TYPES.includes(b.type))
    .filter(b => (b.type === BuildingType.CANNON ? loadout.canBringCannon : true))
    .filter(b => (b.type === BuildingType.HIDDEN_TESLA ? loadout.canBringTesla : true))
    .sort((a, b) => (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9));

  const out: Building[] = [];
  let walls = 0;
  let slots = 0;
  for (const b of rest) {
    if (b.type === BuildingType.WALL) {
      if (walls >= loadout.maxWallSlots) continue;
      walls++;
    } else {
      if (slots >= loadout.maxBuildingSlots) continue;
      slots++;
    }
    out.push(b);
  }
  // コアは必ず先頭（配置のアンカーになる）
  return th ? [th, ...out] : out;
}

/**
 * 拠点の配置を、戦場の自陣ゾーンへ転写する。
 * コアが無い拠点でも戦えるよう、コアが見つからないときは仮想コアを1つ作る。
 */
export function buildPlayerDeployments(
  buildings: Building[],
  map: BattleMap,
  loadout: BattleLoadout,
): DeployedBuilding[] {
  const selected = selectDeployableBuildings(buildings, loadout);
  const blocked = impassableSet(map);
  const enemies = enemyCells(map);
  const zone = map.playerDeployZone;

  const occupied = new Set<string>();

  const fits = (type: BuildingType, x: number, y: number): boolean => {
    const st = BUILDING_STATS[type];
    if (x < zone.xMin || y < zone.yMin) return false;
    if (x + st.width - 1 > Math.min(zone.xMax, GRID_SIZE - 1)) return false;
    if (y + st.height - 1 > Math.min(zone.yMax, GRID_SIZE - 1)) return false;
    for (let dy = 0; dy < st.height; dy++) {
      for (let dx = 0; dx < st.width; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (blocked.has(k) || enemies.has(k) || occupied.has(k)) return false;
      }
    }
    return true;
  };

  const occupy = (type: BuildingType, x: number, y: number) => {
    const st = BUILDING_STATS[type];
    for (let dy = 0; dy < st.height; dy++)
      for (let dx = 0; dx < st.width; dx++) occupied.add(`${x + dx},${y + dy}`);
  };

  // 敵拠点の重心。ここから最も遠いゾーン内の位置が「自陣のいちばん奥」。
  const ec = map.enemyBase.length
    ? {
        x: map.enemyBase.reduce((s, e) => s + e.x, 0) / map.enemyBase.length,
        y: map.enemyBase.reduce((s, e) => s + e.y, 0) / map.enemyBase.length,
      }
    : { x: GRID_SIZE / 2, y: 0 };
  const zc = { x: (zone.xMin + zone.xMax) / 2, y: (zone.yMin + zone.yMax) / 2 };

  /** ゾーン内で条件を満たす位置を、スコアの良い順に探す */
  const bestCell = (
    type: BuildingType,
    score: (x: number, y: number) => number,
  ): { x: number; y: number } | null => {
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    for (let y = zone.yMin; y <= Math.min(zone.yMax, GRID_SIZE - 1); y++) {
      for (let x = zone.xMin; x <= Math.min(zone.xMax, GRID_SIZE - 1); x++) {
        if (!fits(type, x, y)) continue;
        const s = score(x, y);
        if (s > bestScore) { bestScore = s; best = { x, y }; }
      }
    }
    return best;
  };

  const result: DeployedBuilding[] = [];

  // 1) コアを自陣の最も奥（敵から遠く、ゾーンの中央寄り）に置く
  const coreSpot =
    bestCell(BuildingType.TOWN_HALL, (x, y) =>
      Math.hypot(x - ec.x, y - ec.y) - 0.35 * Math.hypot(x - zc.x, y - zc.y),
    ) ?? bestCell(BuildingType.TOWN_HALL, () => 0);

  if (!coreSpot) return result; // ゾーンにコアすら置けない異常マップ

  occupy(BuildingType.TOWN_HALL, coreSpot.x, coreSpot.y);
  result.push({ type: BuildingType.TOWN_HALL, x: coreSpot.x, y: coreSpot.y });

  // 2) 残りは拠点での相対位置を保って配置。置けなければ最寄りの空きへずらす。
  const baseCore = selected.find(b => b.type === BuildingType.TOWN_HALL);
  const originX = baseCore ? baseCore.position.x : 7;
  const originY = baseCore ? baseCore.position.y : 7;

  for (const b of selected) {
    if (b.type === BuildingType.TOWN_HALL) continue;
    const wantX = coreSpot.x + (b.position.x - originX);
    const wantY = coreSpot.y + (b.position.y - originY);

    let spot: { x: number; y: number } | null = null;
    if (fits(b.type, wantX, wantY)) {
      spot = { x: wantX, y: wantY };
    } else {
      // 望みの位置に近く、かつ敵に向かって前に出すぎない場所を選ぶ
      spot = bestCell(b.type, (x, y) => -Math.hypot(x - wantX, y - wantY));
    }
    if (!spot) continue; // ゾーンが満杯

    occupy(b.type, spot.x, spot.y);
    result.push({ type: b.type, x: spot.x, y: spot.y });
  }

  return result;
}
