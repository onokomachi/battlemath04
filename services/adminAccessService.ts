/**
 * services/adminAccessService.ts — 管理者メールアドレスの動的管理
 *
 * ADMIN_EMAILS(constants.ts)の固定1件に加えて、管理画面から追加・削除できる
 * 管理者一覧を Firestore `config/admins` ドキュメント { emails: string[] } に保存する。
 * firestore.rules の isAdmin() もこのドキュメントを参照するため、ここに追加すれば
 * 実際の管理者権限(バッジ付与・単元ロック等)も同時に付与される。
 *
 * 読み取りはログイン時に1回だけ。オフライン・未設定時は前回キャッシュ→空配列で動作する。
 */
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ADMIN_DOC = 'admins';
const CACHE_KEY = 'fb_admin_emails_cache';

/** 追加された管理者メールの配列を取得(失敗時は前回キャッシュ→空) */
export const fetchAdminEmails = async (db: Firestore | null): Promise<string[]> => {
  if (!db) return loadCachedAdminEmails();
  try {
    const snap = await getDoc(doc(db, 'config', ADMIN_DOC));
    const emails: string[] = snap.exists() ? (snap.data().emails ?? []) : [];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(emails)); } catch {}
    return emails;
  } catch {
    return loadCachedAdminEmails();
  }
};

const loadCachedAdminEmails = (): string[] => {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

/** 管理画面: 管理者メール一覧を保存(1回の setDoc のみ) */
export const saveAdminEmails = async (db: Firestore, emails: string[]): Promise<void> => {
  await setDoc(doc(db, 'config', ADMIN_DOC), { emails, updatedAt: new Date().toISOString() });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(emails)); } catch {}
};
