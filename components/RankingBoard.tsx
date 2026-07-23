/**
 * RankingBoard.tsx
 * エビデンスA: 近接ランキング表示（Festinger 1954 社会的比較理論）
 * エビデンスA: 1クエリ+クライアント側フィルタ（Firestore Best Practices - denormalization）
 * - getDocs（一度きり取得）でFirestore読み取りクォータを節約
 * - 形式別ランキング: 1回の50ユーザークエリ → クライアント側でタブ切替（通信量75%削減）
 */
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import type { BattleFormat } from '../types';

interface RankingEntry {
  id: string;
  displayName: string;
  totalWins: number;
  totalMatches: number;
  playerLevel: number;
  photoURL?: string;
  formatWins?: Record<string, number>;
  formatMatches?: Record<string, number>;
  practiceScore?: number;
  practiceSessions?: number;
}

type RankingTab = 'total' | 'practice' | BattleFormat;

const TAB_DEFS: { key: RankingTab; label: string; shortLabel: string }[] = [
  { key: 'total', label: '総合', shortLabel: '総合' },
  { key: 'practice', label: '練習', shortLabel: '練習' },
  { key: 'best_of_3', label: '3本勝負', shortLabel: '3本' },
  { key: 'best_of_5', label: '5本勝負', shortLabel: '5本' },
  { key: 'best_of_7', label: '7本勝負', shortLabel: '7本' },
  { key: 'master_duel', label: 'マスターデュエル', shortLabel: 'MD' },
];

interface RankingBoardProps {
  onClose: () => void;
  db: any;
  currentUserId?: string;
}

