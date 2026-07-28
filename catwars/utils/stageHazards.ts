// ── ステージギミック ─────────────────────────────────────────────────────
//
// 単なる長方形の盤面を「読み解く盤面」に変えるための仕掛け。
// どれも **敵・味方・中立のすべてに等しく作用する** ルールにしてある。
// 一方だけが損をする仕掛けは理不尽に感じられ、学習意欲を削ぐため。
//
//   溶岩(LAVA)     … 乗っているあいだ継続ダメージ。通行は可能だが経路コストも高い
//   流星(meteor)   … 予告円 → 着弾。予告時間は 1.6〜1.8 秒あり、見てから動かせる
//   中立エイリアン … 巣から湧き、陣営に関係なく最も近い相手を襲う第3勢力
//   巨大生物(titan)… 決まった経路を往復し、進路に入ったキャラを攻撃する
//
// 予告つきにしているのは、理不尽な即死を避けるため（子どもの反応時間の制約は
// catwars/data/campaign.ts の E3 を参照）。

import { BattleEntity, MeteorZone, TerrainTile, AlienNest, TitanBeast } from '../types';

/** 溶岩の毎秒ダメージ */
export const LAVA_DPS = 14;

/** 溶岩マスの集合を作る */
export function collectLavaCells(terrain: TerrainTile[]): Set<string> {
  const s = new Set<string>();
  for (const t of terrain) if (t.type === 'LAVA') s.add(`${Math.round(t.x)},${Math.round(t.y)}`);
  return s;
}

/** そのキャラが溶岩の上にいるか */
export function isOnLava(e: BattleEntity, lava: Set<string>): boolean {
  if (lava.size === 0) return false;
  return lava.has(`${Math.round(e.x)},${Math.round(e.y)}`);
}

/** 画面に出ている流星の予告／着弾の状態 */
export interface MeteorState {
  id: string;
  zone: MeteorZone;
  /** 予告が出た時刻 */
  warnedAt: number;
  /** 着弾予定時刻 */
  impactAt: number;
  /** 着弾処理ずみか */
  resolved: boolean;
}

/** 中立エイリアンの基礎ステータス（章の難易度倍率はかけない＝常に一定の脅威） */
export const ALIEN_STATS = {
  hp: 90,
  damage: 16,
  attackRange: 1.3,
  attackSpeed: 1100,
  moveSpeed: 2.6,
  /** 描画に使うスプライト系統（既存の魔法系スプライトを色変えして流用） */
  subType: 'alien',
  bodySize: 34,
};

/** 巨大生物のエンティティを作る */
export function makeTitanEntity(t: TitanBeast, id: string): BattleEntity {
  const start = t.path[0];
  return {
    id,
    type: 'TROOP',
    subType: 'titan',
    x: start.x,
    y: start.y,
    hp: t.hp,
    maxHp: t.hp,
    damage: t.damage,
    team: 'NEUTRAL',
    attackRange: t.attackRange,
    attackSpeed: t.attackSpeed,
    lastAttack: 0,
    moveSpeed: t.moveSpeed,
    // HOLD にして通常のAIには移動させない（動きは stepTitan が決まった経路で管理する）。
    // 動きが読めることが「いつ通るか」を判断できる前提になる。
    targetPreference: 'HOLD',
    path: [],
  };
}

/** 中立エイリアンのエンティティを作る */
export function makeAlienEntity(nest: AlienNest, id: string): BattleEntity {
  return {
    id,
    type: 'TROOP',
    subType: ALIEN_STATS.subType,
    x: nest.x,
    y: nest.y,
    hp: ALIEN_STATS.hp,
    maxHp: ALIEN_STATS.hp,
    damage: ALIEN_STATS.damage,
    team: 'NEUTRAL',
    attackRange: ALIEN_STATS.attackRange,
    attackSpeed: ALIEN_STATS.attackSpeed,
    lastAttack: 0,
    moveSpeed: ALIEN_STATS.moveSpeed,
    targetPreference: 'ANY',
    path: [],
  };
}

/**
 * 巨大生物を経路上で往復させる。
 * A* は使わず、経路の2点間を直線で行き来する（決まった動きのほうが
 * 「いつ通るか」を読みやすく、避ける判断が成立する）。
 */
export function stepTitan(
  e: BattleEntity,
  t: TitanBeast,
  dir: 1 | -1,
  dtSec: number,
): 1 | -1 {
  const from = dir === 1 ? t.path[0] : t.path[t.path.length - 1];
  const to = dir === 1 ? t.path[t.path.length - 1] : t.path[0];
  const dx = to.x - e.x;
  const dy = to.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.4) return (dir === 1 ? -1 : 1);
  const step = t.moveSpeed * dtSec;
  e.x += (dx / dist) * step;
  e.y += (dy / dist) * step;
  void from;
  return dir;
}
