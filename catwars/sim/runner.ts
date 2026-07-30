// ── 固定タイムステップのランナー ─────────────────────────────────────────
//
// これまでの実装は requestAnimationFrame ごとに 1回シミュレーションを進め、
// 移動量を「1フレームあたり moveSpeed * 0.013」としていた。
// つまり **120Hz の端末では 60Hz の端末のちょうど2倍の速さでゲームが進む**。
// PvP以前に、単体プレイでも端末による有利不利が出ている実バグだった。
//
// ここではアキュムレータ方式で、実時間の進み方に関係なく
// 「1tick = 50ms ぶん」だけ進める。描画は 60fps のまま、tick間を alpha で
// 補間して滑らかに見せる（Fix Your Timestep! の定番構成）。

import { SimState, SimConfig, SimCommand, SimEvent, TICK_MS } from './types';
import { createSimState, simulateTick, buildStatics, SimStatics, SimInit } from './simulate';

/**
 * その tick のコマンドを供給する。
 * **null を返すと「まだ揃っていない」** の意味で、シミュレーションは停止して待つ。
 * ソロプレイでは常に配列を返す実装、ロックステップでは両者のコマンドが
 * 揃うまで null を返す実装を渡す。
 */
export interface CommandProvider {
  commandsForTick(tick: number): SimCommand[] | null;
}

/** ソロプレイ用。ローカルの入力をそのまま次tickに積む。 */
export class LocalCommandProvider implements CommandProvider {
  private queued: SimCommand[] = [];
  push(cmd: SimCommand): void { this.queued.push(cmd); }
  commandsForTick(_tick: number): SimCommand[] {
    const c = this.queued;
    this.queued = [];
    return c;
  }
}

export interface AdvanceResult {
  events: SimEvent[];
  /** 進めた tick 数 */
  ticks: number;
  /** コマンド待ちで停止したか（UIに「あいてを まっています」を出す） */
  stalled: boolean;
}

export class SimRunner {
  readonly cfg: SimConfig;
  readonly statics: SimStatics;
  state: SimState;
  private accumulator = 0;

  /** 1フレームで処理する tick 数の上限。タブ復帰時の暴走を防ぐ */
  private static readonly MAX_CATCHUP_TICKS = 5;

  constructor(cfg: SimConfig, init: SimInit) {
    this.cfg = cfg;
    this.statics = buildStatics(cfg);
    this.state = createSimState(cfg, init);
  }

  /** 描画補間用。0〜1 で、次tickまでの進み具合 */
  get alpha(): number {
    return Math.min(1, this.accumulator / TICK_MS);
  }

  get tick(): number { return this.state.tick; }

  /**
   * 実時間で elapsedMs ぶん進める。
   * 何tick進むかは elapsedMs だけで決まり、呼び出し回数には依存しない
   * （＝フレームレートが変わっても結果が変わらない）。
   */
  advance(elapsedMs: number, provider: CommandProvider): AdvanceResult {
    const events: SimEvent[] = [];
    let ticks = 0;
    let stalled = false;

    if (this.state.result !== null) return { events, ticks, stalled };

    // 250ms を超える飛びは切り捨てる（タブが裏に回っていた場合など）
    this.accumulator += Math.min(250, Math.max(0, elapsedMs));

    while (this.accumulator >= TICK_MS) {
      if (ticks >= SimRunner.MAX_CATCHUP_TICKS) break;

      const cmds = provider.commandsForTick(this.state.tick + 1);
      if (cmds === null) { stalled = true; break; }   // 相手のコマンド待ち

      const ev = simulateTick(this.state, this.cfg, this.statics, cmds);
      events.push(...ev);
      this.accumulator -= TICK_MS;
      ticks++;

      if (this.state.result !== null) break;
    }

    return { events, ticks, stalled };
  }
}
