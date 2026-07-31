/**
 * バランス計測・レート探索で共通に使う「AIプレイヤー」と「章ごとの想定装備」。
 *
 * balanceTest.ts（計測）と tuneRates.ts（探索）が別々にボットを持っていると、
 * 探索した値を反映しても計測結果が合わない、という事故が起きる。
 * ここに1つだけ置いて両方から使う。
 */
import { SimRunner, CommandProvider } from '../catwars/sim/runner';
import { buildSimConfig, ResolvedBuffs } from '../catwars/sim/setup';
import { SimCommand, TICK_MS, TICKS_PER_SEC } from '../catwars/sim/types';
import { CAMPAIGN, ChapterDifficulty } from '../catwars/data/campaign';
import { BATTLE_MAP_BY_ID } from '../catwars/data/battleMaps';
import { BuildingType } from '../catwars/types';
import { DetRNG } from '../catwars/sim/rng';

/** プレイヤーの上手さ。クイズを解く頻度と、編成の適切さで表現する */
export interface Skill {
  label: string;
  /** クイズ1問にかかる秒数（これごとに⚡が入る）。速いほど上手 */
  quizIntervalSec: number;
  /** 1問あたりの獲得⚡（problemWeights の実測レンジ 23〜68 の中央値付近） */
  quizReward: number;
  /** タンクを混ぜる確率（役割理解の指標） */
  tankRatio: number;
}

/**
 * ボットは「ミスをしない・必ず一定間隔でクイズを解く」ので、実在の小4より上手い。
 * ボット1本で測ると難易度を甘く見積もるので、3段階で挟んで評価する。
 *   ・じょうず … すらすら解ける子（勝率の上限の目安）
 *   ・ふつう  … 想定の中心
 *   ・にがて  … 計算に時間がかかり、役割もあまり意識しない子（下限の目安）
 * 設計仕様の目標勝率（章1〜2で85%など）は実在の子ども向けの数字なので、
 * 「にがて」がおおよそ目標に届いているかを合格条件にする。
 */
export const SKILL_LEVELS: Skill[] = [
  { label: 'じょうず', quizIntervalSec: 10, quizReward: 40, tankRatio: 0.35 },
  { label: 'ふつう',   quizIntervalSec: 14, quizReward: 34, tankRatio: 0.25 },
  { label: 'にがて',   quizIntervalSec: 24, quizReward: 26, tankRatio: 0.10 },
];

export const NORMAL_SKILL: Skill = SKILL_LEVELS[1];
export const WEAK_SKILL: Skill = SKILL_LEVELS[2];

// ── 章ごとの「そこに着いた子が普通に持っているもの」 ────────────────────
//
// キャンペーンは第1章から順に進むので、第8章に来た子は必ず第7章までを
// クリアしている＝進化もバフも拠点も持っている。全章を「素の状態」で
// 測ると、終盤の難易度を実際より厳しく見積もってしまう。
//
// ・進化: クリア報酬💠がたまるにつれ、よく使う系統から stage2 にしていく
// ・拠点: 第3章あたりで砲台を1つ建てられるようになり、少しずつ増える
// ・バフ: デイリー配布なので日によってブレる。ここでは控えめに見積もる
//   （Lomas et al. 2013 の「教育ゲームは易しめが最適」に合わせ、
//     見積もりを甘くして難易度を上げすぎないようにする）

export type Stages = Record<string, 1 | 2 | 3>;

export interface Loadout {
  stages: Stages;
  buffs: ResolvedBuffs;
  buildings: { type: BuildingType; x: number; y: number }[];
}

const CORE_ONLY = [{ type: BuildingType.TOWN_HALL, x: 0, y: 7 }];
const BASE_SMALL = [
  ...CORE_ONLY,
  { type: BuildingType.CANNON, x: 2, y: 5 },
];
const BASE_MID = [
  ...CORE_ONLY,
  { type: BuildingType.CANNON, x: 2, y: 5 },
  { type: BuildingType.CANNON, x: 2, y: 9 },
  { type: BuildingType.WALL, x: 3, y: 6 },
  { type: BuildingType.WALL, x: 3, y: 8 },
];

const s2 = (...ids: string[]): Stages =>
  Object.fromEntries(ids.map(id => [id, 2 as const]));

/** 章番号(1起算) → その章に着いた時点の想定装備 */
export const LOADOUT_BY_CHAPTER: Record<number, Loadout> = {
  1: { stages: {}, buffs: { values: {} }, buildings: CORE_ONLY },
  2: { stages: {}, buffs: { values: {} }, buildings: CORE_ONLY },
  3: { stages: s2('barbarian'), buffs: { values: {} }, buildings: BASE_SMALL },
  4: { stages: s2('barbarian', 'archer'), buffs: { values: {} }, buildings: BASE_SMALL },
  5: { stages: s2('barbarian', 'archer', 'giant'), buffs: { values: {} }, buildings: BASE_MID },
  6: {
    stages: s2('barbarian', 'archer', 'giant', 'bomber'),
    buffs: { values: { POWER_BOOST: 10 } },
    buildings: BASE_MID,
  },
  7: {
    stages: s2('barbarian', 'archer', 'giant', 'bomber', 'speed'),
    buffs: { values: { POWER_BOOST: 15 } },
    buildings: BASE_MID,
  },
  8: {
    stages: s2('barbarian', 'archer', 'giant', 'bomber', 'speed', 'boss_artillery'),
    buffs: { values: { POWER_BOOST: 15, GENIUS_COMMANDER: 10 } },
    buildings: BASE_MID,
  },
};

