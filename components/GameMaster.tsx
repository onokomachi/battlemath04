/**
 * GameMaster.tsx - BattleMath Admin Panel
 *
 * 管理機能:
 *  - ユーザー管理 (戦績/レベル確認・リセット・削除)
 *  - クラス管理 (組別の生徒一覧、成績、学習状況。本アプリは4年生専用のため学年選択はない)
 *  - ルーム管理 (PvPルームの状況確認・強制終了)
 *  - 統計 (全体統計・ランキング)
 *  - ゲーム設定 (お知らせ・メンテナンス管理)
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, limit, getDoc, setDoc
} from 'firebase/firestore';
import type { Room, StudentProfile } from '../types';
import { TARGET_GRADE } from '../constants';
import { UnitLockPanel, AnalyticsPanel, AdminAccessPanel } from './AdminPanels';

// ---- Types ----
interface UserData {
  id: string;
  displayName: string;
  email: string;
  playerLevel: number;
  playerExp: number;
  totalWins: number;
  totalMatches: number;
  mathPoints: number;
  ownedCardIds: number[];
  createdAt: any;
  totalCorrectAnswers?: number;
  loginStreak?: number;
  lastLoginDate?: string;
  earnedBadgeIds?: string[];
  classId?: string;
  studentProfile?: StudentProfile;
}

interface GameConfig {
  maintenanceMode: boolean;
  announcement: string;
  maxPvpRooms: number;
}

interface GameMasterProps {
  db: any;
  onClose: () => void;
}

// ---- Helpers ----
const formatDate = (ts: any) => {
  if (!ts) return '---';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ja-JP');
};

const winRate = (wins: number, matches: number) =>
  matches === 0 ? '--' : `${Math.round((wins / matches) * 100)}%`;

// ---- Component ----
const GameMaster: React.FC<GameMasterProps> = ({ db, onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'class' | 'rooms' | 'stats' | 'config' | 'units' | 'analytics' | 'access'>('class');
  const [users, setUsers] = useState<UserData[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    maintenanceMode: false,
    announcement: '',
    maxPvpRooms: 50,
  });
  const [configDraft, setConfigDraft] = useState<GameConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Class management state(本アプリは4年生専用のため学年選択はなく、組のみで絞り込む)
  const [selectedClassNum, setSelectedClassNum] = useState<number>(1);
  const [classDetailUser, setClassDetailUser] = useState<UserData | null>(null);

  // Real-time user watch
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(500));
    return onSnapshot(q, snap => {
      const list: UserData[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as UserData));
      setUsers(list);
    });
  }, [db]);

  // Real-time room watch
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, snap => {
      const list: Room[] = [];
      snap.forEach(d => {
        const data = d.data() as Room;
        if (!data.roomId) data.roomId = d.id;
        list.push(data);
      });
      setRooms(list);
    });
  }, [db]);

  // Load game config
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'config', 'game')).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as GameConfig;
        setGameConfig(data);
        setConfigDraft(data);
      } else {
        setConfigDraft(gameConfig);
      }
    }).catch(console.error);
  }, [db]);

  // --- Derived stats ---
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalWins = users.reduce((s, u) => s + (u.totalWins || 0), 0);
    const totalMatches = users.reduce((s, u) => s + (u.totalMatches || 0), 0);
    const activeRooms = rooms.filter(r => r.status === 'playing').length;
    const waitingRooms = rooms.filter(r => r.status === 'waiting').length;
    const avgLevel = totalUsers > 0 ? (users.reduce((s, u) => s + (u.playerLevel || 1), 0) / totalUsers).toFixed(1) : '--';
    return { totalUsers, totalWins, totalMatches, activeRooms, waitingRooms, avgLevel };
  }, [users, rooms]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const s = userSearch.toLowerCase();
    return users.filter(u =>
      u.displayName?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.studentProfile?.displayLabel?.includes(s)
    );
  }, [users, userSearch]);

  // --- Class-based data ---
  // 組で生徒をグループ化(本アプリは4年生専用なので学年での絞り込みは不要)
  const classStudents = useMemo(() => {
    return users.filter(u => u.studentProfile?.classNum === selectedClassNum)
      .sort((a, b) => (a.studentProfile?.number || 0) - (b.studentProfile?.number || 0));
  }, [users, selectedClassNum]);

  // クラス全体の統計
  const classStats = useMemo(() => {
    if (classStudents.length === 0) return null;
    const totalStudents = classStudents.length;
    const avgLevel = classStudents.reduce((s, u) => s + (u.playerLevel || 1), 0) / totalStudents;
    const totalCorrect = classStudents.reduce((s, u) => s + (u.totalCorrectAnswers || 0), 0);
    const totalMatches = classStudents.reduce((s, u) => s + (u.totalMatches || 0), 0);
    const totalWins = classStudents.reduce((s, u) => s + (u.totalWins || 0), 0);
    const avgMP = classStudents.reduce((s, u) => s + (u.mathPoints || 0), 0) / totalStudents;
    const activeLast7d = classStudents.filter(u => {
      if (!u.lastLoginDate) return false;
      const last = new Date(u.lastLoginDate).getTime();
      return Date.now() - last < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { totalStudents, avgLevel, totalCorrect, totalMatches, totalWins, avgMP, activeLast7d };
  }, [classStudents]);

  // 全組に存在する生徒数のサマリー
  const classSummary = useMemo(() => {
    const summary: Record<number, number> = {};
    users.forEach(u => {
      const sp = u.studentProfile;
      if (!sp) return;
      summary[sp.classNum] = (summary[sp.classNum] || 0) + 1;
    });
    return summary;
  }, [users]);

  // --- User Actions ---
  const handleResetUserStats = async (userId: string, name: string) => {
    if (!confirm(`「${name}」の戦績をリセットしますか？`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { totalWins: 0, totalMatches: 0 });
      alert('リセットしました。');
    } catch (e) { console.error(e); alert('エラーが発生しました。'); }
  };

  const handleGrantMathPoints = async (userId: string, name: string) => {
    const amount = parseInt(prompt(`「${name}」に付与するマスポイント数を入力:`) || '0');
    if (isNaN(amount) || amount === 0) return;
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      const current = snap.data()?.mathPoints || 0;
      await updateDoc(ref, { mathPoints: current + amount });
      alert(`${amount} MPを付与しました。`);
    } catch (e) { console.error(e); alert('エラー'); }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    const confirm1 = prompt(`警告: 「${name}」を削除します。\nユーザー名を入力して確認:`);
    if (confirm1 !== name) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert('削除しました。');
    } catch (e) { console.error(e); alert('削除失敗'); }
  };

  const handleUpdateStudentProfile = async (userId: string, profile: StudentProfile) => {
    try {
      await updateDoc(doc(db, 'users', userId), { studentProfile: profile });
      alert('更新しました。');
    } catch (e) { console.error(e); alert('更新失敗'); }
  };

  // --- Room Actions ---
  const handleForceCloseRoom = async (roomId: string) => {
    if (!confirm(`ルーム「${roomId}」を強制終了しますか？`)) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'finished',
        winnerId: 'admin_terminated'
      });
      alert('終了しました。');
    } catch (e) { console.error(e); alert('エラー'); }
  };

  const handleCleanupZombieRooms = async () => {
    const zombies = rooms.filter(r => {
      if (r.status === 'finished') return true;
      if (r.status === 'waiting' && r.createdAt) {
        const createdMs = r.createdAt.toDate ? r.createdAt.toDate().getTime() : 0;
        return createdMs > 0 && Date.now() - createdMs > 10 * 60 * 1000;
      }
      return false;
    });
    if (zombies.length === 0) { alert('クリーンアップ対象のルームはありません。'); return; }
    if (!confirm(`${zombies.length}件のルームを削除しますか？`)) return;
    let deleted = 0;
    for (const room of zombies) {
      try {
        await deleteDoc(doc(db, 'rooms', room.roomId));
        deleted++;
      } catch (e) { console.error('Delete failed:', room.roomId, e); }
    }
    alert(`${deleted}/${zombies.length}件を削除しました。`);
  };

  // --- Config Actions ---
  const handleSaveConfig = async () => {
    if (!configDraft || !db) return;
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'config', 'game'), configDraft);
      setGameConfig(configDraft);
      alert('設定を保存しました。');
    } catch (e) { console.error(e); alert('保存失敗'); }
    setIsSavingConfig(false);
  };

  const tabs = [
    { id: 'class', label: 'クラス管理', color: 'text-purple-400' },
    { id: 'analytics', label: '学習分析', color: 'text-blue-400' },
    { id: 'units', label: '単元ロック', color: 'text-cyan-400' },
    { id: 'users', label: 'ユーザー', color: 'text-amber-400' },
    { id: 'rooms', label: 'ルーム', color: 'text-green-400' },
    { id: 'stats', label: '統計', color: 'text-blue-400' },
    { id: 'config', label: '設定', color: 'text-red-400' },
    { id: 'access', label: '管理者', color: 'text-pink-400' },
  ] as const;

  const roomStatusBadge = (status: string) => {
    if (status === 'playing') return 'bg-red-900/50 text-red-300 border-red-800';
    if (status === 'waiting') return 'bg-green-900/50 text-green-300 border-green-800';
    return 'bg-gray-800 text-gray-400 border-gray-700';
  };

  return (
    <div className="w-full h-full bg-gray-950 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-red-500 tracking-widest">GAME MASTER</h1>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
                  activeTab === t.id
                    ? `bg-gray-700 ${t.color}`
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-sm text-gray-400 border border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          閉じる
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-hidden p-6">

        {/* ===== UNIT LOCK TAB ===== */}
        {activeTab === 'units' && <UnitLockPanel db={db} />}

        {/* ===== ANALYTICS TAB ===== */}
        {activeTab === 'analytics' && <AnalyticsPanel db={db} />}

        {/* ===== ADMIN ACCESS TAB ===== */}
        {activeTab === 'access' && <AdminAccessPanel db={db} />}

        {/* ===== CLASS MANAGEMENT TAB ===== */}
        {activeTab === 'class' && (
          <div className="h-full flex flex-col gap-4 overflow-hidden">
            {/* Class selector(本アプリは4年生専用のため組のみ選択) */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-400 font-bold tracking-widest">{TARGET_GRADE}年 組:</span>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(c => {
                      const count = classSummary[c] || 0;
                      return (
                        <button
                          key={c}
                          onClick={() => setSelectedClassNum(c)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all relative ${
                            selectedClassNum === c
                              ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
                          }`}
                        >
                          {c}組
                          {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-mono">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Class stats summary */}
            {classStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: '生徒数', value: classStats.totalStudents, color: 'text-purple-400', unit: '人' },
                  { label: '平均Lv', value: classStats.avgLevel.toFixed(1), color: 'text-red-400', unit: '' },
                  { label: '総正答数', value: classStats.totalCorrect, color: 'text-green-400', unit: '' },
                  { label: '総対戦数', value: classStats.totalMatches, color: 'text-blue-400', unit: '' },
                  { label: '総勝利数', value: classStats.totalWins, color: 'text-amber-400', unit: '' },
                  { label: '平均MP', value: Math.round(classStats.avgMP).toLocaleString(), color: 'text-amber-300', unit: '' },
                  { label: '直近7日\nアクティブ', value: classStats.activeLast7d, color: 'text-green-300', unit: `/${classStats.totalStudents}` },
                ].map(item => (
                  <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-1 whitespace-pre-line">{item.label}</p>
                    <p className={`text-xl font-bold font-mono ${item.color}`}>
                      {item.value}<span className="text-xs text-gray-500">{item.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Student detail modal */}
            {classDetailUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{classDetailUser.displayName || 'Unknown'}</h3>
                      <p className="text-sm text-purple-400">{classDetailUser.studentProfile?.displayLabel}</p>
                      <p className="text-xs text-gray-500">{classDetailUser.email}</p>
                    </div>
                    <button
                      onClick={() => setClassDetailUser(null)}
                      className="text-gray-500 hover:text-white text-xl"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'レベル', value: classDetailUser.playerLevel || 1, color: 'text-red-400' },
                      { label: 'MP', value: (classDetailUser.mathPoints || 0).toLocaleString(), color: 'text-amber-400' },
                      { label: '勝利数', value: classDetailUser.totalWins || 0, color: 'text-green-400' },
                      { label: '対戦数', value: classDetailUser.totalMatches || 0, color: 'text-blue-400' },
                      { label: '勝率', value: winRate(classDetailUser.totalWins || 0, classDetailUser.totalMatches || 0), color: 'text-amber-300' },
                      { label: '総正答数', value: classDetailUser.totalCorrectAnswers || 0, color: 'text-green-300' },
                      { label: 'ログイン連続', value: `${classDetailUser.loginStreak || 0}日`, color: 'text-orange-400' },
                      { label: '最終ログイン', value: classDetailUser.lastLoginDate || '---', color: 'text-gray-300' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-800 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 mb-0.5">{item.label}</p>
                        <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Badges */}
                  {classDetailUser.earnedBadgeIds && classDetailUser.earnedBadgeIds.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">獲得バッジ</p>
                      <div className="flex flex-wrap gap-2">
                        {classDetailUser.earnedBadgeIds.map(bid => (
                          <span key={bid} className="bg-amber-900/30 border border-amber-700/40 px-2 py-1 rounded-full text-xs text-amber-300">
                            {bid}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card collection */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">カード所持数</p>
                    <p className="text-lg font-bold text-red-300 font-mono">
                      {classDetailUser.ownedCardIds?.length || 0} 枚
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 mb-1">登録日</p>
                  <p className="text-sm text-gray-400">{formatDate(classDetailUser.createdAt)}</p>

                  {/* Actions */}
                  <div className="flex gap-2 mt-6 pt-4 border-t border-gray-700">
                    <button onClick={() => { handleResetUserStats(classDetailUser.id, classDetailUser.displayName); }} className="text-xs bg-orange-900/50 text-orange-300 border border-orange-800 px-3 py-1.5 rounded hover:bg-orange-800/50">戦績リセット</button>
                    <button onClick={() => { handleGrantMathPoints(classDetailUser.id, classDetailUser.displayName); }} className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1.5 rounded hover:bg-blue-800/50">MP付与</button>
                  </div>
                </div>
              </div>
            )}

            {/* Student list */}
            <div className="flex-grow bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-bold text-purple-400">
                  {TARGET_GRADE}年{selectedClassNum}組 ({classStudents.length}名)
                </h2>
              </div>
              <div className="flex-grow overflow-auto">
                {classStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-4xl mb-3 opacity-30">&#128203;</p>
                    <p className="text-sm">このクラスにはまだ生徒が登録されていません</p>
                    <p className="text-xs text-gray-600 mt-1">生徒がログイン時に学年・組・番号を選択すると表示されます</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-gray-950 text-gray-500 text-xs sticky top-0">
                      <tr>
                        <th className="p-3 text-center w-12">番号</th>
                        <th className="p-3">氏名</th>
                        <th className="p-3 text-center">Lv</th>
                        <th className="p-3 text-center">正答数</th>
                        <th className="p-3 text-center">戦績</th>
                        <th className="p-3 text-center">MP</th>
                        <th className="p-3 text-center">連続</th>
                        <th className="p-3 text-center">最終ログイン</th>
                        <th className="p-3 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {classStudents.map(u => {
                        const isActive = u.lastLoginDate && (Date.now() - new Date(u.lastLoginDate).getTime()) < 3 * 24 * 60 * 60 * 1000;
                        return (
                          <tr key={u.id} className="hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => setClassDetailUser(u)}>
                            <td className="p-3 text-center font-mono text-sm text-purple-300 font-bold">{u.studentProfile?.number}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                                <div>
                                  <div className="font-bold text-sm">{u.displayName || 'Unknown'}</div>
                                  <div className="text-[10px] text-gray-500">{u.email?.split('@')[0] || ''}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center text-red-400 font-bold">{u.playerLevel || 1}</td>
                            <td className="p-3 text-center text-green-400 font-mono text-sm">{u.totalCorrectAnswers || 0}</td>
                            <td className="p-3 text-center">
                              <span className="text-amber-400 font-bold text-sm">{u.totalWins || 0}</span>
                              <span className="text-gray-500 text-xs">/{u.totalMatches || 0}</span>
                              <span className="text-green-400 text-xs ml-1">{winRate(u.totalWins || 0, u.totalMatches || 0)}</span>
                            </td>
                            <td className="p-3 text-center text-amber-300 font-mono text-sm">{(u.mathPoints || 0).toLocaleString()}</td>
                            <td className="p-3 text-center">
                              {(u.loginStreak || 0) >= 2 ? (
                                <span className="text-orange-400 font-bold text-sm">{u.loginStreak}日</span>
                              ) : (
                                <span className="text-gray-600 text-xs">---</span>
                              )}
                            </td>
                            <td className="p-3 text-center text-xs text-gray-500">{u.lastLoginDate || '---'}</td>
                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => setClassDetailUser(u)} className="text-xs bg-purple-900/50 text-purple-300 border border-purple-800 px-2 py-0.5 rounded hover:bg-purple-800/50">詳細</button>
                                <button onClick={() => handleGrantMathPoints(u.id, u.displayName)} className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-0.5 rounded hover:bg-blue-800/50">MP+</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div className="h-full flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-amber-400">ユーザー ({filteredUsers.length} / {users.length})</h2>
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="名前・メール・学年組で検索..."
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-amber-500 outline-none w-60"
              />
            </div>
            <div className="flex-grow overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-950 text-gray-500 text-xs sticky top-0">
                  <tr>
                    <th className="p-3 text-center">Rank</th>
                    <th className="p-3">ユーザー</th>
                    <th className="p-3 text-center">学年組番</th>
                    <th className="p-3 text-center">Lv</th>
                    <th className="p-3 text-center">戦績</th>
                    <th className="p-3 text-center">MP</th>
                    <th className="p-3 text-center">登録日</th>
                    <th className="p-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredUsers.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-3 text-center text-gray-500 font-mono text-xs">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-sm">{u.displayName || 'Unknown'}</div>
                        <div className="text-xs text-gray-500 font-mono">{u.email || u.id.slice(0, 12) + '...'}</div>
                      </td>
                      <td className="p-3 text-center">
                        {u.studentProfile ? (
                          <span className="text-purple-300 text-xs font-bold">{u.studentProfile.displayLabel}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">未設定</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-red-400 font-bold">{u.playerLevel || 1}</td>
                      <td className="p-3 text-center">
                        <span className="text-amber-400 font-bold">{u.totalWins || 0}勝</span>
                        <span className="text-gray-500 text-xs"> / {u.totalMatches || 0}戦</span>
                        <br />
                        <span className="text-green-400 text-xs">{winRate(u.totalWins || 0, u.totalMatches || 0)}</span>
                      </td>
                      <td className="p-3 text-center text-amber-300 font-mono text-sm">{(u.mathPoints || 0).toLocaleString()}</td>
                      <td className="p-3 text-center text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          <button onClick={() => handleResetUserStats(u.id, u.displayName)} className="text-xs bg-orange-900/50 text-orange-300 border border-orange-800 px-2 py-0.5 rounded hover:bg-orange-800/50">戦績R</button>
                          <button onClick={() => handleGrantMathPoints(u.id, u.displayName)} className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-0.5 rounded hover:bg-blue-800/50">MP+</button>
                          <button onClick={() => handleDeleteUser(u.id, u.displayName)} className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-0.5 rounded hover:bg-red-800/50">削除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== ROOMS TAB ===== */}
        {activeTab === 'rooms' && (
          <div className="h-full flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-green-400">
                ルーム ({rooms.filter(r => r.status !== 'finished').length} アクティブ / {rooms.length} 総計)
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex gap-3 text-xs font-mono">
                  <span className="text-green-400">待機: {rooms.filter(r => r.status === 'waiting').length}</span>
                  <span className="text-red-400">対戦中: {rooms.filter(r => r.status === 'playing').length}</span>
                  <span className="text-gray-500">終了: {rooms.filter(r => r.status === 'finished').length}</span>
                </div>
                <button
                  onClick={handleCleanupZombieRooms}
                  className="text-xs bg-yellow-900/50 text-yellow-300 border border-yellow-800 px-3 py-1 rounded hover:bg-yellow-800/50"
                >
                  ゾンビ一括削除
                </button>
              </div>
            </div>
            <div className="flex-grow overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-950 text-gray-500 text-xs sticky top-0">
                  <tr>
                    <th className="p-3">ルームID</th>
                    <th className="p-3 text-center">状態</th>
                    <th className="p-3">ホスト / ゲスト</th>
                    <th className="p-3 text-center">HP</th>
                    <th className="p-3 text-center">Rd</th>
                    <th className="p-3 text-center">作成日時</th>
                    <th className="p-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rooms.map(room => (
                    <tr key={room.roomId} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-3 font-mono text-xs text-red-300">{room.roomId}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded border ${roomStatusBadge(room.status)}`}>
                          {room.status === 'playing' ? '対戦中' : room.status === 'waiting' ? '待機中' : '終了'}
                        </span>
                      </td>
                      <td className="p-3 text-sm">
                        <div>{room.hostName}</div>
                        <div className="text-xs text-gray-500">{room.guestName || '---'}</div>
                      </td>
                      <td className="p-3 text-center text-xs font-mono">
                        <span className="text-blue-400">{room.p1Hp ?? '--'}</span>
                        <span className="text-gray-600"> / </span>
                        <span className="text-red-400">{room.p2Hp ?? '--'}</span>
                      </td>
                      <td className="p-3 text-center text-xs text-gray-400">{room.round}</td>
                      <td className="p-3 text-center text-xs text-gray-500">{formatDate(room.createdAt)}</td>
                      <td className="p-3 text-center">
                        {room.status !== 'finished' && (
                          <button
                            onClick={() => handleForceCloseRoom(room.roomId)}
                            className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-3 py-1 rounded hover:bg-red-800/50"
                          >
                            強制終了
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== STATS TAB ===== */}
        {activeTab === 'stats' && (
          <div className="h-full overflow-auto space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: '総ユーザー数', value: stats.totalUsers, color: 'text-amber-400' },
                { label: '平均レベル', value: stats.avgLevel, color: 'text-red-400' },
                { label: '総対戦数', value: stats.totalMatches, color: 'text-blue-400' },
                { label: '総勝利数', value: stats.totalWins, color: 'text-green-400' },
                { label: 'アクティブルーム', value: stats.activeRooms, color: 'text-red-400' },
                { label: '待機ルーム', value: stats.waitingRooms, color: 'text-yellow-400' },
              ].map(item => (
                <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className={`text-3xl font-bold font-mono ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Class-level overview(本アプリは4年生専用のため学年別ではなく組別) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-bold text-purple-400">組別サマリー({TARGET_GRADE}年生)</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.keys(classSummary).map(Number).sort((a, b) => a - b).map(classNum => {
                  const classUsers = users.filter(u => u.studentProfile?.classNum === classNum);
                  const classTotal = classUsers.length;
                  const classAvgLv = classTotal > 0 ? (classUsers.reduce((s, u) => s + (u.playerLevel || 1), 0) / classTotal).toFixed(1) : '--';
                  const classCorrect = classUsers.reduce((s, u) => s + (u.totalCorrectAnswers || 0), 0);
                  return (
                    <div key={classNum} className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-lg font-bold text-purple-300 mb-3">{classNum}組</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">登録者数</span>
                          <span className="text-white font-bold">{classTotal}人</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">平均Lv</span>
                          <span className="text-red-400 font-bold">{classAvgLv}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">総正答数</span>
                          <span className="text-green-400 font-bold">{classCorrect}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 10 by wins */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-bold text-amber-400">勝利数ランキング TOP10</h3>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-950 text-gray-500 text-xs">
                  <tr>
                    <th className="p-3 text-center w-12">順位</th>
                    <th className="p-3">プレイヤー</th>
                    <th className="p-3 text-center">学年組番</th>
                    <th className="p-3 text-center">勝利</th>
                    <th className="p-3 text-center">対戦</th>
                    <th className="p-3 text-center">勝率</th>
                    <th className="p-3 text-center">Lv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.slice(0, 10).map((u, i) => (
                    <tr key={u.id} className="hover:bg-gray-800/50">
                      <td className="p-3 text-center font-mono text-sm text-gray-400">{i + 1}</td>
                      <td className="p-3 font-bold text-sm">{u.displayName || 'Unknown'}</td>
                      <td className="p-3 text-center text-xs text-purple-300">{u.studentProfile?.displayLabel || '---'}</td>
                      <td className="p-3 text-center text-amber-400 font-bold">{u.totalWins || 0}</td>
                      <td className="p-3 text-center text-gray-400">{u.totalMatches || 0}</td>
                      <td className="p-3 text-center text-green-400">{winRate(u.totalWins || 0, u.totalMatches || 0)}</td>
                      <td className="p-3 text-center text-red-400">{u.playerLevel || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== CONFIG TAB ===== */}
        {activeTab === 'config' && configDraft && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-red-400 text-lg">ゲーム設定</h3>

              {/* Maintenance mode */}
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <p className="font-bold text-sm">メンテナンスモード</p>
                  <p className="text-xs text-gray-400">ONにするとゲスト以外がログインできなくなります</p>
                </div>
                <button
                  onClick={() => setConfigDraft(p => p ? { ...p, maintenanceMode: !p.maintenanceMode } : p)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    configDraft.maintenanceMode ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    configDraft.maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Announcement */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">お知らせテキスト（空白で非表示）</label>
                <textarea
                  value={configDraft.announcement}
                  onChange={e => setConfigDraft(p => p ? { ...p, announcement: e.target.value } : p)}
                  rows={3}
                  placeholder="例: 2026/03/10 サーバーメンテナンスを予定しています"
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-sm text-white focus:border-red-500 outline-none"
                />
              </div>

              {/* Max PvP rooms */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">最大PvPルーム数 (現在: {stats.activeRooms})</label>
                <input
                  type="number"
                  value={configDraft.maxPvpRooms}
                  onChange={e => setConfigDraft(p => p ? { ...p, maxPvpRooms: Number(e.target.value) } : p)}
                  className="w-32 bg-gray-800 border border-gray-700 rounded p-2 text-white focus:border-red-500 outline-none"
                />
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="w-full py-3 rounded-lg font-bold text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isSavingConfig ? '保存中...' : '設定を保存'}
              </button>
            </div>

            {/* Current config preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-xs text-gray-500 mb-3 font-mono tracking-widest">CURRENT_CONFIG (saved)</h4>
              <pre className="text-xs text-green-400 font-mono">{JSON.stringify(gameConfig, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameMaster;
