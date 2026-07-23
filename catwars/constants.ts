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
    damage: 20,
    range: 4,
    description: '地上ユニット一ボットを単体狙撃する基本的な防衛設備です。攻撃速度が一定で、近接ユニットに有効です。',
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
    damage: 40,
    range: 3.5,
    description: '地中に隠されており、敵兵士が侵入半径に接触した瞬間に姿を現し、強力な電撃をお見舞いする防御罠です。',
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