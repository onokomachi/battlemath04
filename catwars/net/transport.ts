// ── トランスポート抽象 ──────────────────────────────────────────────────
//
// ロックステップ本体（lockstep.ts）は「バケットを送る／受け取る」ことしか
// 知らない。実体が Firebase なのか、テスト用のインメモリなのかは問わない。
// こう分けておくと、決定論のテストをネットワークなしで回せる。

import { SimCommand, PlayerId } from '../sim/types';

/** 1コマンドと、その実行tick */
export interface CommandEntry {
  t: number;
  c: SimCommand;
}

/** ネットワークに流れる単位。tickをまとめて1メッセージにする */
export interface BucketPayload {
  /** このバケットに属するコマンド（空でも必ず送る＝「操作しなかった」の明示） */
  entries: CommandEntry[];
  /** すでに通過ずみの tick におけるチェックサム（デシンク検出用・任意） */
  sumTick?: number;
  sum?: number;
}

export type ReceiveHandler = (player: PlayerId, bucket: number, payload: BucketPayload) => void;

export interface Transport {
  readonly localPlayer: PlayerId;
  /** バケットを送る。同じ bucket を二度送ってはいけない */
  send(bucket: number, payload: BucketPayload): void;
  /** 受信ハンドラを登録。戻り値は解除関数 */
  onReceive(handler: ReceiveHandler): () => void;
  close(): void;
}

// ── テスト・ローカル対戦用のインメモリ実装 ──────────────────────────────

/**
 * 2つのセッションをプロセス内で直結する。
 * `latencyTicks` を指定すると、その分だけ配送を遅らせて遅延を模擬できる
 * （`pump()` を呼ぶたびに1tickぶん時間が進む扱い）。
 */
export class LocalBus {
  private handlers: { player: PlayerId; fn: ReceiveHandler }[] = [];
  private queue: { at: number; from: PlayerId; bucket: number; payload: BucketPayload }[] = [];
  private clock = 0;

  constructor(private latencyTicks = 0) {}

  transportFor(player: PlayerId): Transport {
    const bus = this;
    return {
      localPlayer: player,
      send(bucket, payload) {
        bus.queue.push({ at: bus.clock + bus.latencyTicks, from: player, bucket, payload });
        bus.flush();
      },
      onReceive(handler) {
        const rec = { player, fn: handler };
        bus.handlers.push(rec);
        return () => { bus.handlers = bus.handlers.filter(h => h !== rec); };
      },
      close() { bus.handlers = bus.handlers.filter(h => h.player !== player); },
    };
  }

  /** 時間を1tick進め、到達したメッセージを配送する */
  pump(): void {
    this.clock++;
    this.flush();
  }

  private flush(): void {
    const ready = this.queue.filter(m => m.at <= this.clock);
    if (ready.length === 0) return;
    this.queue = this.queue.filter(m => m.at > this.clock);
    for (const m of ready) {
      // 送信者以外の全員に配る
      for (const h of this.handlers) {
        if (h.player === m.from) continue;
        h.fn(m.from, m.bucket, m.payload);
      }
    }
  }
}
