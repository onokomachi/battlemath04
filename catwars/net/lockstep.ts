// ── ロックステップ本体 ──────────────────────────────────────────────────
//
// 役割は4つだけ。
//   1. ローカルの操作を「入力遅延ぶん未来の tick」に予約する
//   2. バケット単位で送る（**コマンドが無い tick でも必ず送る**）
//   3. 全員のバケットが揃うまでシミュレーションを進めない（tickバリア）
//   4. チェックサムを突き合わせ、ズレたら止める
//
// 「操作しなかった」ことを明示的に送るのがロックステップの肝。これを省くと
// 「まだ届いていない」のか「何もしなかった」のか区別できず、永久に待つ。

import { SimCommand, PlayerId, TICK_MS } from '../sim/types';
import { CommandProvider } from '../sim/runner';
import { Transport, BucketPayload, CommandEntry } from './transport';

/** 1メッセージにまとめる tick 数。20Hz × 4 = 毎秒5メッセージ */
export const BUCKET_TICKS = 4;

export interface LockstepOptions {
  /** 入力遅延(tick)。TICK_MS×これ が往復遅延を上回るように取る */
  inputDelayTicks?: number;
  /** 相手待ちがこの ms を超えたら「待っています」表示 */
  stallWarnMs?: number;
  /** 相手待ちがこの ms を超えたら切断とみなす */
  stallDropMs?: number;
  /** チェックサムを送る間隔（バケット数） */
  checksumEveryBuckets?: number;
}

export type LockstepStatus =
  | { kind: 'RUNNING' }
  | { kind: 'WAITING'; forPlayers: PlayerId[]; waitingMs: number }
  | { kind: 'DESYNC'; tick: number; local: number; remote: number }
  | { kind: 'DROPPED'; player: PlayerId };

const bucketOf = (tick: number): number => Math.floor(tick / BUCKET_TICKS);

export class LockstepSession implements CommandProvider {
  readonly localPlayer: PlayerId;
  readonly remotePlayers: PlayerId[];
  private readonly inputDelay: number;
  private readonly stallWarnMs: number;
  private readonly stallDropMs: number;
  private readonly checksumEvery: number;

  /** 自分のローカルコマンド（実行tickごと） */
  private scheduled = new Map<number, CommandEntry[]>();
  /** 受信済みバケット: `${bucket}:${player}` → payload */
  private inbox = new Map<string, BucketPayload>();
  /** 送信ずみの最大バケット番号 */
  private sentUpTo = -1;
  /** 直近のチェックサム（tick → 値）。相手の申告と突き合わせる */
  private myChecksums = new Map<number, number>();
  /** 最後に送ったチェックサムのバケット */
  private lastChecksumBucket = -1;

  private waitingSince: number | null = null;
  private _status: LockstepStatus = { kind: 'RUNNING' };
  private unsubscribe: () => void;

  constructor(
    private transport: Transport,
    allPlayers: PlayerId[],
    opts: LockstepOptions = {},
  ) {
    this.localPlayer = transport.localPlayer;
    this.remotePlayers = allPlayers.filter(p => p !== this.localPlayer);
    this.inputDelay = opts.inputDelayTicks ?? 6;      // 6tick = 300ms
    this.stallWarnMs = opts.stallWarnMs ?? 1500;
    this.stallDropMs = opts.stallDropMs ?? 10000;
    this.checksumEvery = opts.checksumEveryBuckets ?? 5;  // 5バケット = 1秒

    this.unsubscribe = transport.onReceive((player, bucket, payload) => {
      this.inbox.set(`${bucket}:${player}`, payload);
      this.verifyChecksum(player, payload);
    });
  }

  get status(): LockstepStatus { return this._status; }

  /** ローカル操作を予約する。実行は inputDelay ぶん未来の tick。 */
  issue(cmd: SimCommand, currentTick: number): void {
    let execTick = currentTick + this.inputDelay;
    // すでに送信ずみのバケットには入れられないので、次に送るバケットへずらす
    const earliest = (this.sentUpTo + 1) * BUCKET_TICKS;
    if (execTick < earliest) execTick = earliest;
    const list = this.scheduled.get(execTick) ?? [];
    list.push({ t: execTick, c: cmd });
    this.scheduled.set(execTick, list);
  }

