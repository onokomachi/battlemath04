import React, { useMemo, useState } from 'react';
import { MATH_CATEGORIES, BADGE_DEFS } from '../constants';
import { useProgressionStore } from '../store/progressionStore';
import {
  getTodayLogs, getAllMastery, getDailyGoal, setDailyGoal,
  getTestRecords, getTestBests,
} from '../services/learningLogService';
import {
  BACKGROUND_DEFS, badgeRatio, isBackgroundUnlocked,
  type BackgroundId,
} from '../utils/backgroundUnlock';
import FractionText from './FractionText';
import { BackIcon } from './Icons';

/**
 * がくしゅうのきろく — wari-hissann3 の LogView / GoalRing / バッジ画面を移植。
 *  - きょうの正解数(デイリー目標リング)と きょうやった問題の一覧(即時確認)
 *  - サブトピック別の習熟バー(正答率+5連続ノーミスで熟達MAX)
 *  - バッジ一覧と獲得率 → 特別な背景の解放・装備
 *  - 本番テストの履歴と自己ベスト
 */

interface LearningLogScreenProps {
  onExit: () => void;
  equippedBackground: BackgroundId;
  onEquipBackground: (id: BackgroundId) => void;
}

const MODE_LABEL: Record<string, string> = {
  practice: '📖 練習',
  battle: '⚔ バトル',
  speed: '⚡ スピード',
  review: '🔁 復習',
  test: '📝 テスト',
};

