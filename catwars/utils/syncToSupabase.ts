// オフラインファースト用のスタブ。
// kurarowa1 では Supabase にクラウド同期していたが、BattleMath:04 では当面 localStorage
// (zustand persist) のみで完結させる。バックエンドは後日 Firebase で作り直す予定のため、
// ここは「何もしない」実装にして、移植した各ストアのシグネチャだけを満たす。
export function syncPlayerState(_state: Record<string, unknown>): void {
  /* no-op (Firebase 実装後に差し替え) */
}

export function syncProgressState(_state: Record<string, unknown>): void {
  /* no-op (Firebase 実装後に差し替え) */
}

export async function loadFromSupabase<T>(_key: string, fallback: T): Promise<T> {
  return fallback;
}
