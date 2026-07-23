/**
 * AdminPanels.tsx — 管理画面の追加パネル
 *  1. UnitLockPanel: 単元(ワールド)の開放/ロック設定
 *  2. AnalyticsPanel: 学習分析(取り組み・誤答傾向・学習履歴)
 *  3. AdminAccessPanel: 管理者アカウントの追加・削除
 *
 * 通信量の設計(150人規模):
 *  - ロック設定: 読み1回(起動時) / 書き1回(保存時)
 *  - 分析: 児童側は dailySummaries/{uid_日付} に1セッション1回の setDoc(merge) のみ。
 *    管理側は選んだ日付の1クエリ(最大 児童数ドキュメント)だけを読む。
 *    リアルタイム監視(onSnapshot)は使わない。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { MATH_CATEGORIES, ADMIN_EMAILS } from '../constants';
import { fetchLockedUnits, saveLockedUnits } from '../services/unitLockService';
import { fetchAdminEmails, saveAdminEmails } from '../services/adminAccessService';

// ============================================================
// 単元ロック
// ============================================================

export const UnitLockPanel: React.FC<{ db: any }> = ({ db }) => {
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchLockedUnits(db).then(s => { setLocked(s); setLoading(false); });
  }, [db]);

  const toggle = (name: string) => {
    setLocked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveLockedUnits(db, [...locked]);
      setSavedAt(new Date().toLocaleTimeString('ja-JP'));
    } catch (e) {
      alert('保存に失敗しました: ' + (e as Error).message);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-gray-500 animate-pulse p-8">読み込み中...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
        <h2 className="text-lg font-bold text-cyan-400 mb-1">単元(ワールド)の開放設定</h2>
        <p className="text-xs text-gray-500 mb-4">
          チェックを外した単元は児童の画面でロックされ、練習・デッキ・ショップ・スピードデュエルで使えなくなります。
          まだ学習していない単元をロックしておき、授業の進度に合わせて開放してください。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          {MATH_CATEGORIES.map((cat, i) => {
            const isOpen = !locked.has(cat.name);
            return (
              <button
                key={cat.name}
                onClick={() => toggle(cat.name)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  isOpen
                    ? 'bg-emerald-900/20 border-emerald-600/40 text-emerald-200'
                    : 'bg-gray-950 border-gray-800 text-gray-500'
                }`}
              >
                <span className="text-lg">{isOpen ? '✅' : '🔒'}</span>
                <span>
                  <span className="block text-[10px] opacity-60 font-mono">WORLD {i + 1}</span>
                  <span className="block text-sm font-bold">{cat.name}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 font-bold text-sm"
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
          {savedAt && <span className="text-xs text-emerald-400">✓ {savedAt} に保存しました</span>}
          <span className="text-[10px] text-gray-600 ml-auto">児童の画面には次回起動時から反映されます</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 学習分析
// ============================================================

interface DailySummaryDoc {
  uid: string;
  label: string | null;
  date: string;
  answered: number;
  correct: number;
  bySubtopic?: Record<string, { a: number; c: number }>;
}

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const subtopicToUnit = (() => {
  const map: Record<string, string> = {};
  MATH_CATEGORIES.forEach(cat => cat.groups.forEach(g => g.subtopics.forEach(st => { map[st] = cat.name; })));
  return map;
})();

export const AnalyticsPanel: React.FC<{ db: any }> = ({ db }) => {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<DailySummaryDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async (d: string) => {
    setLoading(true);
    try {
      // 1クエリのみ(その日にプレイした児童のドキュメントだけが読まれる)
      const snap = await getDocs(query(collection(db, 'dailySummaries'), where('date', '==', d)));
      setRows(snap.docs.map(x => x.data() as DailySummaryDoc).sort((a, b) => (a.label || '').localeCompare(b.label || '', 'ja')));
      setLoadedDate(d);
    } catch (e) {
      alert('読み込みに失敗しました: ' + (e as Error).message);
    }
    setLoading(false);
  };

  // 誤答傾向: サブトピック別の誤答数を全児童で集計
  const wrongTrends = useMemo(() => {
    const agg: Record<string, { wrong: number; total: number }> = {};
    rows.forEach(r => {
      Object.entries(r.bySubtopic || {}).forEach(([st, v]) => {
        const e = agg[st] ?? { wrong: 0, total: 0 };
        e.wrong += v.a - v.c;
        e.total += v.a;
        agg[st] = e;
      });
    });
    return Object.entries(agg)
      .filter(([, v]) => v.wrong > 0)
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .slice(0, 12);
  }, [rows]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({ answered: acc.answered + (r.answered || 0), correct: acc.correct + (r.correct || 0) }),
    { answered: 0, correct: 0 },
  ), [rows]);

  return (
    <div className="h-full overflow-y-auto space-y-4">
      {/* 日付選択 */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-blue-400 mr-2">学習分析</h2>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => load(date)}
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 font-bold text-sm"
        >
          {loading ? '読み込み中...' : 'この日の記録を読み込む'}
        </button>
        <span className="text-[10px] text-gray-600">
          読取はボタンを押した時だけ(その日にプレイした児童のぶんのみ)。個別ランキングは児童側に表示しません。
        </span>
      </div>

      {loadedDate && (
        <>
          {/* 全体サマリ */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['取り組んだ児童', `${rows.length}人`],
              ['解いた問題', `${totals.answered}問`],
              ['全体正答率', totals.answered ? `${Math.round((totals.correct / totals.answered) * 100)}%` : '--'],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-[10px] text-gray-500 font-bold">{k}</p>
                <p className="text-2xl font-black text-blue-300">{v}</p>
              </div>
            ))}
          </div>

          {/* 誤答傾向 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3">まちがいの傾向(誤答が多いサブトピック)</h3>
            {wrongTrends.length === 0 ? (
              <p className="text-xs text-gray-600">誤答データがありません。</p>
            ) : (
              <div className="space-y-1.5">
                {wrongTrends.map(([st, v]) => (
                  <div key={st} className="flex items-center gap-3 text-xs">
                    <span className="w-52 truncate text-gray-300">{st}</span>
                    <span className="w-36 truncate text-gray-600">{subtopicToUnit[st] || ''}</span>
                    <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/70" style={{ width: `${Math.min((v.wrong / Math.max(v.total, 1)) * 100, 100)}%` }} />
                    </div>
                    <span className="w-24 text-right font-mono text-red-300">{v.wrong}問 / {v.total}問</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 児童別 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-bold text-purple-400 mb-3">児童別の取り組み({loadedDate})</h3>
            {rows.length === 0 ? (
              <p className="text-xs text-gray-600">この日の学習記録はありません。</p>
            ) : (
              <div className="space-y-1">
                {rows.map(r => {
                  const rate = r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
                  const isOpen = expanded === r.uid;
                  return (
                    <div key={r.uid} className="bg-gray-950 rounded-lg border border-gray-800">
                      <button
                        onClick={() => setExpanded(isOpen ? null : r.uid)}
                        className="w-full flex items-center gap-3 p-2.5 text-left text-xs"
                      >
                        <span className="w-40 font-bold text-gray-200 truncate">{r.label || r.uid.slice(0, 8)}</span>
                        <span className="text-gray-400">{r.answered}問</span>
                        <span className="text-emerald-400">正解 {r.correct}</span>
                        <span className={`font-bold ${rate >= 80 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{rate}%</span>
                        <span className="ml-auto text-gray-600">{isOpen ? '▲' : '▼ 単元別'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {Object.entries(r.bySubtopic || {}).sort((a, b) => b[1].a - a[1].a).map(([st, v]) => (
                            <div key={st} className="flex justify-between text-[11px] text-gray-400 bg-gray-900 rounded px-2 py-1">
                              <span className="truncate mr-2">{st}</span>
                              <span className="font-mono flex-shrink-0">
                                {v.c}/{v.a}
                                {v.a - v.c > 0 && <span className="text-red-400 ml-1">✗{v.a - v.c}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================
// 管理者アカウントの追加・削除
// ============================================================

const isValidEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const AdminAccessPanel: React.FC<{ db: any }> = ({ db }) => {
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminEmails(db).then(list => { setEmails(list); setLoading(false); });
  }, [db]);

  const persist = async (next: string[]) => {
    setSaving(true);
    try {
      await saveAdminEmails(db, next);
      setEmails(next);
      setSavedAt(new Date().toLocaleTimeString('ja-JP'));
    } catch (e) {
      alert('保存に失敗しました: ' + (e as Error).message);
    }
    setSaving(false);
  };

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!isValidEmail(email)) { alert('正しいメールアドレスを入力してください。'); return; }
    if (ADMIN_EMAILS.includes(email) || emails.includes(email)) { alert('すでに登録されています。'); return; }
    persist([...emails, email]);
    setNewEmail('');
  };

  const handleRemove = (email: string) => {
    if (!confirm(`「${email}」を管理者から外しますか？`)) return;
    persist(emails.filter(e => e !== email));
  };

  if (loading) return <div className="text-gray-500 animate-pulse p-8">読み込み中...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4 max-w-2xl">
        <h2 className="text-lg font-bold text-red-400 mb-1">管理者の追加・削除</h2>
        <p className="text-xs text-gray-500 mb-4">
          ここに追加したGoogleアカウントのメールアドレスは、次回ログイン時から
          パスワード(管理画面を開くときのもの)で管理画面に入れるようになります。
        </p>

        <div className="mb-4">
          <p className="text-xs text-gray-400 font-bold mb-2">固定の管理者(コードに登録・ここからは削除できません)</p>
          <div className="flex flex-wrap gap-2">
            {ADMIN_EMAILS.map(email => (
              <span key={email} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">
                {email}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 font-bold mb-2">追加された管理者</p>
          {emails.length === 0 ? (
            <p className="text-xs text-gray-600">まだ追加されていません。</p>
          ) : (
            <div className="space-y-1.5">
              {emails.map(email => (
                <div key={email} className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-200 font-mono">{email}</span>
                  <button
                    onClick={() => handleRemove(email)}
                    disabled={saving}
                    className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-3 py-1 rounded hover:bg-red-800/50 disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="追加する先生のメールアドレス"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newEmail.trim()}
            className="px-5 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 font-bold text-sm"
          >
            追加
          </button>
        </div>
        {savedAt && <p className="text-xs text-emerald-400 mt-3">✓ {savedAt} に保存しました(次回ログインから反映されます)</p>}
      </div>
    </div>
  );
};
