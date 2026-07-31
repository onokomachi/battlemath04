/**
 * CAT-WARS バランス計測
 *
 *   npm run test:balance          … 章ごとの想定装備で到達したプレイヤー（既定）
 *   BARE=1 npm run test:balance   … 何も育てていない最悪ケース
 *   RUNS=10 MAXSEC=240 npm run test:balance
 *
 * 決定論シミュレーションの上で小4を模したAIプレイヤーを走らせ、
 * 章ごとの勝率・所要時間・敵の出現数を実測する。
 * これがあると、バランス調整を勘ではなく数字で回せる。
 *
 * 目標値（catwars/data/campaign.ts 冒頭の設計仕様）:
 *   章1〜2: 勝率 約85% / 章3〜6: 約70% / 章7〜8: 約55%
 *
 * ボットはミスをしないので実在の子より上手い。3段階の上手さで挟んで測り、
 * **「にがて」が目標に届いているか**を合格条件にする（＝実在の子が
 * 目標どおり勝てる、を安全側で見積もる）。
 * ボットと「章ごとの想定装備」の定義は scripts/botSim.ts にある。
 */
import { CAMPAIGN } from '../catwars/data/campaign';
import { playOnce, seedFor, BARE_LOADOUT, SKILL_LEVELS, PlayResult } from './botSim';

const RUNS = Number(process.env.RUNS ?? 40);
const MAX_SECONDS = Number(process.env.MAXSEC ?? 300);
const USE_BARE = process.env.BARE === '1';

const TARGET: Record<number, number> = { 1: 85, 2: 85, 3: 70, 4: 70, 5: 70, 6: 70, 7: 55, 8: 55 };

console.log(
  '\nCAT-WARS バランス計測（' +
  (USE_BARE ? '進化なし・バフなし・拠点なしの素の条件' : '章ごとの想定装備で到達したプレイヤー') +
  ', 各章 各上手さ ' + RUNS + '回）\n'
);
console.log('章  目標   じょうず  ふつう  にがて   判定   平均決着   敵の出現数   敵の出現間隔  同時最大');
console.log('─'.repeat(96));

// CH=5 のように章を絞れる（1章だけ詰めたいときに使う）
const ONLY = (process.env.CH ?? '').split(',').map(s => Number(s.trim())).filter(n => n > 0);

for (let i = 0; i < CAMPAIGN.length; i++) {
  const ch = CAMPAIGN[i];
  if (ONLY.length > 0 && !ONLY.includes(ch.no)) continue;
  const rates: number[] = [];
  let weakStats: PlayResult[] = [];

  for (const skill of SKILL_LEVELS) {
    const results: PlayResult[] = [];
    for (let r = 0; r < RUNS; r++) {
      results.push(playOnce(i, seedFor(r), {
        skill,
        loadout: USE_BARE ? BARE_LOADOUT : undefined,
        maxSeconds: MAX_SECONDS,
      }));
    }
    rates.push((results.filter(r => r.win).length / RUNS) * 100);
    weakStats = results;   // 最後に回るのが「にがて」
  }

  const avgSec = weakStats.reduce((a, b) => a + b.seconds, 0) / RUNS;
  const avgSpawn = weakStats.reduce((a, b) => a + b.enemySpawned, 0) / RUNS;
  const interval = avgSpawn > 0 ? avgSec / avgSpawn : 0;

  const target = TARGET[ch.no];
  const weak = rates[2];
  const diff = weak - target;
  const mark = Math.abs(diff) <= 15 ? '✅' : diff > 0 ? '⬆️易' : '⬇️難';

  const peak = Math.max(...weakStats.map(r => r.peakEntities));

  console.log(
    `${String(ch.no).padStart(2)}  ${String(target).padStart(3)}%  ` +
    rates.map(r => `${r.toFixed(0).padStart(6)}%`).join(' ') +
    `  ${mark}  ${avgSec.toFixed(0).padStart(6)}秒  ${avgSpawn.toFixed(1).padStart(8)}体  ${interval.toFixed(1).padStart(8)}秒/体  ${String(peak).padStart(5)}体`
  );
}
console.log('\n（判定は「にがて」の勝率が目標±15ポイント以内なら ✅。決着時間などは「にがて」の値）\n');
