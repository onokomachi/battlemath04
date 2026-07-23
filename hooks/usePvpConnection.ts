/**
 * usePvpConnection - PvP接続レイヤー (App.tsx から分離)
 *
 * - ルーム一覧監視（マッチメイキング中のみ・ゾンビルーム掃除含む）
 * - leaveRoom（離脱時のルームステータス更新）
 * - ハートビート（30秒間隔 + タブ切替時）
 * - 再接続用セッション保存ヘルパー (sessionStorage)
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  doc, getDoc, updateDoc,
  collection, onSnapshot, query, serverTimestamp,
  where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GameState, Room, BattleType } from '../types';

// ============================
// PvP再接続: 進行中の対戦情報をsessionStorageに保持し、
// 誤リロード後に同じルームへ復帰できるようにする
// ============================
export interface SavedPvpSession {
  roomId: string;
  isHost: boolean;
  battleType: BattleType;
  deckIds: number[];
  savedAt: number;
}

export const ACTIVE_PVP_SESSION_KEY = 'bm_active_pvp_session';
/** 再接続を許可する経過時間の上限（これを超えた保存情報は破棄） */
export const PVP_RESUME_MAX_AGE_MS = 10 * 60 * 1000;

export const saveActivePvpSession = (s: SavedPvpSession): void => {
  try { sessionStorage.setItem(ACTIVE_PVP_SESSION_KEY, JSON.stringify(s)); } catch {}
};
export const loadActivePvpSession = (): SavedPvpSession | null => {
  try {
    const raw = sessionStorage.getItem(ACTIVE_PVP_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
export const clearActivePvpSession = (): void => {
  try { sessionStorage.removeItem(ACTIVE_PVP_SESSION_KEY); } catch {}
};

export function usePvpConnection(params: {
  gameState: GameState;
  currentRoomId: string | null;
  user: User | null;
  isHostRef: React.MutableRefObject<boolean>;
  currentRoomIdRef: React.MutableRefObject<string | null>;
}): {
  rooms: Room[];
  firestoreError: string | null;
  leaveRoom: (roomId: string | null, wasHost: boolean) => Promise<void>;
} {
  const { gameState, currentRoomId, user, isHostRef, currentRoomIdRef } = params;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // ============================
  // Room / PvP watch
  // ============================
  // エビデンスA: Firestore query最適化 - finishedルームを除外
  useEffect(() => {
    if (gameState !== 'matchmaking' || !db) return;
    const q = query(
      collection(db, 'rooms'),
      where('status', 'in', ['waiting', 'playing']),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      const list: Room[] = [];
      const now = Date.now();
      snap.forEach(d => {
        const data = d.data() as Room;
        if (!data.roomId) data.roomId = d.id;
        // クライアント側ゾンビ除去: 10分以上前のwaitingルーム
        if (data.status === 'waiting' && data.createdAt) {
          const createdMs = data.createdAt.toDate ? data.createdAt.toDate().getTime() : 0;
          if (createdMs > 0 && now - createdMs > 10 * 60 * 1000) {
            updateDoc(doc(db, 'rooms', d.id), { status: 'finished', winnerId: 'abandoned' }).catch(() => {});
            return;
          }
        }
        // クライアント側ゾンビ除去: playing状態で片方でも3分以上不活性、
        // または両者とも2分以上不活性の場合はゾンビと判定
        if (data.status === 'playing') {
          const hostActive = data.hostLastActive?.toDate ? data.hostLastActive.toDate().getTime() : 0;
          const guestActive = data.guestLastActive?.toDate ? data.guestLastActive.toDate().getTime() : 0;
          const singleStaleMs = 3 * 60 * 1000; // 片方が3分不活性
          const bothStaleMs = 2 * 60 * 1000;   // 両方が2分不活性
          const hostStale = hostActive > 0 && now - hostActive > singleStaleMs;
          const guestStale = guestActive > 0 && now - guestActive > singleStaleMs;
          const bothInactive = hostActive > 0 && guestActive > 0
            && now - hostActive > bothStaleMs && now - guestActive > bothStaleMs;
          if (hostStale || guestStale || bothInactive) {
            // 片方だけ不活性なら、活性側を勝者にする
            let winnerId: string = 'abandoned';
            if (hostStale && !guestStale) winnerId = 'guest';
            else if (guestStale && !hostStale) winnerId = 'host';
            updateDoc(doc(db, 'rooms', d.id), { status: 'finished', winnerId }).catch(() => {});
            return;
          }
        }
        list.push(data);
      });
      setRooms(list);
    }, (error) => {
      const msg = error?.message || '';
      if (msg.includes('not found') || msg.includes('404') || error?.code === 'not-found') {
        setFirestoreError('Firestoreデータベースが未作成です。Firebase Console で Firestore Database を有効化してください。');
      } else if (msg.includes('offline') || msg.includes('unavailable')) {
        setFirestoreError('サーバーに接続できません。インターネット接続を確認してください。');
      } else {
        setFirestoreError(`接続エラー: ${msg}`);
      }
    });
  }, [gameState]);

  // エビデンスA: Firebase公式 - ドキュメントライフサイクル管理
  // ルーム離脱時にFirestoreステータスを更新し、ゾンビルームを防止
  const leaveRoom = useCallback(async (roomId: string | null, wasHost: boolean) => {
    clearActivePvpSession();
    if (!roomId || !db) return;
    try {
      const roomRef = doc(db, 'rooms', roomId);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) return;
      const data = snap.data() as Room;
      if (data.status === 'finished') return;
      if (data.status === 'waiting' && wasHost) {
        // ホストが待機中に離脱 → ルームを終了
        await updateDoc(roomRef, { status: 'finished', winnerId: 'abandoned' });
      } else if (data.status === 'playing') {
        // 対戦中に離脱 → 相手の勝利
        await updateDoc(roomRef, {
          status: 'finished',
          winnerId: wasHost ? 'guest' : 'host',
        });
      }
    } catch (e) { console.error('leaveRoom error:', e); }
  }, []);

  // タブ切替/アプリ切替時のハートビート維持
  // 注意: 以前はページ離脱で即座にルームを終了（=即敗北）させていたが、
  // 誤リロードでも負けになり再接続も不可能だったため廃止。
  // 離脱の判定は既存のハートビート不活性検知（60秒で切断表示、
  // 120秒で自動終了）に委ね、その間の再接続を可能にする。
  useEffect(() => {
    const sendHeartbeat = () => {
      const rid = currentRoomIdRef.current;
      if (!rid || !db) return;
      const field = isHostRef.current ? 'hostLastActive' : 'guestLastActive';
      updateDoc(doc(db, 'rooms', rid), { [field]: serverTimestamp() }).catch(() => {});
    };

    // hidden/visible どちらでも生存信号を送る（iPadのアプリ切替対応）
    const handleVisibilityChange = () => sendHeartbeat();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ハートビートパターン - 30秒ごとにlastActiveを更新（切断を素早く検知）
  useEffect(() => {
    if (!currentRoomId || !db || !user) return;
    const field = isHostRef.current ? 'hostLastActive' : 'guestLastActive';
    const interval = setInterval(() => {
      updateDoc(doc(db, 'rooms', currentRoomId), {
        [field]: serverTimestamp(),
      }).catch(() => {});
    }, 30000);
    // 初回も即時更新
    updateDoc(doc(db, 'rooms', currentRoomId), {
      [field]: serverTimestamp(),
    }).catch(() => {});
    return () => clearInterval(interval);
  }, [currentRoomId, user]);

  return { rooms, firestoreError, leaveRoom };
}
