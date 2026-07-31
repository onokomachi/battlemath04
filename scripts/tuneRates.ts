/**
 * 章ごとの敵増援レートを、目標勝率に合うよう二分探索で求める補助スクリプト。
 * バランス調整を勘ではなく数字で決めるために使う（結果を campaign.ts へ反映する）。
 *
 *   npx tsx scripts/tuneRates.ts
 */
import { SimRunner, CommandProvider } from '../catwars/sim/runner';
import { buildSimConfig } from '../catwars/sim/setup';
import { SimCommand, TICK_MS, TICKS_PER_SEC } from '../catwars/sim/types';
import { CAMPAIGN } from '../catwars/data/campaign';
import { BATTLE_MAP_BY_ID } from '../catwars/data/battleMaps';
import { BuildingType } from '../catwars/types';
import { DetRNG } from '../catwars/sim/rng';

const QUIZ_INTERVAL_SEC = 14;
const QUIZ_REWARD = 34;
const TANK_RATIO = 0.25;

class Bot implements CommandProvider {
  private rng: DetRNG;
  private q: SimCommand[] = [];
  constructor(private runner: SimRunner, seed: number) { this.rng = new DetRNG(seed); }
  think(): void {
    const st = this.runner.state, cfg = this.runner.cfg, p = st.players.P1;
    const qT = Math.round(QUIZ_INTERVAL_SEC * TICKS_PER_SEC);
    if (st.tick > 0 && st.tick % qT === 0) {
      this.q.push({ type: 'GRANT_ENERGY', player: 'P1', amount: QUIZ_REWARD });
    }
    const zone = this.runner.statics.deployZones.P1;
    if (!zone) return;
    const roll = this.rng.next();
    const order = roll < 0.18 ? ['bomber', 'giant', 'barbarian']
                : roll < TANK_RATIO + 0.18 ? ['giant', 'barbarian', 'archer']
                : ['barbarian', 'archer', 'giant'];
    for (const id of order) {
      const line = cfg.unitStats.P1[id];
      if (!line) continue;
      const cost = Math.round(line.cost * cfg.costMult.P1);
      if (p.energy < cost) continue;
      const last = p.deployCd[id];
      const cd = Math.max(1, Math.round(line.cooldownMs / TICK_MS));
      if (last !== undefined && st.tick - last < cd) continue;
      this.q.push({
        type: 'DEPLOY', player: 'P1', troopId: id,
        x: Math.max(zone.xMin, zone.xMax - 1 - this.rng.int(2)),
        y: zone.yMin + this.rng.int(Math.max(1, zone.yMax - zone.yMin + 1)),
      });
      break;
    }
  }
  commandsForTick(): SimCommand[] { const c = this.q; this.q = []; return c; }
}

function winRate(chapterIndex: number, baseRate: number, runs: number): number {
  const ch = CAMPAIGN[chapterIndex];
  const map = BATTLE_MAP_BY_ID[ch.mapId];
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    const seed = 1000 + r * 7919;
    const cfg = buildSimConfig({
      mode: 'PVE', seed, chapter: ch,
      difficulty: { ...ch.difficulty, enemySpawnRatePerSec: baseRate },
      battleMap: map, p1: { stages: {}, buffs: { values: {} } },
    });
    const runner = new SimRunner(cfg, {
      defenderBuildings: map.enemyBase,
      playerBuildings: [{ type: BuildingType.TOWN_HALL, x: 0, y: 7 }],
      spellCharges: { P1: { HEAL: 2, RAGE: 2 }, P2: { HEAL: 0, RAGE: 0 } },
    });
    const bot = new Bot(runner, seed ^ 0x5bf03635);
    const maxTicks = 300 * TICKS_PER_SEC;
    for (let i = 0; i < maxTicks; i++) {
      bot.think();
      runner.advance(TICK_MS, bot);
      if (runner.state.result) break;
    }
    if (runner.state.result === 'P1') wins++;
  }
  return (wins / runs) * 100;
}

const TARGET: Record<number, number> = { 1: 85, 2: 85, 3: 72, 4: 72, 5: 72, 6: 70, 7: 58, 8: 55 };

console.log('\n章ごとの敵増援レート（基本値）を二分探索で決める\n');
console.log('章  目標勝率   決定した基本値   その時の勝率');
console.log('─'.repeat(52));
const found: number[] = [];
for (let i = 0; i < CAMPAIGN.length; i++) {
  const target = TARGET[CAMPAIGN[i].no];
  let lo = 0.5, hi = 40;   // レートが高いほど難しい＝勝率は単調に下がる
  let best = lo, bestRate = 0;
  for (let iter = 0; iter < 7; iter++) {
    const mid = (lo + hi) / 2;
    const wr = winRate(i, mid, 24);
    if (wr >= target) { best = mid; bestRate = wr; lo = mid; } else { hi = mid; }
  }
  found.push(Number(best.toFixed(1)));
  console.log(`${String(CAMPAIGN[i].no).padStart(2)}  ${String(target).padStart(6)}%   ${best.toFixed(1).padStart(12)}   ${bestRate.toFixed(0).padStart(9)}%`);
}
console.log('\ncampaign.ts に入れる値:', found.join(', '), '\n');