const RankingBoard: React.FC<RankingBoardProps> = ({ onClose, db, currentUserId }) => {
  const [allEntries, setAllEntries] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RankingTab>('total');

  useEffect(() => {
    if (!db) { setIsLoading(false); return; }
    // 1クエリで全データ取得 → クライアント側でフィルタ（Firestore reads節約）
    const q = query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(50));
    getDocs(q).then(snap => {
      const list: RankingEntry[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({
          id: doc.id,
          displayName: d.displayName || 'Unknown',
          totalWins: d.totalWins || 0,
          totalMatches: d.totalMatches || 0,
          playerLevel: d.playerLevel || 1,
          photoURL: d.photoURL,
          formatWins: d.formatWins || {},
          formatMatches: d.formatMatches || {},
          practiceScore: d.practiceScore || 0,
          practiceSessions: d.practiceSessions || 0,
        });
      });
      setAllEntries(list);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [db]);

  // タブに応じてソート済みエントリーを返す
  const getEntriesForTab = (tab: RankingTab): RankingEntry[] => {
    if (tab === 'total') {
      return [...allEntries].sort((a, b) => b.totalWins - a.totalWins);
    }
    if (tab === 'practice') {
      return [...allEntries]
        .filter(e => (e.practiceSessions || 0) > 0)
        .sort((a, b) => (b.practiceScore || 0) - (a.practiceScore || 0));
    }
    return [...allEntries]
      .map(e => ({
        ...e,
        _wins: (e.formatWins as Record<string, number>)?.[tab] || 0,
        _matches: (e.formatMatches as Record<string, number>)?.[tab] || 0,
      }))
      .filter(e => e._matches > 0)
      .sort((a, b) => b._wins - a._wins || a._matches - b._matches);
  };

  const entries = getEntriesForTab(activeTab);
  const myRank = entries.findIndex(e => e.id === currentUserId);

  // 近接ランキング: 自分の ±3 エントリー
  const nearEntries: { entry: RankingEntry; rank: number }[] = [];
  if (myRank >= 3) {
    const start = Math.max(0, myRank - 3);
    const end = Math.min(entries.length - 1, myRank + 3);
    for (let i = start; i <= end; i++) {
      nearEntries.push({ entry: entries[i], rank: i });
    }
  }

  const isPracticeTab = activeTab === 'practice';

  const getWins = (entry: RankingEntry): number => {
    if (activeTab === 'total') return entry.totalWins;
    if (isPracticeTab) return entry.practiceScore || 0;
    return (entry.formatWins as Record<string, number>)?.[activeTab] || 0;
  };

  const getMatches = (entry: RankingEntry): number => {
    if (activeTab === 'total') return entry.totalMatches;
    if (isPracticeTab) return entry.practiceSessions || 0;
    return (entry.formatMatches as Record<string, number>)?.[activeTab] || 0;
  };

  const winRate = (wins: number, matches: number) => {
    if (matches === 0) return '--';
    return `${Math.round((wins / matches) * 100)}%`;
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const renderRow = (entry: RankingEntry, idx: number, isNearRow = false) => {
    const isMe = entry.id === currentUserId;
    const wins = getWins(entry);
    const matches = getMatches(entry);
    return (
      <tr
        key={entry.id + (isNearRow ? '_near' : '')}
        className={`transition-colors ${
          isMe
            ? 'bg-red-900/30 border-l-2 border-red-400'
            : isNearRow
            ? 'bg-gray-900/30'
            : idx === 0 ? 'bg-amber-900/10' : idx === 1 ? 'bg-gray-700/5' : idx === 2 ? 'bg-amber-900/5' : ''
        } hover:bg-red-900/10`}
      >
        <td className="p-2 sm:p-3 text-center font-bold text-base sm:text-lg">
          {idx < 3 ? (
            <span>{rankIcon(idx + 1)}</span>
          ) : (
            <span className={`text-xs sm:text-sm font-mono ${isMe ? 'text-red-400 font-black' : 'text-gray-400'}`}>
              {idx + 1}
            </span>
          )}
        </td>
        <td className="p-2 sm:p-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {entry.photoURL ? (
              <img src={entry.photoURL} alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-red-800/50" />
            ) : (
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center text-[10px] sm:text-xs ${isMe ? 'bg-red-800/50 border-red-500 text-red-300' : 'bg-red-900/40 border-red-800/50 text-red-400'}`}>
                {entry.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`font-bold text-xs sm:text-sm ${isMe ? 'text-red-300' : idx < 3 ? 'text-white' : 'text-gray-300'}`}>
              {entry.displayName}
              {isMe && <span className="ml-1 sm:ml-2 text-[9px] sm:text-[10px] text-red-500 font-mono">◄ YOU</span>}
            </span>
          </div>
        </td>
        <td className="p-2 sm:p-3 text-center text-red-400 font-mono text-xs sm:text-sm font-bold">
          {entry.playerLevel}
        </td>
        <td className="p-2 sm:p-3 text-center">
          {isPracticeTab ? (
            <span className="text-amber-400 font-bold text-xs sm:text-sm">{wins}pt</span>
          ) : (
            <>
              <span className="text-amber-400 font-bold text-xs sm:text-sm">{wins}</span>
              <span className="text-gray-500 text-[10px] sm:text-xs"> / {matches}戦</span>
            </>
          )}
        </td>
        <td className="p-2 sm:p-3 text-center text-xs sm:text-sm font-mono text-green-400">
          {isPracticeTab ? `${matches}回` : winRate(wins, matches)}
        </td>
      </tr>
    );
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl hud-panel rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-red-900/50 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-hologram tracking-[0.2em]">RANKING BOARD</h2>
            <p className="text-[10px] sm:text-xs text-red-500 font-mono tracking-widest">GLOBAL_LEADERBOARD</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white border border-gray-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors"
          >
            閉じる
          </button>
        </div>

        {/* Format Tabs */}
        <div className="flex border-b border-red-900/30 flex-shrink-0 overflow-x-auto">
          {TAB_DEFS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.key
                  ? 'text-red-300 border-red-400 bg-red-950/30'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-900/30'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="p-12 text-center text-red-400 font-mono animate-pulse">LOADING...</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              <p>まだランキングデータがありません</p>
              <p className="text-xs mt-2 text-gray-600">
                {activeTab === 'total'
                  ? '対戦に勝利してランキングに入ろう！'
                  : activeTab === 'practice'
                  ? '練習モードで問題を解いてランキングに入ろう！'
                  : `${TAB_DEFS.find(t => t.key === activeTab)?.label}で対戦してランキングに入ろう！`}
              </p>
            </div>
          ) : (
            <>
              {/* 近接ランキング (自分がトップ4以下の場合) */}
              {nearEntries.length > 0 && (
                <div className="border-b border-red-900/30">
                  <div className="px-4 py-1.5 bg-red-950/40 text-[10px] text-red-500 font-mono tracking-widest">
                    ▶ あなたの周辺ランキング
                  </div>
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-gray-800/50">
                      {nearEntries.map(({ entry, rank }) => renderRow(entry, rank, true))}
                    </tbody>
                  </table>
                  <div className="px-4 py-1.5 bg-gray-900/20 text-[10px] text-gray-600 font-mono tracking-widest">
                    ▶ {activeTab === 'total' ? '全体' : TAB_DEFS.find(t => t.key === activeTab)?.label} ランキング (TOP 50)
                  </div>
                </div>
              )}

              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-900/80 text-gray-400 text-[10px] sm:text-xs sticky top-0 z-10">
                  <tr>
                    <th className="p-2 sm:p-3 text-center w-10 sm:w-12">Rank</th>
                    <th className="p-2 sm:p-3">プレイヤー</th>
                    <th className="p-2 sm:p-3 text-center">Lv</th>
                    <th className="p-2 sm:p-3 text-center">{isPracticeTab ? 'スコア' : '勝利'}</th>
                    <th className="p-2 sm:p-3 text-center">{isPracticeTab ? '回数' : '勝率'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {entries.map((entry, idx) => renderRow(entry, idx))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RankingBoard;
