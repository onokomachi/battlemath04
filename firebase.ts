// Firebase v9 modular SDK
//
// 小4「分数」学習ゲーム専用の新しいFirebaseプロジェクトを使う。
// 設定値は環境変数(VITE_FIREBASE_*)から注入する:
//   1. Firebase コンソールで新規プロジェクトを作成
//   2. ウェブアプリを追加して firebaseConfig の値を取得
//   3. .env.local(または Vercel の環境変数)に VITE_FIREBASE_API_KEY 等を設定
// 環境変数が未設定でもアプリはクラッシュせず、端末内保存のみのオフライン
// モード(ゲストプレイ)として全学習機能が動作する。
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

/** 必須キーがそろっているか(そろっていなければオフラインモード) */
export const isFirebaseConfigured: boolean =
  !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

let app: any = null, auth: any = null, db: any = null, storage: any = null, googleProvider: any = null, analytics: any = null;
let firestoreReady = false;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig as Record<string, string>);
    auth = getAuth(app);
    db = getFirestore(app, env.VITE_FIRESTORE_DATABASE_ID || 'default');
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error('Firebase core initialization error:', error);
  }
} else {
  console.warn(
    '%c[Battle-Math] Firebaseが未設定です。オフラインモード(端末内保存のみ)で起動します。\n' +
    'オンライン機能(ログイン・PvP・ランキング)を使うには .env.local に VITE_FIREBASE_* を設定してください。',
    'color: #fbbf24; font-weight: bold;'
  );
}

// Firestore connectivity check (non-blocking)
const checkFirestoreConnection = async (): Promise<boolean> => {
  if (!db) return false;
  try {
    const { getDocs, collection, query, limit } = await import('firebase/firestore');
    await getDocs(query(collection(db, '__health_check__'), limit(1)));
    firestoreReady = true;
    return true;
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('not found') || msg.includes('404') || e?.code === 'not-found') {
      console.error(
        '%c[Battle-Math] Firestoreデータベースが見つかりません。\n' +
        'Firebase Console → Firestore Database → 「データベースを作成」を実行してください。',
        'color: #ff6b6b; font-size: 14px; font-weight: bold;'
      );
    } else {
      console.warn('[Battle-Math] Firestore connectivity check failed:', msg);
    }
    return false;
  }
};

if (isFirebaseConfigured) {
  // Fire connectivity check (non-blocking)
  checkFirestoreConnection().then(ok => {
    if (ok) console.log('[Battle-Math] Firestore connected');
  });

  // Analytics - optional, should not block auth
  isAnalyticsSupported().then(supported => {
    if (supported && app && firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn('Analytics init skipped:', e);
      }
    }
  }).catch(() => {});
}

export { app, auth, db, storage, googleProvider, analytics, firestoreReady, checkFirestoreConnection };
