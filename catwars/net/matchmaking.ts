// ── CAT-WARS PvP のマッチメイキング ─────────────────────────────────────
//
// 役割分担（docs/PVP_LOCKSTEP.md §7-1）:
//   ・部屋の作成・参加・状態遷移 → Firestore（低頻度・ドキュメント単位）
//   ・tickごとのコマンド配送     → Realtime Database（高頻度・低遅延）
//
// 既存の PvP（card_battle / speed_duel）は `rooms` コレクションを使っている。
// 干渉しないよう、CAT-WARS は `catwars_rooms` を使う。

import {
  collection, doc, setDoc, updateDoc, getDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { BuildingType } from '../types';
import { PlayerId } from '../sim/types';

export type CatWarsRoomStatus = 'waiting' | 'playing' | 'finished';

/** 相手に渡す「自分の設定」。両者が同一の SimConfig を作るために必要 */
export interface PlayerPayload {
  uid: string;
  name: string;
  /** 系統ID → 進化段階 */
  stages: Record<string, 1 | 2 | 3>;
  /** バフ種別 → 効果量（解決ずみ） */
  buffs: Record<string, number>;
  /** 陣地。P2ぶんは対戦開始時に左右反転して使う */
  base: { type: BuildingType; x: number; y: number }[];
  spells: { HEAL: number; RAGE: number };
}

export interface CatWarsRoom {
  roomId: string;
  status: CatWarsRoomStatus;
  mapId: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  host: PlayerPayload | null;
  guest: PlayerPayload | null;
  /** RTDB 上のマッチID（= roomId と同じにする） */
  matchId: string | null;
  /** サーバー由来で確定した乱数シード。ホストが対戦開始時に書き込む */
  seed: number | null;
  createdAt: unknown;
  hostLastActive: unknown;
  guestLastActive: unknown;
  winner: 'host' | 'guest' | 'draw' | 'abandoned' | null;
}

const COL = 'catwars_rooms';

const newRoomId = (): string =>
  'cw-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export async function createRoom(payload: PlayerPayload, mapId: string): Promise<string> {
  if (!db) throw new Error('Firestore が利用できません');
  const roomId = newRoomId();
  const room: Omit<CatWarsRoom, 'createdAt' | 'hostLastActive' | 'guestLastActive'> = {
    roomId, status: 'waiting', mapId,
    hostId: payload.uid, hostName: payload.name,
    guestId: null, guestName: null,
    host: payload, guest: null,
    matchId: roomId, seed: null, winner: null,
  };
  await setDoc(doc(db, COL, roomId), {
    ...room,
    createdAt: serverTimestamp(),
    hostLastActive: serverTimestamp(),
    guestLastActive: null,
  });
  return roomId;
}

export async function joinRoom(roomId: string, payload: PlayerPayload): Promise<boolean> {
  if (!db) return false;
  const ref = doc(db, COL, roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const data = snap.data() as CatWarsRoom;
  if (data.status !== 'waiting') return false;
  if (data.hostId === payload.uid) return false;      // 自分の部屋には入れない
  await updateDoc(ref, {
    guestId: payload.uid,
    guestName: payload.name,
    guest: payload,
    guestLastActive: serverTimestamp(),
  });
  return true;
}

/**
 * ホストが対戦を開始する。ここで seed を確定させる。
 *
 * seed をクライアントが自由に決められると「有利な乱数を引くまで部屋を作り直す」
 * ことができてしまうので、**サーバー時刻を素にして撹拌**した値を使う。
 * （Cloud Functions を使えばより厳密だが、追加デプロイなしで実用上は十分）
 */
export async function startMatch(roomId: string): Promise<number> {
  if (!db) throw new Error('Firestore が利用できません');
  const ref = doc(db, COL, roomId);
  await updateDoc(ref, { seedStamp: serverTimestamp() });
  const snap = await getDoc(ref);
  const data = snap.data() as CatWarsRoom & { seedStamp?: { toMillis?: () => number } };
  const stampMs = data.seedStamp?.toMillis ? data.seedStamp.toMillis() : Date.now();

  let h = 2166136261 >>> 0;
  const src = `${roomId}:${stampMs}`;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619) >>> 0;
  const seed = h >>> 0;

  await updateDoc(ref, { status: 'playing', seed });
  return seed;
}

export function watchRoom(roomId: string, cb: (room: CatWarsRoom | null) => void): () => void {
  if (!db) { cb(null); return () => {}; }
  return onSnapshot(doc(db, COL, roomId), snap => {
    cb(snap.exists() ? (snap.data() as CatWarsRoom) : null);
  }, () => cb(null));
}

export function watchOpenRooms(cb: (rooms: CatWarsRoom[]) => void): () => void {
  if (!db) { cb([]); return () => {}; }
  const q = query(
    collection(db, COL),
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  return onSnapshot(q, snap => {
    const now = Date.now();
    const out: CatWarsRoom[] = [];
    snap.forEach(d => {
      const r = d.data() as CatWarsRoom & { createdAt?: { toMillis?: () => number } };
      // 10分以上前の待機部屋はゾンビとみなして掃除する。
      // deleteDoc ではなく updateDoc(status→finished) にしているのは、
      // Firestoreセキュリティルールの isStaleRoomCleanup() が「status/winnerだけを
      // finishedに変える更新」だけを第三者に許可しているため（rooms コレクションと
      // 同じパターン。参加者以外に delete 権限は与えていない）。
      const created = r.createdAt?.toMillis ? r.createdAt.toMillis() : 0;
      if (created > 0 && now - created > 10 * 60 * 1000) {
        updateDoc(doc(db!, COL, d.id), { status: 'finished', winner: 'abandoned' }).catch(() => {});
        return;
      }
      out.push(r);
    });
    cb(out);
  }, () => cb([]));
}

export async function heartbeat(roomId: string, role: PlayerId): Promise<void> {
  if (!db) return;
  const field = role === 'P1' ? 'hostLastActive' : 'guestLastActive';
  await updateDoc(doc(db, COL, roomId), { [field]: serverTimestamp() }).catch(() => {});
}

export async function finishRoom(roomId: string, winner: CatWarsRoom['winner']): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, COL, roomId), { status: 'finished', winner }).catch(() => {});
}

export async function leaveRoom(roomId: string, isHost: boolean): Promise<void> {
  if (!db) return;
  const ref = doc(db, COL, roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as CatWarsRoom;
  if (data.status === 'finished') return;
  if (data.status === 'waiting' && isHost) {
    await deleteDoc(ref).catch(() => {});
  } else if (data.status === 'playing') {
    await updateDoc(ref, { status: 'finished', winner: isHost ? 'guest' : 'host' }).catch(() => {});
  } else if (!isHost) {
    await updateDoc(ref, { guestId: null, guestName: null, guest: null }).catch(() => {});
  }
}
