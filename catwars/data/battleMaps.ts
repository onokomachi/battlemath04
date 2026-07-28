import { BattleMap, TerrainTile, BuildingType } from '../types';

// ── CAT-WARS 戦場フィールド（全8種・ストーリーの章と1対1）────────────────────
// 章が進むほど地形が「読み解く要素」を増やしていく設計:
//   第1章 障害物なし → 第2章 1本道の峡谷 → 第3章 迂回ルート → 第4章 壁の要塞
//   → 第5章 橋（合流点） → 第6章 重力沼（減速帯） → 第7章 複合ルート → 第8章 総合
// エビデンス: 段階的な要素導入（Gee 2003「well-ordered problems」/ Koster 2013）。
// 新要素を1章につき1つだけ足すことで、認知負荷を上げすぎずに戦術の幅を広げる。

// helper functions
const row = (y: number, type: TerrainTile['type'], xMin = 0, xMax = 14): TerrainTile[] =>
  Array.from({ length: xMax - xMin + 1 }, (_, i) => ({ x: xMin + i, y, type }));

const col = (x: number, type: TerrainTile['type'], yMin = 0, yMax = 14): TerrainTile[] =>
  Array.from({ length: yMax - yMin + 1 }, (_, i) => ({ x, y: yMin + i, type }));

const cell = (x: number, y: number, type: TerrainTile['type']): TerrainTile => ({ x, y, type });

/** 矩形範囲をまとめて1種類の地形にする */
const rect = (
  xMin: number, yMin: number, xMax: number, yMax: number, type: TerrainTile['type'],
): TerrainTile[] => {
  const out: TerrainTile[] = [];
  for (let y = yMin; y <= yMax; y++) for (let x = xMin; x <= xMax; x++) out.push({ x, y, type });
  return out;
};

