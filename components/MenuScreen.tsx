
import React, { useMemo } from 'react';
import { Category, SubCategoryGroup } from '../types';
import { MATH_CATEGORIES, UNIT_KEYS } from '../constants';
import { ArchiveIcon } from './Icons';
import { getAllMastery } from '../services/learningLogService';
import { useProgressionStore } from '../store/progressionStore';

interface MenuScreenProps {
  onSelectSubTopic: (category: string, subTopic: string) => void;
  onShowRecords: () => void;
  onExit: () => void;
  /** 複数単元+問題数を選んでランダム出題する「ミックス演習」を開始 */
  onMixPractice: () => void;
  /** ロックされた単元(ワールド)。先生が管理画面から設定 */
  lockedUnits?: Set<string>;
  /** 開いているワールド名(親でstateを持つことで、問題画面から戻っても選択が保たれる) */
  selectedWorldName: string | null;
  onSelectWorld: (name: string) => void;
}

/**
 * ワールドマップ — 各単元を「ワールド」として表示する。
 * - 進捗バー: 1問以上正解したサブトピックの割合
 * - 🚩 ワールドクリア(全サブトピックで正解) / 👑 単元マスター(正答率85%以上)
 * - 🔒 先生がまだ開放していないワールドは選べない
 * (個別ランキングは意図的に置かない: 他者比較ではなく自分の進捗を見せる)
 */
