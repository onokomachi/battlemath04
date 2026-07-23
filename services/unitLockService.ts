/**
 * services/unitLockService.ts — 単元(ワールド)の使用可否設定
 *
 * 先生が管理画面から「まだ学習していない単元」をロックできる。
 * ロックされた単元は、練習ワールド・カードバトルのデッキ・カードショップ・
 * スピードデュエルの出題から除外される。
 *
 * 保存先: Firestore `config/unit_locks` ドキュメント { locked: string[] }(単元名の配列)。
 * 読み取りはログイン時に1回だけ(150人×1読取/起動 程度)。
 * オフライン・未設定時は「すべて使用可」で動作する。
 */
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LOCK_DOC = 'unit_locks';
const CACHE_KEY = 'fb_unit_locks_cache';

/** ロックされた単元名の集合を取得(失敗時は前回キャッシュ→空) */
export const fetchLockedUnits = async (db: Firestore | null): Promise<Set<string>> => {
  if (!db) return loadCachedLocks();
  try {
    const snap = await getDoc(doc(db, 'config', LOCK_DOC));
    const locked: string[] = snap.exists() ? (snap.data().locked ?? []) : [];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(locked)); } catch {}
    return new Set(locked);
  } catch {
    return loadCachedLocks();
  }
};

const loadCachedLocks = (): Set<string> => {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch {
    return new Set();
  }
};

/** 管理画面: ロック設定を保存(1回の setDoc のみ) */
export const saveLockedUnits = async (db: Firestore, locked: string[]): Promise<void> => {
  await setDoc(doc(db, 'config', LOCK_DOC), { locked, updatedAt: new Date().toISOString() });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(locked)); } catch {}
};
