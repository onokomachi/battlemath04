/**
 * QuestPanel.tsx - デイリー/ウィークリークエスト + ログインストリーク表示
 * エビデンスA: 目標設定理論（Locke & Latham 1990） — 3層クエスト構造
 * エビデンスC: 損失回避 + 進捗可視化（ログインストリーク）
 */
import React from 'react';
import { DAILY_QUEST_DEFS, WEEKLY_QUEST_DEFS } from '../constants';
import type { DailyQuestDef } from '../types';

interface QuestPanelProps {
  loginStreak: number;
  dailyProgress: Record<string, number>;
  dailyCompleted: Record<string, boolean>;
  weeklyProgress: Record<string, number>;
  weeklyCompleted: Record<string, boolean>;
  onClose: () => void;
}

const QuestItem: React.FC<{
  def: DailyQuestDef;
  progress: number;
  completed: boolean;
}> = ({ def, progress, completed }) => {
  const pct = Math.min(100, (progress / def.target) * 100);
  return (
    <div className={`p-3 rounded-xl border transition-colors ${
      completed
        ? 'border-red-700/60 bg-red-900/20'
        : 'border-gray-700/50 bg-gray-800/40'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{def.icon}</span>
          <span className="text-sm font-bold text-white">{def.title}</span>
          {completed && <span className="text-xs text-red-400 font-mono">✓ 完了</span>}
        </div>
        <span className="text-xs text-amber-400 font-mono">+{def.reward.mp}MP</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{def.description}</p>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-red-600 to-red-400 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-500 mt-1">
        {Math.min(progress, def.target)}/{def.target}
      </div>
    </div>
  );
};

const QuestPanel: React.FC<QuestPanelProps> = ({
  loginStreak, dailyProgress, dailyCompleted, weeklyProgress, weeklyCompleted, onClose
}) => {
  const completedToday = DAILY_QUEST_DEFS.filter(d => dailyCompleted[d.id]).length;
  const completedWeek = WEEKLY_QUEST_DEFS.filter(d => weeklyCompleted[d.id]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-gray-950 border border-red-800/40 rounded-2xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-lg font-bold text-red-300 tracking-widest">QUEST_LOG</h2>
            <p className="text-xs text-gray-500 font-mono">
              TODAY: {completedToday}/{DAILY_QUEST_DEFS.length} &nbsp;|&nbsp; WEEK: {completedWeek}/{WEEKLY_QUEST_DEFS.length}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Login Streak — エビデンスC: 損失回避バイアス */}
        <div className="mb-5 p-4 bg-orange-900/20 border border-orange-700/40 rounded-xl flex items-center gap-4">
          <span className="text-4xl">🔥</span>
          <div>
            <div className="text-2xl font-bold text-orange-400">{loginStreak}日連続</div>
            <div className="text-xs text-gray-400">
              {loginStreak === 0 ? '今日ログインしてストリーク開始！' :
               loginStreak < 3 ? `あと${3 - loginStreak}日で🔥バッジ獲得！` :
               loginStreak < 7 ? `あと${7 - loginStreak}日で🔥🔥バッジ獲得！` :
               '素晴らしい継続力！明日も続けよう'}
            </div>
          </div>
        </div>

        {/* Daily Quests */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold text-red-500 tracking-widest">TODAY'S QUESTS</h3>
            <span className="text-xs text-gray-600">（毎日リセット）</span>
          </div>
          <div className="space-y-2">
            {DAILY_QUEST_DEFS.map(def => (
              <QuestItem
                key={def.id}
                def={def}
                progress={dailyProgress[def.id] || 0}
                completed={dailyCompleted[def.id] || false}
              />
            ))}
          </div>
        </div>

        {/* Weekly Quests */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold text-purple-400 tracking-widest">WEEKLY QUESTS</h3>
            <span className="text-xs text-gray-600">（月曜リセット）</span>
          </div>
          <div className="space-y-2">
            {WEEKLY_QUEST_DEFS.map(def => (
              <QuestItem
                key={def.id}
                def={def}
                progress={weeklyProgress[def.id] || 0}
                completed={weeklyCompleted[def.id] || false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestPanel;
