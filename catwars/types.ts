export enum BuildingType {
  TOWN_HALL = 'TOWN_HALL',
  GOLD_MINE = 'GOLD_MINE',
  BARRACKS = 'BARRACKS',
  ARMY_CAMP = 'ARMY_CAMP',
  WALL = 'WALL',
  CANNON = 'CANNON',
  HIDDEN_TESLA = 'HIDDEN_TESLA'
}

export enum ResourceType {
  GOLD = 'GOLD'
}

export enum BuildingStatus {
  CONSTRUCTING = 'CONSTRUCTING',
  ACTIVE = 'ACTIVE'
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  position: Coordinates;
  hp: number;
  maxHp: number;
  status: BuildingStatus;
  constructionEndTime?: number; // Timestamp when construction finishes
  lastCollected?: number; // Timestamp
}

export interface Troop {
  id: string;
  name: string;
  count: number;
  damage: number;
  hp: number;
  target: 'ANY' | 'DEFENSE' | 'RESOURCE';
  moveSpeed: number; // Tiles per second
}

export interface GameState {
  resources: {
    gold: number;
    maxGold: number;
  };
  buildings: Building[];
  troops: Troop[];
  lastTick: number;
}

export interface BattleEntity {
  id: string;
  type: 'TROOP' | 'BUILDING';
  subType: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  team: 'ATTACKER' | 'DEFENDER' | 'ATTACKER_BUILDING';
  targetId?: string | null;
  attackRange: number;
  attackSpeed: number; // ms per attack
  lastAttack: number;
  moveSpeed: number;
  path?: Coordinates[]; // Current path to target
  targetPreference: 'ANY' | 'DEFENSE' | 'RESOURCE' | 'RUSH' | 'HOLD' | 'MOVE_TO';
  customTarget?: { x: number; y: number };
  isHidden?: boolean; // For traps
}

export type TerrainType = 'GRASS' | 'WATER' | 'BRIDGE' | 'ROCK' | 'SWAMP';

// ── Daily Buff System（T1〜T4 グラデーション）─────────────────────────────────
export type BuffTier = 1 | 2 | 3 | 4;

export type BuffType =
  // T1 一般（常時開放）
  | 'FAST_DEPLOY'      // 出撃インターバル撤廃
  | 'COST_REDUCTION'   // 戦闘中兵士コスト30%オフ
  | 'GOLD_RUSH'        // 開始時ゴールド+150
  | 'GOLD_BOOST'       // 戦闘中のゴールド湧き+50%
  // T2 上級（本日10問以上）
  | 'RARE_BARBARIAN'   // 近接系：HP+50%・攻撃力+40%
  | 'RARE_ARCHER'      // 遠距離系：射程+・速度+30%
  | 'POWER_BOOST'      // 全兵士攻撃力+40%
  | 'EXTRA_TROOPS'     // 近接系×6 追加支給
  | 'SWIFT_ARMY'       // 全兵士の移動速度+40%
  // T3 精鋭（本日25問 or 連続5日）
  | 'HEAL_AURA'        // 全兵士が定期的にHP回復
  | 'GIANT_FORTRESS'   // タンク系のHP×2
  | 'DOUBLE_LOOT'      // 勝利時の戦利品2倍
  | 'WIZARD_SUPPORT'   // 魔法系×2 追加支給
  // T4 伝説（本日40問 かつ 連続3日）
  | 'DRAGON_SUMMON'    // 飛行系×1 追加支給（強力）
  | 'ARMAGEDDON'       // 全兵士攻撃力+70%
  | 'GENIUS_COMMANDER'; // 全兵士のHP・攻撃力+20%

export interface ActiveDailyBuff {
  type: BuffType;
  activatedAt: number;
  expiresAt: number; // end of today (midnight)
  level?: 1 | 2 | 3;  // NEW: 1=小, 2=中, 3=大. undefined/missing = 2 for legacy
}

export interface TerrainTile {
  x: number;
  y: number;
  type: TerrainType;
}

export interface BattleMap {
  id: string;
  name: string;
  description: string;
  terrain: TerrainTile[];
  enemyBase: { type: BuildingType; x: number; y: number }[];
  playerDeployZone: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface DeployedBuilding {
  type: BuildingType;
  x: number;
  y: number;
}

export interface BattleLoadout {
  unlockedTroopTypes: string[];
  maxBuildingSlots: number;
  canBringCannon: boolean;
  canBringTesla: boolean;
  maxWallSlots: number;
  healCharges: number;
  rageCharges: number;
  availableBuildingTypes: BuildingType[];
}

export const GRID_SIZE = 15;