  /**
   * 送れるバケットをすべて送る。毎フレーム呼ぶこと。
   * バケット B を送れるのは「B に新しいコマンドが入る余地が無くなった」
   * とき、つまり currentTick + inputDelay >= (B+1)*BUCKET_TICKS のとき。
   */
  flush(currentTick: number, checksumProvider?: () => { tick: number; sum: number } | null): void {
    for (;;) {
      const b = this.sentUpTo + 1;
      if (currentTick + this.inputDelay < (b + 1) * BUCKET_TICKS) break;

      const entries: CommandEntry[] = [];
      for (let t = b * BUCKET_TICKS; t < (b + 1) * BUCKET_TICKS; t++) {
        const list = this.scheduled.get(t);
        if (list) { entries.push(...list); this.scheduled.delete(t); }
      }

      const payload: BucketPayload = { entries };
      if (checksumProvider && b - this.lastChecksumBucket >= this.checksumEvery) {
        const cs = checksumProvider();
        if (cs) {
          payload.sumTick = cs.tick;
          payload.sum = cs.sum;
          this.lastChecksumBucket = b;
        }
      }

      // 自分ぶんは即座にローカルへ入れる（自分あての配送は待たない）
      this.inbox.set(`${b}:${this.localPlayer}`, payload);
      this.transport.send(b, payload);
      this.sentUpTo = b;
    }
  }

  /** 自分が計算したチェックサムを記録（相手の申告と突き合わせるため） */
  recordChecksum(tick: number, sum: number): void {
    this.myChecksums.set(tick, sum);
    // 直近200tickぶんだけ保持
    if (this.myChecksums.size > 200) {
      const oldest = tick - 200;
      for (const k of this.myChecksums.keys()) if (k < oldest) this.myChecksums.delete(k);
    }
  }

  private verifyChecksum(player: PlayerId, payload: BucketPayload): void {
    if (payload.sumTick === undefined || payload.sum === undefined) return;
    const mine = this.myChecksums.get(payload.sumTick);
    if (mine === undefined) return;              // まだそのtickを通っていない
    if (mine === payload.sum) return;
    if (this._status.kind === 'DESYNC') return;  // 最初の1件だけ報告
    this._status = { kind: 'DESYNC', tick: payload.sumTick, local: mine, remote: payload.sum };
    void player;
  }

  /** CommandProvider の実装。全員ぶんが揃うまで null を返して待たせる。 */
  commandsForTick(tick: number): SimCommand[] | null {
    if (this._status.kind === 'DESYNC' || this._status.kind === 'DROPPED') return null;

    const b = bucketOf(tick);
    const missing: PlayerId[] = [];
    for (const p of [this.localPlayer, ...this.remotePlayers]) {
      if (!this.inbox.has(`${b}:${p}`)) missing.push(p);
    }

    if (missing.length > 0) {
      const now = Date.now();
      if (this.waitingSince === null) this.waitingSince = now;
      const waited = now - this.waitingSince;
      if (waited > this.stallDropMs) {
        this._status = { kind: 'DROPPED', player: missing[0] };
      } else if (waited > this.stallWarnMs) {
        this._status = { kind: 'WAITING', forPlayers: missing, waitingMs: waited };
      }
      return null;
    }

    this.waitingSince = null;
    if (this._status.kind !== 'RUNNING') this._status = { kind: 'RUNNING' };

    // 決定論のため、必ず「プレイヤーID順 → 各自の提出順」で並べる
    const out: SimCommand[] = [];
    for (const p of ([this.localPlayer, ...this.remotePlayers].slice().sort())) {
      const payload = this.inbox.get(`${b}:${p}`)!;
      for (const e of payload.entries) if (e.t === tick) out.push(e.c);
    }
    return out;
  }

  /** 進んだ tick より十分に古い受信データを捨てる */
  prune(currentTick: number): void {
    const keepFrom = bucketOf(currentTick) - 4;
    for (const k of this.inbox.keys()) {
      const b = Number(k.split(':')[0]);
      if (b < keepFrom) this.inbox.delete(k);
    }
  }

  close(): void {
    this.unsubscribe();
    this.transport.close();
  }
}

/**
 * 入力遅延の目安を往復遅延から決める。
 *
 * バケット B が送られるのは tick `(B+1)*BUCKET_TICKS - inputDelay` の時点で、
 * それが片道遅延 L のあと相手に届く。B を使い始める tick は `B*BUCKET_TICKS`
 * なので、間に合う条件は
 *
 *     (B+1)*BUCKET_TICKS - inputDelay + L <= B*BUCKET_TICKS
 *   ⇔ inputDelay >= BUCKET_TICKS + L
 *
 * つまり**入力遅延はバケット長より必ず大きく取る**必要がある。
 * ここに片道遅延（RTTの半分）と1tickの余裕を足す。
 */
export function recommendedInputDelayTicks(rttMs: number): number {
  const oneWayTicks = Math.ceil((rttMs / 2) / TICK_MS);
  const ticks = BUCKET_TICKS + oneWayTicks + 1;
  return Math.max(BUCKET_TICKS + 2, Math.min(16, ticks));
}
