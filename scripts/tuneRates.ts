/**
 * 章ごとの敵増援レート（enemySpawnRatePerSec）を、目標勝率に合うよう
 * 二分探索で求める補助スクリプト。バランス調整を勘ではなく数字で決めるために使う
 * （結果を catwars/data/campaign.ts へ反映する）。
 *
 *   npx tsx scripts/tuneRates.ts
 *   RUNS=16 npx tsx scripts/tuneRates.ts
 *
 * 計測条件（ボット・章ごとの想定装備）は scripts/botSim.ts と共有している。
 */
import { CAMPAIGN } from '../catwars/data/campaign';
import { playOnce, seedFor, BARE_LOADOUT, SKILL_LEVELS, WEAK_SKILL } from './botSim';

const RUNS = Number(process.env.RUNS ?? 24);
const MAX_SECONDS = Number(process.env.MAXSEC ?? 300);
const USE_BARE = process.env.BARE === '1';
const ITERS = Number(process.env.ITERS ?? 7);
// 合格条件を「にがてな子が目標勝率に届くこと」に置いているので、探索も同じ条件で行う
const SKILL = SKILL_LEVELS.find(s => s.label === process.env.SKILL) ?? WEAK_SKILL;

function winRate(chapterIndex: number, baseRate: number): number {
  const ch = CAMPAIGN[chapterIndex];
  let wins = 0;
  for (let r = 0; r < RUNS; r++) {
    const res = playOnce(chapterIndex, seedFor(r), {
      skill: SKILL,
      difficulty: { ...ch.difficulty, enemySpawnRatePerSec: baseRate },
      loadout: USE_BARE ? BARE_LOADOUT : undefined,
      maxSeconds: MAX_SECONDS,
    });
    if (res.win) wins++;
  }
  return (wins / RUNS) * 100;
}

const TARGET: Record<number, number> = { 1: 85, 2: 85, 3: 72, 4: 72, 5: 72, 6: 70, 7: 58, 8: 55 };

console.log('\n章ごとの敵増援レート（基本値）を二分探索で決める');
console.log(`（${USE_BARE ? '素の条件' : '章ごとの想定装備'} / 上手さ「${SKILL.label}」/ 各点 ${RUNS}試合）\n`);
console.log('章  目標勝率   決定した基本値   その時の勝率');
console.log('─'.repeat(52));

// CH=3,4,5 のように章を絞れる（1章ずつ詰めたいときに使う）
const ONLY = (process.env.CH ?? '').split(',').map(s => Number(s.trim())).filter(n => n > 0);
const LO = Number(process.env.LO ?? 3);
const HI = Number(process.env.HI ?? 45);

const found: number[] = [];
for (let i = 0; i < CAMPAIGN.length; i++) {
  if (ONLY.length > 0 && !ONLY.includes(CAMPAIGN[i].no)) continue;
  const target = TARGET[CAMPAIGN[i].no];
  // レートが高いほど敵が増える＝勝率は単調に下がる、という前提で二分探索する
  let lo = LO, hi = HI;
  let best = lo, bestRate = 0;
  for (let iter = 0; iter < ITERS; iter++) {
    const mid = (lo + hi) / 2;
    const wr = winRate(i, mid);
    if (wr >= target) { best = mid; bestRate = wr; lo = mid; } else { hi = mid; }
  }
  found.push(Number(best.toFixed(1)));
  console.log(
    `${String(CAMPAIGN[i].no).padStart(2)}  ${String(target).padStart(6)}%   ` +
    `${best.toFixed(1).padStart(12)}   ${bestRate.toFixed(0).padStart(9)}%`
  );
}
console.log('\ncampaign.ts に入れる値:', found.join(', '), '\n');
