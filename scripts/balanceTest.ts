/**
 * CAT-WARS バランス計測
 *
 *   npm run test:balance
 *
 * 決定論シミュレーションの上で「ふつうの小4」を模したAIプレイヤーを走らせ、
 * 章ごとの勝率・所要時間・敵の出現数を実測する。
 *
 * これがあると、バランス調整を勘ではなく数字で回せる。
 * 目標値（catwars/data/campaign.ts 冒頭の設計仕様）:
 *   章1〜2: 勝率 約85% / 章3〜6: 約70% / 章7〜8: 約55%
 */
import { SimRunner, CommandProvider } from '../catwars/sim/runner';
import { buildSimConfig } from '../catwars/sim/setup';
import { SimCommand, TICK_MS, TICKS_PER_SEC } from '../catwars/sim/types';
import { CAMPAIGN } from '../catwars/data/campaign';
import { BATTLE_MAP_BY_ID } from '../catwars/data/battleMaps';
import { BuildingType } from '../catwars/types';
import { DetRNG } from '../catwars/sim/rng';

/** プレイヤーの上手さ。クイズを解く頻度と、編成の適切さで表現する */
interface Skill {
  label: string;
  /** クイズ1問にかかる秒数（これごとに⚡が入る）。速いほど上手 */
  quizIntervalSec: number;
  /** 1問あたりの獲得⚡（problemWeights の実測レンジ 23〜68 の中央値付近） */
  quizReward: number;
  /** タンクを混ぜる確率（役割理解の指標） */
  tankRatio: number;
}

const SKILLS: Skill[] = [
  { label: 'ふつう', quizIntervalSec: 14, quizReward: 34, tankRatio: 0.25 },
];

/**
 * AIプレイヤー。
 * ・出せるものがあれば自陣ゾーンの前線寄りに出す（安いものを主軸に、たまにタンク）
 * ・quizIntervalSec ごとにクイズを1問解いた扱いで⚡を得る
 * ・敵がコアに近づいたら防衛のため近接を優先
 */
class BotPlayer implements CommandProvider {
  private rng: DetRNG;
  private queued: SimCommand[] = [];
  constructor(private runner: SimRunner, private skill: Skill, seed: number) {
    this.rng = new DetRNG(seed);
  }

  think(): void {
    const st = this.runner.state;
    const cfg = this.runner.cfg;
    const p = st.players.P1;

    // クイズ（一定間隔で⚡を得る）
    const qTicks = Math.round(this.skill.quizIntervalSec * TICKS_PER_SEC);
    if (st.tick > 0 && st.tick % qTicks === 0) {
      this.queued.push({ type: 'GRANT_ENERGY', player: 'P1', amount: this.skill.quizReward });
    }

    // 出撃（クールダウンが明けていて、買えるものから選ぶ）
    const zone = this.runner.statics.deployZones.P1;
    if (!zone) return;
    // 役割を理解したプレイヤーを模す: 攻城(ぼむにゃー)・盾(にゃいあんと)を混ぜる
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
      // 自陣ゾーンの前線寄りに出す
      const x = Math.max(zone.xMin, zone.xMax - 1 - this.rng.int(2));
      const y = zone.yMin + this.rng.int(Math.max(1, zone.yMax - zone.yMin + 1));
      this.queued.push({ type: 'DEPLOY', player: 'P1', troopId: id, x, y });
      break;
    }
  }

  commandsForTick(): SimCommand[] {
    const c = this.queued;
    this.queued = [];
    return c;
  }
}

interface Result {
  win: boolean;
  seconds: number;
  enemySpawned: number;
}

function playOnce(chapterIndex: number, seed: number, skill: Skill, maxSeconds = 300): Result {
  const ch = CAMPAIGN[chapterIndex];
  const map = BATTLE_MAP_BY_ID[ch.mapId];
  const cfg = buildSimConfig({
    mode: 'PVE', seed, chapter: ch, difficulty: ch.difficulty, battleMap: map,
    p1: { stages: {}, buffs: { values: {} } },   // 進化なし・バフなしの素の状態
  });
  const runner = new SimRunner(cfg, {
    defenderBuildings: map.enemyBase,
    // 拠点づくりをしていない素の状態（コアのみ）＝いちばん厳しい条件
    playerBuildings: [{ type: BuildingType.TOWN_HALL, x: 0, y: 7 }],
    spellCharges: { P1: { HEAL: 2, RAGE: 2 }, P2: { HEAL: 0, RAGE: 0 } },
  });
  const bot = new BotPlayer(runner, skill, seed ^ 0x5bf03635);

  const maxTicks = maxSeconds * TICKS_PER_SEC;
  for (let i = 0; i < maxTicks; i++) {
    bot.think();
    runner.advance(TICK_MS, bot);
    if (runner.state.result) break;
  }
  return {
    win: runner.state.result === 'P1',
    seconds: runner.tick / TICKS_PER_SEC,
    enemySpawned: runner.state.ai.spawnCount,
  };
}

// ── 実行 ──────────────────────────────────────────────────────────────

const RUNS = 40;
const TARGET: Record<number, number> = { 1: 85, 2: 85, 3: 70, 4: 70, 5: 70, 6: 70, 7: 55, 8: 55 };

console.log('\nCAT-WARS バランス計測（進化なし・バフなし・拠点なしの素の条件, 各章 ' + RUNS + '回）\n');
console.log('章  勝率    目標   判定   平均決着   敵の出現数   敵の出現間隔');
console.log('─'.repeat(70));

for (const skill of SKILLS) {
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const ch = CAMPAIGN[i];
    const results: Result[] = [];
    for (let r = 0; r < RUNS; r++) results.push(playOnce(i, 1000 + r * 7919, skill));

    const wins = results.filter(r => r.win).length;
    const rate = (wins / RUNS) * 100;
    const avgSec = results.reduce((a, b) => a + b.seconds, 0) / RUNS;
    const avgSpawn = results.reduce((a, b) => a + b.enemySpawned, 0) / RUNS;
    const interval = avgSpawn > 0 ? avgSec / avgSpawn : 0;

    const target = TARGET[ch.no];
    const diff = rate - target;
    const mark = Math.abs(diff) <= 15 ? '✅' : diff > 0 ? '⬆️易' : '⬇️難';

    console.log(
      `${String(ch.no).padStart(2)}  ${rate.toFixed(0).padStart(3)}%  ${String(target).padStart(4)}%  ${mark}  ` +
      `${avgSec.toFixed(0).padStart(6)}秒  ${avgSpawn.toFixed(1).padStart(8)}体  ${interval.toFixed(1).padStart(8)}秒/体`
    );
  }
}
console.log('\n（判定は目標±15ポイント以内なら ✅）\n');
