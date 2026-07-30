// ── Firebase Realtime Database によるコマンド配送 ────────────────────────
//
// プロダクトの使い分け（docs/PVP_LOCKSTEP.md §7-1）:
//   ・マッチメイキング／部屋管理 → **Firestore**（既存の usePvpConnection.ts を流用）
//   ・tickごとのコマンド配送     → **Realtime Database**（低遅延・帯域課金）
//   ・戦績の確定・保存           → Firestore
//
// Firestore は「ドキュメント単位のCRUD」向けで、毎秒数回の細かい書き込みには
// 課金・遅延の両面で不利。だからコマンド配送だけを RTDB に分ける。
//
// データ構造:
//   /catwars_matches/{matchId}/meta            … seed / mapId / 参加者（サーバー確定）
//   /catwars_matches/{matchId}/ticks/{bucket}/{playerId}  … BucketPayload
//
// 1バケット = 4tick = 200ms なので、2人対戦なら書き込みは毎秒5回／人。

import { PlayerId } from '../sim/types';
import { Transport, BucketPayload, ReceiveHandler } from './transport';

/** 動的 import する RTDB の型（firebase/database に依存を固定しないため） */
type RtdbRef = any;

export interface FirebaseTransportOptions {
  matchId: string;
  localPlayer: PlayerId;
  /** getDatabase() のインスタンス */
  database: any;
  rootPath?: string;
}

/**
 * RTDB 版トランスポート。
 *
 * 注意: このクラスは「バケットを送る／受ける」以上のことをしない。
 * デシンク検出も待ち合わせも lockstep.ts の責務。
 */
export class FirebaseTransport implements Transport {
  readonly localPlayer: PlayerId;
  private handlers: ReceiveHandler[] = [];
  private detach: (() => void) | null = null;
  private ticksRef: RtdbRef = null;
  private ready: Promise<void>;

  constructor(private opts: FirebaseTransportOptions) {
    this.localPlayer = opts.localPlayer;
    this.ready = this.attach();
  }

  private async attach(): Promise<void> {
    const { ref, onChildAdded, onChildChanged, off } = await import('firebase/database');
    const root = this.opts.rootPath ?? 'catwars_matches';
    this.ticksRef = ref(this.opts.database, `${root}/${this.opts.matchId}/ticks`);

    const consume = (snap: any) => {
      const bucket = Number(snap.key);
      const val = snap.val() as Record<string, BucketPayload> | null;
      if (!val) return;
      for (const [pid, payload] of Object.entries(val)) {
        if (pid === this.localPlayer) continue;          // 自分ぶんは送信時にローカル反映ずみ
        // entries が undefined で来ることがある（RTDBは空配列を保存しない）
        const safe: BucketPayload = {
          entries: payload.entries ?? [],
          sumTick: payload.sumTick,
          sum: payload.sum,
        };
        for (const h of this.handlers) h(pid as PlayerId, bucket, safe);
      }
    };

    const un1 = onChildAdded(this.ticksRef, consume);
    const un2 = onChildChanged(this.ticksRef, consume);
    this.detach = () => { un1(); un2(); off(this.ticksRef); };
  }

  send(bucket: number, payload: BucketPayload): void {
    void (async () => {
      await this.ready;
      const { ref, set } = await import('firebase/database');
      const root = this.opts.rootPath ?? 'catwars_matches';
      const path = `${root}/${this.opts.matchId}/ticks/${bucket}/${this.localPlayer}`;
      // 空配列は RTDB に保存されないので、受信側で ?? [] している
      await set(ref(this.opts.database, path), {
        entries: payload.entries,
        ...(payload.sum !== undefined ? { sumTick: payload.sumTick, sum: payload.sum } : {}),
      });
    })().catch(err => console.error('[catwars-net] send failed:', err));
  }

  onReceive(handler: ReceiveHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  close(): void {
    this.handlers = [];
    if (this.detach) { this.detach(); this.detach = null; }
  }
}

// ── マッチのメタ情報 ────────────────────────────────────────────────────

export interface MatchMeta {
  seed: number;
  mapId: string;
  chapterId: string;
  /** 各プレイヤーの解決ずみ設定（進化段階・バフ）。両者が同じ SimConfig を作るために必要 */
  setups: Record<PlayerId, { stages: Record<string, 1 | 2 | 3>; buffs: Record<string, number> }>;
  /** 各プレイヤーの陣地 */
  bases: Record<PlayerId, { type: string; x: number; y: number }[]>;
  createdAt: number;
}

/**
 * seed は必ずサーバー側で確定させる。
 *
 * クライアントが決められると「有利な乱数を引くまで部屋を作り直す」ことが
 * できてしまう。RTDB の serverTimestamp をもとにするか、Cloud Functions で
 * 生成する。ここでは前者（追加のデプロイなしで使える）。
 */
export async function createMatchMeta(
  database: any,
  matchId: string,
  partial: Omit<MatchMeta, 'seed' | 'createdAt'>,
  rootPath = 'catwars_matches',
): Promise<MatchMeta> {
  const { ref, set, get, serverTimestamp } = await import('firebase/database');
  const metaRef = ref(database, `${rootPath}/${matchId}/meta`);

  const existing = await get(metaRef);
  if (existing.exists()) return existing.val() as MatchMeta;

  // まずサーバー時刻を書き込み、その値を seed の素にする
  const stampRef = ref(database, `${rootPath}/${matchId}/_stamp`);
  await set(stampRef, serverTimestamp());
  const stampSnap = await get(stampRef);
  const stamp = Number(stampSnap.val()) || Date.now();

  // 時刻そのままだと隣接マッチで似た系列になるので、matchId を混ぜて撹拌する
  let h = 2166136261 >>> 0;
  const src = `${matchId}:${stamp}`;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619) >>> 0;

  const meta: MatchMeta = { ...partial, seed: h >>> 0, createdAt: stamp };
  await set(metaRef, meta);
  return meta;
}

export async function readMatchMeta(
  database: any, matchId: string, rootPath = 'catwars_matches',
): Promise<MatchMeta | null> {
  const { ref, get } = await import('firebase/database');
  const snap = await get(ref(database, `${rootPath}/${matchId}/meta`));
  return snap.exists() ? (snap.val() as MatchMeta) : null;
}

/** 試合終了後にコマンドログを消す（RTDBの容量を食い続けないように） */
export async function cleanupMatch(
  database: any, matchId: string, rootPath = 'catwars_matches',
): Promise<void> {
  const { ref, remove } = await import('firebase/database');
  await remove(ref(database, `${rootPath}/${matchId}`)).catch(() => {});
}