const GoalRing: React.FC<{ value: number; goal: number }> = ({ value, goal }) => {
  const pct = Math.min(value / Math.max(goal, 1), 1);
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 110 110" className="w-28 h-28">
      <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
      <circle
        cx="55" cy="55" r={R} fill="none"
        stroke={pct >= 1 ? '#34d399' : '#f87171'}
        strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${C * pct} ${C}`}
        transform="rotate(-90 55 55)"
      />
      <text x="55" y="52" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">{value}</text>
      <text x="55" y="70" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">/ {goal}問</text>
    </svg>
  );
};

const LearningLogScreen: React.FC<LearningLogScreenProps> = ({ onExit, equippedBackground, onEquipBackground }) => {
  const earnedBadgeIds = useProgressionStore(s => s.earnedBadgeIds);
  const [goal, setGoalState] = useState(getDailyGoal());
  const [tab, setTab] = useState<'today' | 'mastery' | 'badges' | 'tests'>('today');

  const todayLogs = useMemo(() => getTodayLogs(), []);
  const todayCorrect = todayLogs.filter(l => l.correct).length;
  const mastery = useMemo(() => getAllMastery(), []);
  const testRecords = useMemo(() => getTestRecords(), []);
  const bests = useMemo(() => getTestBests(), []);
  const ratio = badgeRatio(earnedBadgeIds);

  const changeGoal = (n: number) => {
    setDailyGoal(n);
    setGoalState(n);
  };

  return (
    <div className="h-[100dvh] w-full flex items-start justify-center p-3 sm:p-6 text-white overflow-y-auto">
      <div className="w-full max-w-4xl my-2">
        <header className="flex justify-between items-center mb-4">
          <h1 className="text-2xl sm:text-3xl font-black text-red-300">📒 がくしゅうのきろく</h1>
          <button onClick={onExit} className="btn-tactical px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold text-sm text-red-400">
            <BackIcon className="w-4 h-4" /> もどる
          </button>
        </header>

        <div className="flex gap-1.5 mb-4 flex-wrap">
          {([
            ['today', 'きょう'],
            ['mastery', 'しゅうじゅく度'],
            ['badges', 'バッジと背景'],
            ['tests', 'テストのきろく'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all
                ${tab === id ? 'border-red-400 bg-red-900/40 text-red-200' : 'border-red-900/30 bg-slate-900/50 text-white/60 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ============ きょう ============ */}
        {tab === 'today' && (
          <div className="space-y-4">
            <div className="hud-panel rounded-2xl p-4 sm:p-6 flex items-center gap-5">
              <GoalRing value={todayCorrect} goal={goal} />
              <div className="flex-1">
                <p className="text-lg font-black text-white mb-1">
                  {todayCorrect >= goal
                    ? '🎉 きょうの目標たっせい! すばらしい!'
                    : `きょうは あと ${goal - todayCorrect}問で 目標たっせい!`}
                </p>
                <p className="text-xs text-white/50 mb-2">きょう といた問題: {todayLogs.length}問(正解 {todayCorrect}問)</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400 font-bold">1日の目標:</span>
                  {[5, 10, 15, 20, 30].map(n => (
                    <button
                      key={n}
                      onClick={() => changeGoal(n)}
                      className={`px-2.5 py-1 rounded text-xs font-bold border ${goal === n ? 'border-amber-400 bg-amber-900/40 text-amber-300' : 'border-white/10 text-white/40 hover:text-white'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hud-panel rounded-2xl p-4">
              <h2 className="font-bold text-red-300 text-sm mb-3">きょう やった問題</h2>
              {todayLogs.length === 0 ? (
                <p className="text-white/40 text-sm py-6 text-center">まだ きょうの きろくが ないよ。問題を といてみよう!</p>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                  {todayLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-2 bg-slate-950/50 rounded-lg px-3 py-2 text-xs sm:text-sm">
                      <span className={`text-base ${log.correct ? 'text-emerald-400' : 'text-red-400'}`}>{log.correct ? '○' : '×'}</span>
                      <span className="text-white/30 font-mono text-[10px] w-10 flex-shrink-0">
                        {new Date(log.ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-amber-400/80 w-16 flex-shrink-0">{MODE_LABEL[log.mode] || log.mode}</span>
                      <span className="flex-1 text-white/80 truncate"><FractionText text={log.question} /></span>
                      <span className="text-white/50 flex-shrink-0">
                        <FractionText text={log.userAnswer || '未入力'} auto />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ しゅうじゅく度 ============ */}
        {tab === 'mastery' && (
          <div className="space-y-4">
            {MATH_CATEGORIES.map(cat => (
              <div key={cat.name} className="hud-panel rounded-2xl p-4">
                <h2 className="font-black text-red-300 mb-3">{cat.name}</h2>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {cat.groups.flatMap(g => g.subtopics).map(st => {
                    const m = mastery[st];
                    const rate = m && m.attempts > 0 ? m.corrects / m.attempts : 0;
                    const streakPct = Math.min((m?.perfectStreak ?? 0) / 5, 1);
                    return (
                      <div key={st}>
                        <div className="flex justify-between items-center mb-0.5">
                          <p className="text-xs text-white/80 truncate">
                            {st} {m?.mastered && <span title="熟達MAX">👑</span>}
                          </p>
                          <p className="text-[10px] text-white/40 font-mono">
                            {m ? `${m.corrects}/${m.attempts}` : '未挑戦'}
                          </p>
                        </div>
                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full ${rate >= 0.85 ? 'bg-emerald-400' : rate >= 0.6 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${rate * 100}%` }}
                          />
                        </div>
                        <div className="h-1 mt-0.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-400" style={{ width: `${streakPct * 100}%` }} title="連続ノーミス(5でMAX)" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-white/30 text-center">上のバー: 正答率 / 下のバー: 連続ノーミス(5問でしゅうじゅくMAX 👑)</p>
          </div>
        )}

        {/* ============ バッジと背景 ============ */}
        {tab === 'badges' && (
          <div className="space-y-4">
            <div className="hud-panel rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-red-300 text-sm">バッジ({BADGE_DEFS.filter(b => earnedBadgeIds.has(b.id)).length} / {BADGE_DEFS.length})</h2>
                <p className="text-xs font-black text-amber-400">獲得率 {Math.round(ratio * 100)}%</p>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-gradient-to-r from-amber-500 to-red-400" style={{ width: `${ratio * 100}%` }} />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {BADGE_DEFS.map(b => {
                  const earned = earnedBadgeIds.has(b.id);
                  return (
                    <div
                      key={b.id}
                      title={`${b.title}: ${b.description}`}
                      className={`rounded-xl p-2 text-center border ${earned ? 'border-amber-500/40 bg-amber-900/20' : 'border-white/5 bg-slate-950/50 opacity-40 grayscale'}`}
                    >
                      <p className="text-xl">{b.icon}</p>
                      <p className="text-[9px] font-bold text-white/80 truncate">{b.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hud-panel rounded-2xl p-4">
              <h2 className="font-bold text-red-300 text-sm mb-1">特別な背景</h2>
              <p className="text-[10px] text-white/40 mb-3">
                バッジを あつめると 特別な背景が つかえるように なるよ。
                えらぶと この画面の うしろで すぐに 背景が 動きだすよ(プレビュー)。
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {BACKGROUND_DEFS.map(bg => {
                  const unlocked = isBackgroundUnlocked(bg.id, ratio);
                  const equipped = equippedBackground === bg.id;
                  return (
                    <button
                      key={bg.id}
                      disabled={!unlocked}
                      onClick={() => onEquipBackground(bg.id)}
                      className={`text-left p-3 rounded-xl border-2 transition-all
                        ${equipped ? 'border-amber-400 bg-amber-900/30' : unlocked ? 'border-red-900/40 bg-slate-900/60 hover:border-red-500/60' : 'border-white/5 bg-slate-950/60 opacity-40'}`}
                    >
                      <p className="font-bold text-sm text-white">{bg.icon} {bg.name} {equipped && <span className="text-amber-400 text-[10px]">✓ 使用中</span>}</p>
                      <p className="text-[10px] text-white/50">{unlocked ? bg.desc : `🔒 ${bg.desc}`}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============ テストのきろく ============ */}
        {tab === 'tests' && (
          <div className="space-y-4">
            <div className="hud-panel rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
              {([
                ['表ベスト', `${bests.bestOmote}点`, `満点 ${bests.perfectCounts.omote}回`],
                ['裏ベスト', `${bests.bestUra}点`, `満点 ${bests.perfectCounts.ura}回`],
                ['両面ベスト', `${bests.bestTotal}点`, `満点 ${bests.perfectCounts.total}回`],
              ] as const).map(([label, v, sub]) => (
                <div key={label}>
                  <p className="text-[10px] text-red-400 font-bold">{label}</p>
                  <p className="text-2xl font-black text-amber-400">{v}</p>
                  <p className="text-[10px] text-white/40">{sub}</p>
                </div>
              ))}
            </div>
            {testRecords.length === 0 ? (
              <div className="hud-panel rounded-2xl p-8 text-center text-white/40 text-sm">
                まだ テストの きろくが ないよ。「本番テスト」に ちょうせんしてみよう!
              </div>
            ) : (
              testRecords.slice(0, 10).map(rec => <TestRecordCard key={rec.id} rec={rec} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TestRecordCard: React.FC<{ rec: ReturnType<typeof getTestRecords>[number] }> = ({ rec }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="hud-panel rounded-2xl p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center text-left">
        <div>
          <p className="text-xs text-white/40">{new Date(rec.ts).toLocaleString('ja-JP')}</p>
          <p className="font-bold text-red-200">{rec.setName ? `${rec.setName} ` : ''}{rec.mode}のテスト</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-amber-400">{rec.total} <span className="text-xs text-white/40">/ {rec.totalMax}点</span></p>
          <p className="text-[10px] text-white/40">{open ? '▲ とじる' : '▼ くわしく見る'}</p>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-1.5 border-t border-red-500/10 pt-3">
          {rec.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs bg-black/30 rounded-lg p-2">
              <span className={s.correct ? 'text-emerald-400' : 'text-red-400'}>{s.correct ? '○' : '×'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-400/70">{s.title}({s.points}点)</p>
                <p className="text-white/80"><FractionText text={s.q} /></p>
                {!s.correct && (
                  <p className="text-white/50 mt-0.5">
                    あなた: <FractionText text={s.user || '未入力'} auto /> / 正解: <FractionText text={s.a} auto />
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LearningLogScreen;
