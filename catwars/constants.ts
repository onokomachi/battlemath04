import { BuildingType, Troop } from './types';
import { CHARACTERS } from './data/characters';

export const BUILDING_STATS: Record<BuildingType, {
  name: string;
  cost: { gold: number };
  hp: number;
  description: string;
  role: string; // Detailed functional role
  productionRate?: number; // Per minute
  capacity?: number;
  width: number;
  height: number;
  color: string;
  icon: string;
  damage?: number;
  range?: number;
  /** 攻撃間隔(ms)。未指定なら 1000ms 扱い */
  attackSpeed?: number;
  /** 新しい標的をとらえてから初弾を撃つまでの「照準時間」(ms)。予告として機能する */
  aimTimeMs?: number;
  buildTime: number; // Seconds
}> = {
  [BuildingType.TOWN_HALL]: {
    name: 'タウンホール',
    cost: { gold: 500 },
    hp: 1500,
    description: '村の中枢です。破壊されると敵に大量の戦利品を奪われます。防衛の最深部に配置してください。',
    role: '行政・中心拠点 (最重要防衛対象)',
    width: 2,
    height: 2,
    color: 'bg-gradient-to-b from-blue-400 to-blue-700 border-2 border-blue-300',
    icon: '🏰',
    buildTime: 10
  },
  [BuildingType.GOLD_MINE]: {
    name: '金山',
    cost: { gold: 100 },
    hp: 400,
    productionRate: 100,
    description: '地下からゴールド（金貨）を自動で採掘します。放置すると貯留量が満タンになり生産が止まります。',
    role: '資源生産 [ゴールド] (経済基盤)',
    width: 1,
    height: 1,
    color: 'bg-gradient-to-b from-yellow-300 to-yellow-600 border-2 border-yellow-200',
    icon: '⛏️',
    buildTime: 5
  },
  [BuildingType.BARRACKS]: {
    name: '兵舎',
    cost: { gold: 200 },
    hp: 500,
    description: 'エリクサーを消費して、戦闘用の各種ユニット（バーバリアン、アーチャー、ジャイアント）を訓練します。',
    role: 'ユニット訓練所 (軍事雇用ルーター)',
    width: 1,
    height: 1,
    color: 'bg-gradient-to-b from-red-500 to-red-800 border-2 border-red-400',
    icon: '⚔️',
    buildTime: 8
  },
  [BuildingType.ARMY_CAMP]: {
    name: 'アーミーキャンプ',
    cost: { gold: 200 },
    hp: 400,
    description: '訓練が完了した戦闘ユニットが待機する広場です。この設備が多いほど、一度に多くの兵士を貯められます。',
    role: '軍隊待機所 (収容量上限の増加)',
    width: 2,
    height: 2,
    color: 'bg-gradient-to-b from-green-600 to-green-900 border-2 border-green-500',
    icon: '⛺',
    buildTime: 8
  },
  [BuildingType.WALL]: {
    name: '壁',
    cost: { gold: 50 },
    hp: 1000,
    description: '頑丈な石壁です。射程距離の短い地上ユニットの侵入経路を阻み、ターゲットへの到達時間を遅らせます。',
    role: '防衛障壁 (ルート妨害・遅延効果)',
    width: 1,
    height: 1,
    color: 'bg-gradient-to-b from-stone-300 to-stone-600 border border-stone-400',
    icon: '', // Walls look better as blocks
    buildTime: 1
  },
  [BuildingType.CANNON]: {
    name: '大砲',
    cost: { gold: 150 },
    hp: 600,
    // ⑥ バランス調整（旧: damage 20 / range 4 / 攻撃間隔 1000ms = 20 DPS）
    //   → 10.8 DPS。基本ネコ(HP60)が倒れるまで 5.6秒（旧 3.0秒）。
    //   根拠と目標値は catwars/data/campaign.ts 冒頭および docs/CATWARS_DESIGN.md を参照。
    //   射程を 3.2 にしたことで、遠距離系(射程3.5)が一方的に削れる「相性」が成立する。
    damage: 14,
    range: 3.2,
    attackSpeed: 1300,
    aimTimeMs: 700,
    description: '地上ユニットを単体で狙撃する基本の防衛設備。撃つ前に700msの照準時間があり、壁のむこう側はねらえません。',
    role: '防衛防御 [単体地上専用] (標準防衛)',
    width: 1,
    height: 1,
    color: 'bg-gradient-to-b from-gray-700 to-black border-2 border-gray-600',
    icon: '💣',
    buildTime: 15
  },
  [BuildingType.HIDDEN_TESLA]: {
    name: '隠しテスラ',
    cost: { gold: 500 },
    hp: 600,
    // ⑥ バランス調整（旧: damage 40 / range 3.5 / 1000ms = 40 DPS → 基本ネコが1.5秒で溶けた）
    //   → 11 DPS・射程2.6。「1発が重いが発射が遅い」形にして奇襲の鋭さは残しつつ、
    //   最難関の第8章（防衛威力×1.3）でも基本ネコのTTKが4.2秒を下回らないようにした。
    damage: 22,
    range: 2.6,
    attackSpeed: 2000,
    aimTimeMs: 250,
    description: '地中に隠れており、敵が近づいた瞬間に現れて電撃を放つ罠。射程は短いぶん、不意をつかれると痛い。壁のむこう側はねらえません。',
    role: '防衛奇襲 [単体対地対空] (高DPS奇襲)',
    width: 1,
    height: 1,
    color: 'bg-gradient-to-b from-cyan-400 to-blue-600 border-2 border-cyan-200',
    icon: '⚡',
    buildTime: 30
  }
};

// 8系統のキャラ図鑑から初期兵士を生成（単一ソース化）
export const INITIAL_TROOPS: Troop[] = CHARACTERS.map((c) => ({
  id: c.id,
  name: c.forms[0].name,
  count: 0,
  damage: c.base.damage,
  hp: c.base.hp,
  target: c.base.target,
  moveSpeed: c.base.moveSpeed,
}));

export const MOCK_ENEMY_BASE = [
  { type: BuildingType.TOWN_HALL, x: 7, y: 7 },
  { type: BuildingType.GOLD_MINE, x: 5, y: 7 },
  { type: BuildingType.GOLD_MINE, x: 9, y: 7 },
  { type: BuildingType.CANNON, x: 7, y: 5 },
  { type: BuildingType.WALL, x: 6, y: 6 },
  { type: BuildingType.WALL, x: 7, y: 6 },
  { type: BuildingType.WALL, x: 8, y: 6 },
  { type: BuildingType.HIDDEN_TESLA, x: 8, y: 8 }, 
];