/** 何も育てていない最悪ケース（ここでも詰まないかの下限チェック用） */
export const BARE_LOADOUT: Loadout = {
  stages: {}, buffs: { values: {} }, buildings: CORE_ONLY,
};

/**
 * AIプレイヤー。
 * ・出せるものがあれば自陣ゾーンの前線寄りに出す（安いものを主軸に、たまにタンク）
 * ・quizIntervalSec ごとにクイズを1問解いた扱いで⚡を得る
 * ・役割を理解したプレイヤーを模し、攻城(ぼむにゃー)・盾(にゃいあんと)を混ぜる
 */
export class BotPlayer implements CommandProvider {
  private rng: DetRNG;
  private queued: SimCommand[] = [];

  constructor(private runner: SimRunner, private skill: Skill, seed: number) {
    this.rng = new DetRNG(seed);
  }

  think(): void {
    const st = this.runner.state;
    const cfg = this.runner.cfg;
    const p = st.players.P1;

    const qTicks = Math.round(this.skill.quizIntervalSec * TICKS_PER_SEC);
    if (st.tick > 0 && st.tick % qTicks === 0) {
      this.queued.push({ type: 'GRANT_ENERGY', player: 'P1', amount: this.skill.quizReward });
    }

    const zone = this.runner.statics.deployZones.P1;
    if (!zone) return;
    const roll = this.rng.next();
    const order = roll < 0.18 ? ['bomber', 'giant', 'barbarian']
                : roll < this.skill.tankRatio + 0.18 ? ['giant', 'barbarian', 'archer']
                : ['barbarian', 'archer', 'giant'];

    for (const id of order) {
      const line = cfg.unitStats.P1[id];
      if (!line) continue;
      const cost = Math.round(line.cost * cfg.costMult.P1);
      if (p.energy < cost) continue;
      const last = p.deployCd[id];
      const cdTicks = Math.max(1, Math.round(line.cooldownMs / TICK_MS));
      if (last !== undefined && st.tick - last < cdTicks) continue;
      this.queued.push({
        type: 'DEPLOY', player: 'P1', troopId: id,
        x: Math.max(zone.xMin, zone.xMax - 1 - this.rng.int(2)),
        y: zone.yMin + this.rng.int(Math.max(1, zone.yMax - zone.yMin + 1)),
      });
      break;
    }
  }

  commandsForTick(): SimCommand[] {
    const c = this.queued;
    this.queued = [];
    return c;
  }
}

export interface PlayResult {
  win: boolean;
  seconds: number;
  enemySpawned: number;
  /** 同時に盤上へ出た最大エンティティ数（描画負荷の上限を見るため） */
  peakEntities: number;
}

export interface PlayOptions {
  /** 章の難易度を差し替える（レート探索で使う） */
  difficulty?: ChapterDifficulty;
  loadout?: Loadout;
  maxSeconds?: number;
  skill?: Skill;
}

/** 1試合ぶんシミュレーションして結果を返す（同じ seed なら必ず同じ結果） */
export function playOnce(chapterIndex: number, seed: number, opts: PlayOptions = {}): PlayResult {
  const ch = CAMPAIGN[chapterIndex];
  const map = BATTLE_MAP_BY_ID[ch.mapId];
  const kit = opts.loadout ?? LOADOUT_BY_CHAPTER[ch.no] ?? BARE_LOADOUT;
  const skill = opts.skill ?? NORMAL_SKILL;

  const cfg = buildSimConfig({
    mode: 'PVE', seed, chapter: ch,
    difficulty: opts.difficulty ?? ch.difficulty,
    battleMap: map,
    p1: { stages: kit.stages, buffs: kit.buffs },
  });
  const runner = new SimRunner(cfg, {
    defenderBuildings: map.enemyBase,
    playerBuildings: kit.buildings,
    spellCharges: { P1: { HEAL: 2, RAGE: 2 }, P2: { HEAL: 0, RAGE: 0 } },
  });
  const bot = new BotPlayer(runner, skill, seed ^ 0x5bf03635);

  const maxTicks = (opts.maxSeconds ?? 300) * TICKS_PER_SEC;
  let peak = 0;
  for (let i = 0; i < maxTicks; i++) {
    bot.think();
    runner.advance(TICK_MS, bot);
    if (i % 20 === 0 && runner.state.entities.length > peak) peak = runner.state.entities.length;
    if (runner.state.result) break;
  }
  return {
    win: runner.state.result === 'P1',
    seconds: runner.tick / TICKS_PER_SEC,
    enemySpawned: runner.state.ai.spawnCount,
    peakEntities: peak,
  };
}

/** 計測のたねを固定しておく（毎回同じ試合列を回すので、差分が読める） */
export const seedFor = (run: number): number => 1000 + run * 7919;