export const BATTLE_MAPS: BattleMap[] = [
  // ── 第1章: 障害物なし。純粋に「出す→進む→こわす」を体験させる ──
  {
    id: 'map-outpost',
    name: 'ルナ・アウトポスト',
    description: 'さえぎるものが何もない月面の前哨基地。まずはネコを出してコアを壊してみよう！',
    terrain: [],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 11, y: 6 },
      { type: BuildingType.GOLD_MINE, x: 13, y: 3 },
      { type: BuildingType.GOLD_MINE, x: 13, y: 10 },
    ],
    playerDeployZone: { xMin: 0, xMax: 4, yMin: 0, yMax: 14 },
  },

  // ── 第2章: 岩で通路が2本に。ルート選択という概念を導入 ──
  {
    id: 'map-canyon',
    name: 'クレーター峡谷',
    description: '岩壁が通路を2本に分けている。上と下、どちらから攻める？',
    terrain: [
      ...col(7, 'ROCK', 0, 4),
      ...col(7, 'ROCK', 10, 14),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 11, y: 6 },
      { type: BuildingType.CANNON, x: 9, y: 3 },
      { type: BuildingType.CANNON, x: 9, y: 11 },
      { type: BuildingType.GOLD_MINE, x: 13, y: 1 },
    ],
    playerDeployZone: { xMin: 0, xMax: 4, yMin: 0, yMax: 14 },
  },

  // ── 第3章: 中央の隕石帯を迂回。壁ごしの安全地帯を学ぶ ──
  {
    id: 'map-grassland',
    name: 'ネビュラ・フロント',
    description: '中央の隕石群を迂回して敵コアを破壊せよ！岩のかげは大砲から見えない。',
    terrain: [
      ...col(7, 'ROCK', 3, 11),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 11, y: 1 },
      { type: BuildingType.CANNON, x: 9, y: 4 },
      { type: BuildingType.CANNON, x: 10, y: 9 },
      { type: BuildingType.WALL, x: 10, y: 3 },
      { type: BuildingType.WALL, x: 11, y: 3 },
      { type: BuildingType.WALL, x: 13, y: 1 },
      { type: BuildingType.GOLD_MINE, x: 13, y: 6 },
    ],
    playerDeployZone: { xMin: 0, xMax: 5, yMin: 0, yMax: 14 },
  },

  // ── 第4章: 壁の要塞。壁をこわす／飛行でこえる、が主題 ──
  {
    id: 'map-fortress',
    name: 'アイアン・フォートレス',
    description: '分厚い装甲壁にかこまれた要塞。壁をこわすか、空からこえるか。',
    terrain: [
      ...col(4, 'ROCK', 0, 2),
      ...col(4, 'ROCK', 12, 14),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 11, y: 6 },
      { type: BuildingType.CANNON, x: 9, y: 4 },
      { type: BuildingType.CANNON, x: 9, y: 9 },
      { type: BuildingType.HIDDEN_TESLA, x: 10, y: 11 },
      { type: BuildingType.WALL, x: 10, y: 5 },
      { type: BuildingType.WALL, x: 10, y: 6 },
      { type: BuildingType.WALL, x: 10, y: 7 },
      { type: BuildingType.WALL, x: 10, y: 8 },
      { type: BuildingType.WALL, x: 11, y: 5 },
      { type: BuildingType.WALL, x: 12, y: 5 },
      { type: BuildingType.WALL, x: 11, y: 8 },
      { type: BuildingType.WALL, x: 12, y: 8 },
      { type: BuildingType.GOLD_MINE, x: 13, y: 2 },
    ],
    playerDeployZone: { xMin: 0, xMax: 3, yMin: 0, yMax: 14 },
  },

  // ── 第5章: 橋。部隊が1点に密集するリスクを学ぶ ──
  {
    id: 'map-river',
    name: 'オービタル・クロス',
    description: '2本の軌道ブリッジを渡って敵コアを攻略せよ！橋は兵士が密集しやすい！',
    terrain: [
      ...row(7, 'WATER'),
      cell(3, 7, 'BRIDGE'),
      cell(11, 7, 'BRIDGE'),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 7, y: 1 },
      { type: BuildingType.CANNON, x: 2, y: 5 },
      { type: BuildingType.CANNON, x: 11, y: 5 },
      { type: BuildingType.CANNON, x: 6, y: 4 },
      { type: BuildingType.WALL, x: 3, y: 6 },
      { type: BuildingType.WALL, x: 11, y: 6 },
      { type: BuildingType.WALL, x: 7, y: 3 },
      { type: BuildingType.WALL, x: 8, y: 3 },
      { type: BuildingType.WALL, x: 6, y: 2 },
      { type: BuildingType.HIDDEN_TESLA, x: 9, y: 3 },
    ],
    playerDeployZone: { xMin: 0, xMax: 14, yMin: 9, yMax: 14 },
  },

  // ── 第6章: 重力沼。移動コストという概念を導入 ──
  {
    id: 'map-swamp',
    name: 'グラビティ・マーシュ',
    description: '重力異常の沼が広がる。沼の上ではネコの足がおそくなる。避けて通ろう。',
    terrain: [
      ...rect(4, 4, 10, 8, 'SWAMP'),
      ...col(2, 'ROCK', 5, 8),
      ...col(12, 'ROCK', 5, 8),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 7, y: 1 },
      { type: BuildingType.CANNON, x: 4, y: 2 },
      { type: BuildingType.CANNON, x: 10, y: 2 },
      { type: BuildingType.CANNON, x: 7, y: 4 },
      { type: BuildingType.HIDDEN_TESLA, x: 2, y: 3 },
      { type: BuildingType.WALL, x: 6, y: 3 },
      { type: BuildingType.WALL, x: 7, y: 3 },
      { type: BuildingType.WALL, x: 8, y: 3 },
      { type: BuildingType.WALL, x: 6, y: 0 },
      { type: BuildingType.GOLD_MINE, x: 12, y: 1 },
    ],
    playerDeployZone: { xMin: 0, xMax: 14, yMin: 11, yMax: 14 },
  },

  // ── 第7章: 岩＋沼の複合。これまでの要素を組み合わせて判断する ──
  {
    id: 'map-cliffs',
    name: 'アステロイド・ゾーン',
    description: '小惑星群と重力場が進路を阻む。どのルートから突破する？',
    terrain: [
      ...col(5, 'ROCK', 2, 8),
      ...col(9, 'ROCK', 5, 11),
      ...rect(6, 3, 8, 5, 'SWAMP'),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 7, y: 0 },
      { type: BuildingType.CANNON, x: 3, y: 2 },
      { type: BuildingType.CANNON, x: 11, y: 3 },
      { type: BuildingType.CANNON, x: 11, y: 8 },
      { type: BuildingType.HIDDEN_TESLA, x: 6, y: 2 },
      { type: BuildingType.WALL, x: 6, y: 1 },
      { type: BuildingType.WALL, x: 7, y: 2 },
      { type: BuildingType.WALL, x: 9, y: 0 },
      { type: BuildingType.WALL, x: 9, y: 1 },
      { type: BuildingType.GOLD_MINE, x: 12, y: 0 },
    ],
    playerDeployZone: { xMin: 0, xMax: 14, yMin: 11, yMax: 14 },
  },

  // ── 第8章: 最終要塞。総合力（壁・迂回・沼・防衛密度）を問う ──
  {
    id: 'map-citadel',
    name: 'ギャラクティック・シタデル',
    description: '銀河皇帝の最終要塞。三重の防衛線をこえてコアにたどりつけ！',
    terrain: [
      ...col(4, 'ROCK', 0, 3),
      ...col(4, 'ROCK', 11, 14),
      ...col(10, 'ROCK', 0, 2),
      ...col(10, 'ROCK', 12, 14),
      ...rect(5, 8, 9, 9, 'SWAMP'),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 7, y: 1 },
      { type: BuildingType.CANNON, x: 5, y: 4 },
      { type: BuildingType.CANNON, x: 9, y: 4 },
      { type: BuildingType.CANNON, x: 2, y: 6 },
      { type: BuildingType.CANNON, x: 12, y: 6 },
      { type: BuildingType.HIDDEN_TESLA, x: 6, y: 6 },
      { type: BuildingType.HIDDEN_TESLA, x: 8, y: 6 },
      { type: BuildingType.WALL, x: 6, y: 3 },
      { type: BuildingType.WALL, x: 7, y: 3 },
      { type: BuildingType.WALL, x: 8, y: 3 },
      { type: BuildingType.WALL, x: 5, y: 3 },
      { type: BuildingType.WALL, x: 9, y: 3 },
      { type: BuildingType.WALL, x: 6, y: 0 },
      { type: BuildingType.WALL, x: 9, y: 0 },
      { type: BuildingType.GOLD_MINE, x: 12, y: 1 },
      { type: BuildingType.GOLD_MINE, x: 2, y: 1 },
    ],
    playerDeployZone: { xMin: 0, xMax: 14, yMin: 12, yMax: 14 },
  },
];

export const BATTLE_MAP_BY_ID: Record<string, BattleMap> =
  Object.fromEntries(BATTLE_MAPS.map(m => [m.id, m]));
