import { BattleMap, TerrainTile, BuildingType } from '../types';

// helper functions
const row = (y: number, type: TerrainTile['type'], xMin = 0, xMax = 14): TerrainTile[] =>
  Array.from({ length: xMax - xMin + 1 }, (_, i) => ({ x: xMin + i, y, type }));

const col = (x: number, type: TerrainTile['type'], yMin = 0, yMax = 14): TerrainTile[] =>
  Array.from({ length: yMax - yMin + 1 }, (_, i) => ({ x, y: yMin + i, type }));

const cell = (x: number, y: number, type: TerrainTile['type']): TerrainTile => ({ x, y, type });

export const BATTLE_MAPS: BattleMap[] = [
  {
    id: 'map-grassland',
    name: 'ネビュラ・フロント',
    description: '中央の隕石群を迂回して敵コアを破壊せよ！',
    terrain: [
      ...col(7, 'ROCK', 3, 11),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 10, y: 1 },
      { type: BuildingType.CANNON, x: 8, y: 4 },
      { type: BuildingType.CANNON, x: 9, y: 8 },
      { type: BuildingType.WALL, x: 8, y: 2 },
      { type: BuildingType.WALL, x: 11, y: 1 },
      { type: BuildingType.WALL, x: 9, y: 2 },
      { type: BuildingType.GOLD_MINE, x: 12, y: 2 },
    ],
    playerDeployZone: { xMin: 0, xMax: 5, yMin: 0, yMax: 14 },
  },
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
      { type: BuildingType.CANNON, x: 7, y: 4 },
      { type: BuildingType.WALL, x: 3, y: 6 },
      { type: BuildingType.WALL, x: 11, y: 6 },
      { type: BuildingType.WALL, x: 7, y: 3 },
      { type: BuildingType.WALL, x: 6, y: 2 },
      { type: BuildingType.HIDDEN_TESLA, x: 7, y: 3 },
    ],
    playerDeployZone: { xMin: 0, xMax: 14, yMin: 9, yMax: 14 },
  },
  {
    id: 'map-cliffs',
    name: 'アステロイド・ゾーン',
    description: '小惑星群と重力場が進路を阻む。どのルートから突破する？',
    terrain: [
      ...col(5, 'ROCK', 2, 8),
      ...col(9, 'ROCK', 5, 11),
      cell(6, 3, 'SWAMP'), cell(7, 3, 'SWAMP'), cell(8, 3, 'SWAMP'),
      cell(6, 4, 'SWAMP'), cell(7, 4, 'SWAMP'), cell(8, 4, 'SWAMP'),
      cell(6, 5, 'SWAMP'), cell(7, 5, 'SWAMP'), cell(8, 5, 'SWAMP'),
    ],
    enemyBase: [
      { type: BuildingType.TOWN_HALL, x: 7, y: 0 },
      { type: BuildingType.CANNON, x: 4, y: 2 },
      { type: BuildingType.CANNON, x: 10, y: 3 },
      { type: BuildingType.HIDDEN_TESLA, x: 6, y: 1 },
      { type: BuildingType.WALL, x: 7, y: 1 },
      { type: BuildingType.WALL, x: 6, y: 0 },
      { type: BuildingType.WALL, x: 8, y: 0 },
      { type: BuildingType.WALL, x: 8, y: 1 },
      { type: BuildingType.WALL, x: 7, y: 2 },
    ],
    playerDeployZone: { xMin: 0, xMax: 14, yMin: 11, yMax: 14 },
  },
];