const MenuScreen: React.FC<MenuScreenProps> = ({ onSelectSubTopic, onShowRecords, onExit, onMixPractice, lockedUnits, selectedWorldName, onSelectWorld }) => {
  const earnedBadgeIds = useProgressionStore(s => s.earnedBadgeIds);
  const mastery = useMemo(() => getAllMastery(), []);

  const worlds = useMemo(() => MATH_CATEGORIES.map((cat, i) => {
    const subtopics = cat.groups.flatMap(g => g.subtopics);
    const cleared = subtopics.filter(st => (mastery[st]?.corrects ?? 0) > 0).length;
    const key = UNIT_KEYS[cat.name];
    return {
      cat,
      num: i + 1,
      total: subtopics.length,
      cleared,
      isCleared: earnedBadgeIds.has(`world_${key}`) || (cleared === subtopics.length && subtopics.length > 0),
      isMastered: earnedBadgeIds.has(`master_${key}`),
      isLocked: !!lockedUnits?.has(cat.name),
    };
  }), [mastery, earnedBadgeIds, lockedUnits]);

  const firstOpen = worlds.find(w => !w.isLocked) ?? worlds[0];
  const resolvedSelectedName = selectedWorldName ?? firstOpen?.cat.name ?? null;
  const selected: Category | null = worlds.find(w => w.cat.name === resolvedSelectedName)?.cat ?? null;
  const selectedWorld = worlds.find(w => w.cat.name === selected?.name) ?? null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 text-white overflow-y-auto">
      <header className="w-full max-w-5xl text-center mb-4 sm:mb-6 flex-shrink-0">
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-hologram tracking-[0.05em] sm:tracking-[0.1em] mb-2">
          ワールドマップ
        </h1>
        <p className="text-red-400 text-xs sm:text-sm font-bold">ワールドを えらんで 問題に ちょうせん! 🚩=クリア 👑=マスター</p>
      </header>

      <main className="w-full max-w-7xl hud-panel rounded-2xl p-0 shadow-2xl relative overflow-hidden flex flex-col md:flex-row flex-grow md:flex-grow-0 md:h-[65vh] min-h-0">
        <div className="corner-accent lt"></div>
        <div className="corner-accent rb"></div>

        {/* Left Side: World List */}
        <div className="w-full md:w-[30%] bg-slate-950/60 border-b md:border-b-0 md:border-r border-red-500/10 flex md:flex-col p-3 sm:p-4 gap-2 overflow-x-auto md:overflow-x-visible md:overflow-y-auto flex-shrink-0">
          <h2 className="text-xs font-bold text-red-400 mb-1 hidden md:block">ワールドを選択</h2>
          {worlds.map((w) => (
            <button
              key={w.cat.name}
              onClick={() => { if (!w.isLocked) onSelectWorld(w.cat.name); }}
              disabled={w.isLocked}
              className={`p-2.5 sm:p-3 text-left rounded-xl transition-all duration-300 border whitespace-nowrap md:whitespace-normal flex-shrink-0 min-w-[200px] md:min-w-0
                ${w.isLocked
                  ? 'bg-slate-950/40 border-white/5 text-white/25 cursor-not-allowed'
                  : selected?.name === w.cat.name
                  ? 'bg-red-500/20 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                  : 'bg-transparent border-transparent text-red-200/60 hover:text-red-200 hover:bg-slate-900/40'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black tracking-widest opacity-70">WORLD {w.num}</span>
                <span className="text-xs">
                  {w.isLocked ? '🔒' : (
                    <>
                      {w.isCleared && '🚩'}
                      {w.isMastered && '👑'}
                    </>
                  )}
                </span>
              </div>
              <p className="font-bold text-xs sm:text-sm leading-tight mb-1">{w.cat.name}</p>
              {!w.isLocked && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${w.isCleared ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ width: `${(w.cleared / Math.max(w.total, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono opacity-60">{w.cleared}/{w.total}</span>
                </div>
              )}
              {w.isLocked && <p className="text-[9px]">先生が開放するまで おたのしみに!</p>}
            </button>
          ))}
        </div>

        {/* Right Side: Grouped Subtopics */}
        {selected && selectedWorld && !selectedWorld.isLocked ? (
          <div className="flex-grow overflow-y-auto custom-scrollbar p-6 md:p-10 animate-math-fade-in">
            <header className="mb-8 flex justify-between items-end border-b border-red-500/10 pb-4">
                <div>
                   <p className="text-[10px] font-black tracking-[0.3em] text-red-400">WORLD {selectedWorld.num}</p>
                   <h2 className="text-3xl font-bold text-white">
                     {selected.name} {selectedWorld.isCleared && '🚩'}{selectedWorld.isMastered && '👑'}
                   </h2>
                </div>
                <p className="text-xs text-red-500 font-bold hidden sm:block">
                  クリア {selectedWorld.cleared} / {selectedWorld.total}
                </p>
            </header>

            <div className="space-y-10">
                {selected.groups.map((group: SubCategoryGroup) => (
                    <section key={group.name} className="animate-math-fade-in">
                        <div className="flex items-center gap-4 mb-5">
                            <h3 className="text-sm font-bold text-red-400 whitespace-nowrap">{group.name}</h3>
                            <div className="h-[1px] flex-grow bg-gradient-to-r from-red-500/20 to-transparent"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.subtopics.map((subTopic: string) => {
                                const done = (mastery[subTopic]?.corrects ?? 0) > 0;
                                return (
                                  <button
                                      key={subTopic}
                                      onClick={() => onSelectSubTopic(selected.name, subTopic)}
                                      className="w-full bg-slate-950/40 border border-red-500/10 text-red-100/90 p-4 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-slate-950 hover:border-white transition-all text-left relative overflow-hidden group"
                                  >
                                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${done ? 'bg-emerald-400/60' : 'bg-red-500/20'} group-hover:bg-white transition-colors`}></div>
                                      <span className="relative z-10 flex items-center justify-between gap-2">
                                        <span>{subTopic}</span>
                                        {done && <span className="text-emerald-400 group-hover:text-slate-950 text-xs flex-shrink-0">✔</span>}
                                      </span>
                                  </button>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center border-2 border-dashed border-red-900/20 rounded-xl m-6">
             <p className="text-red-700 animate-pulse text-sm">ワールドを選択してください</p>
          </div>
        )}
      </main>

      {/* ミックス演習: 複数単元を混ぜて出題(インターリーブ)する主要モードなので大きく目立たせる */}
      <button
        onClick={onMixPractice}
        className="mt-6 w-full max-w-5xl flex-shrink-0 py-5 sm:py-6 rounded-2xl font-black tracking-[0.15em] text-lg sm:text-xl text-white
          bg-gradient-to-r from-red-700/80 via-red-600/80 to-orange-600/80 border-2 border-red-400/60
          shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:shadow-[0_0_50px_rgba(239,68,68,0.55)] hover:border-red-300 transition-all"
      >
        ミックス演習
        <span className="block text-[11px] sm:text-xs font-bold tracking-normal text-red-100/80 mt-1">
          単元と問題数を選んで まぜて練習 — 力だめしに おすすめ!
        </span>
      </button>

      <footer className="mt-5 flex items-center justify-center gap-6 w-full max-w-5xl flex-shrink-0">
         <button
            onClick={onShowRecords}
            className="btn-tactical px-8 py-3 rounded-lg flex items-center gap-3 font-bold text-sm text-red-300 border-red-500/20"
          >
            <ArchiveIcon className="w-5 h-5" />
            学習記録
          </button>
          <button
            onClick={onExit}
            className="btn-tactical px-10 py-3 rounded-lg font-bold text-white bg-blue-700/20 border-red-500/40 hover:bg-blue-600 text-sm"
          >
            メニューに戻る
          </button>
      </footer>
    </div>
  );
};

export default MenuScreen;
