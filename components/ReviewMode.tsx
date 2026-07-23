import React, { useMemo, useState } from 'react';
import type { Problem, SessionStats } from '../types';
import { CARD_DEFINITIONS } from '../constants';
import {
  getDueItems, getTotalSrsCount, markSrsCorrect, type SrsItem,
} from '../services/spacedRepetitionService';
import { shuffleDeck } from '../utils/shuffle';
import ProblemScreen from './ProblemScreen';

interface ReviewModeProps {
  /** セッションで獲得したMPを渡して終了する */
  onExit: (earnedScore: number) => void;
}

interface ReviewEntry {
  problem: Problem & { category?: string };
  srsItem: SrsItem;
}

/**
 * 復習モード — 間隔反復(SRS)キューのUI
 *
 * エビデンスA: 分散学習は集中学習より定着率が高い（Cepeda et al. 2006, 184研究のメタ分析）
 * エビデンスA: 想起練習（テスト効果）は再読より効果的（Roediger & Butler 2011）
 *
 * これまでSRSエンジン（spacedRepetitionService）は不正解の蓄積のみで、
 * 期日が来た問題を解き直すUIが存在しなかった。本コンポーネントが
 * 「今日の復習」として期日到来分を出題し、正解で間隔を延長する。
 */
const ReviewMode: React.FC<ReviewModeProps> = ({ onExit }) => {
  const [inSession, setInSession] = useState(false);

  // マウント時点の期日到来アイテムを問題に解決（参照を安定させ ProblemScreen の再読込を防ぐ）
  const entries = useMemo<ReviewEntry[]>(() => {
    const due = getDueItems();
    const resolved: ReviewEntry[] = [];
    for (const item of due) {
      // 出題元の問題を単元+正解で特定
      const exact = CARD_DEFINITIONS.find(
        c => c.category === item.category && c.problem.answer === item.answer
      );
      if (exact) {
        resolved.push({ problem: { ...exact.problem, category: exact.category }, srsItem: item });
        continue;
      }
      // 見つからない場合（データ更新等）は同単元からランダムに代替出題
      const sameTopic = CARD_DEFINITIONS.filter(c => c.category === item.category);
      if (sameTopic.length > 0) {
        const pick = sameTopic[Math.floor(Math.random() * sameTopic.length)];
        resolved.push({ problem: { ...pick.problem, category: pick.category }, srsItem: item });
      }
    }
    return shuffleDeck(resolved);
  }, []);

  const problems = useMemo<Problem[]>(() => entries.map(e => e.problem), [entries]);

  const handleProblemResult = (problem: Problem, correct: boolean) => {
    if (!correct) return; // 不正解時の間隔リセットは ProblemScreen 内の addIncorrectToSrs が行う
    const entry = entries.find(e => e.problem === problem);
    if (entry) markSrsCorrect(entry.srsItem.category, entry.srsItem.answer);
  };

  if (inSession && problems.length > 0) {
    return (
      <ProblemScreen
        category="復習"
        subTopic="今日の復習"
        problemsOverride={problems}
        onProblemResult={handleProblemResult}
        onBack={(stats: SessionStats) => onExit(stats.totalScore)}
        onHome={() => onExit(0)}
      />
    );
  }

  const totalQueued = getTotalSrsCount();

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900/80 border border-red-800/40 rounded-2xl p-6 sm:p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">🔁 復習モード</h1>
        <p className="text-xs text-red-300/60 mb-6">
          忘れかけた頃に解き直すと記憶が長持ちします（間隔反復学習）
        </p>

        {entries.length === 0 ? (
          <div className="py-6">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-white font-bold mb-1">今日の復習はありません</p>
            <p className="text-xs text-gray-400">
              {totalQueued > 0
                ? `復習待ちの問題が ${totalQueued} 問あります。期日が来たらここに表示されます。`
                : '問題を間違えると、ここに復習として登録されます。'}
            </p>
          </div>
        ) : (
          <>
            <div className="text-left bg-black/30 rounded-xl p-4 mb-6 max-h-60 overflow-y-auto">
              <p className="text-xs text-red-400 font-bold mb-2">今日復習する問題（{entries.length}問）</p>
              <ul className="space-y-1.5">
                {entries.map((e, i) => (
                  <li key={i} className="text-xs text-gray-300 flex justify-between gap-2">
                    <span className="truncate">{e.srsItem.category}</span>
                    <span className="text-gray-500 flex-shrink-0">
                      {e.srsItem.consecutiveCorrect > 0
                        ? `連続${e.srsItem.consecutiveCorrect}回正解`
                        : '要復習'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setInSession(true)}
              className="w-full btn-tactical py-4 rounded-xl text-lg font-bold tracking-widest mb-3"
            >
              復習を始める（{entries.length}問）
            </button>
          </>
        )}

        <button
          onClick={() => onExit(0)}
          className="text-sm text-gray-400 hover:text-white transition-colors mt-2"
        >
          メニューに戻る
        </button>
      </div>
    </div>
  );
};

export default ReviewMode;
