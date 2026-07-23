import React, { useState, useMemo } from 'react';
import type { BattleFormat, SubCategoryGroup } from '../types';
import { MATH_CATEGORIES } from '../constants';
import { BackIcon } from './Icons';

interface SpeedDuelSetupProps {
  onStart: (subtopics: string[], format: BattleFormat, mode: 'cpu' | 'pvp') => void;
  onBack: () => void;
  isLoggedIn: boolean;
  /** ロックされた単元(ワールド)。出題対象から除外する */
  lockedUnits?: Set<string>;
}

const SPEED_FORMATS: { key: BattleFormat; label: string; desc: string; rounds: number }[] = [
  { key: 'best_of_3', label: '3本勝負', desc: '先に2問正解で勝利', rounds: 3 },
  { key: 'best_of_5', label: '5本勝負', desc: '先に3問正解で勝利', rounds: 5 },
  { key: 'best_of_7', label: '7本勝負', desc: '先に4問正解で勝利', rounds: 7 },
  { key: 'master_duel', label: 'マスターデュエル', desc: '10問勝負・最多正解で決着', rounds: 10 },
];

const SpeedDuelSetup: React.FC<SpeedDuelSetupProps> = ({ onStart, onBack, isLoggedIn, lockedUnits }) => {
  // ロックされた単元は一覧・既定選択から除外する
  const openCategories = useMemo(
    () => MATH_CATEGORIES.filter(c => !lockedUnits?.has(c.name)),
    [lockedUnits],
  );
  const allSubtopics = useMemo(
    () => openCategories.flatMap(c => c.groups.flatMap(g => g.subtopics)),
    [openCategories],
  );
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set(allSubtopics));
  const [format, setFormat] = useState<BattleFormat>('best_of_5');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Helper: get all subtopics for a main category
  const getSubtopicsForCategory = (catName: string): string[] =>
    openCategories.find(c => c.name === catName)?.groups.flatMap(g => g.subtopics) || [];

  // Helper: get all subtopics for a group within a category
  const getSubtopicsForGroup = (catName: string, groupName: string): string[] =>
    openCategories.find(c => c.name === catName)?.groups.find(g => g.name === groupName)?.subtopics || [];

  // Check state helpers
  const isCategoryAllSelected = (catName: string) => {
    const subs = getSubtopicsForCategory(catName);
    return subs.length > 0 && subs.every(s => selectedSubtopics.has(s));
  };
  const isCategoryPartial = (catName: string) => {
    const subs = getSubtopicsForCategory(catName);
    return subs.some(s => selectedSubtopics.has(s)) && !subs.every(s => selectedSubtopics.has(s));
  };
  const isGroupAllSelected = (catName: string, groupName: string) => {
    const subs = getSubtopicsForGroup(catName, groupName);
    return subs.length > 0 && subs.every(s => selectedSubtopics.has(s));
  };
  const isGroupPartial = (catName: string, groupName: string) => {
    const subs = getSubtopicsForGroup(catName, groupName);
    return subs.some(s => selectedSubtopics.has(s)) && !subs.every(s => selectedSubtopics.has(s));
  };

  // Toggle handlers
  const toggleSubtopic = (sub: string) => {
    setSelectedSubtopics(prev => {
      const next = new Set(prev);
      if (next.has(sub)) {
        if (next.size > 1) next.delete(sub);
      } else {
        next.add(sub);
      }
      return next;
    });
  };

  const toggleGroup = (catName: string, groupName: string) => {
    const subs = getSubtopicsForGroup(catName, groupName);
    setSelectedSubtopics(prev => {
      const next = new Set(prev);
      const allSelected = subs.every(s => next.has(s));
      if (allSelected) {
        // Deselect all in group (but keep at least 1 total)
        subs.forEach(s => next.delete(s));
        if (next.size === 0 && subs.length > 0) next.add(subs[0]);
      } else {
        subs.forEach(s => next.add(s));
      }
      return next;
    });
  };

  const toggleCategory = (catName: string) => {
    const subs = getSubtopicsForCategory(catName);
    setSelectedSubtopics(prev => {
      const next = new Set(prev);
      const allSelected = subs.every(s => next.has(s));
      if (allSelected) {
        subs.forEach(s => next.delete(s));
        if (next.size === 0 && subs.length > 0) next.add(subs[0]);
      } else {
        subs.forEach(s => next.add(s));
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSubtopics.size === allSubtopics.length) {
      setSelectedSubtopics(new Set([allSubtopics[0]]));
    } else {
      setSelectedSubtopics(new Set(allSubtopics));
    }
  };

  const selectedCount = selectedSubtopics.size;
  const totalCount = allSubtopics.length;

  const handleStart = (mode: 'cpu' | 'pvp') => {
    onStart(Array.from(selectedSubtopics), format, mode);
  };

  return (
    <div className="w-full h-full flex flex-col items-center p-4 text-white relative overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-radial from-orange-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-2">
            <BackIcon className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-wider flex items-center gap-3">
              <span className="text-orange-400">⚡</span>
              <span className="text-hologram">SPEED DUEL</span>
            </h2>
            <p className="text-xs text-orange-400 font-bold mt-1">
              スピードデュエル — デッキ不要・早押し勝負
            </p>
          </div>
        </div>

        {/* Category Selection - Hierarchical */}
        <div className="hud-panel rounded-xl p-4 sm:p-5 mb-6 border border-orange-800/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-orange-400 tracking-widest uppercase">出題範囲</h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500">{selectedCount}/{totalCount} 単元</span>
              <button
                onClick={toggleAll}
                className="text-[10px] text-gray-400 border border-gray-700 px-3 py-1 rounded hover:text-white transition-colors"
              >
                {selectedCount === totalCount ? '全解除' : '全選択'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {openCategories.map(cat => {
              const isExpanded = expandedCategory === cat.name;
              const allSelected = isCategoryAllSelected(cat.name);
              const partial = isCategoryPartial(cat.name);
              const catSubCount = getSubtopicsForCategory(cat.name).length;
              const catSelectedCount = getSubtopicsForCategory(cat.name).filter(s => selectedSubtopics.has(s)).length;

              return (
                <div key={cat.name} className="rounded-lg border border-orange-900/20 overflow-hidden">
                  {/* Main Category Header */}
                  <div className="flex items-center gap-2 bg-slate-900/60">
                    <button
                      onClick={() => toggleCategory(cat.name)}
                      className={`p-2.5 pl-3 text-sm font-bold transition-colors ${
                        allSelected ? 'text-orange-300' : partial ? 'text-orange-400/70' : 'text-gray-500'
                      }`}
                      title={allSelected ? '全解除' : '全選択'}
                    >
                      {allSelected ? '☑' : partial ? '▣' : '☐'}
                    </button>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                      className="flex-grow flex items-center justify-between p-2.5 pr-3 text-left"
                    >
                      <span className={`text-sm font-bold ${allSelected || partial ? 'text-orange-200' : 'text-gray-400'}`}>
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{catSelectedCount}/{catSubCount}</span>
                        <span className={`text-xs text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </button>
                  </div>

                  {/* Expanded: Groups & Subtopics */}
                  {isExpanded && (
                    <div className="bg-slate-950/40 border-t border-orange-900/10 p-3 space-y-3 animate-math-fade-in">
                      {cat.groups.map((group: SubCategoryGroup) => {
                        const groupAll = isGroupAllSelected(cat.name, group.name);
                        const groupPartial = isGroupPartial(cat.name, group.name);
                        return (
                          <div key={group.name}>
                            {/* Group Header */}
                            <button
                              onClick={() => toggleGroup(cat.name, group.name)}
                              className="flex items-center gap-2 mb-2 w-full text-left"
                            >
                              <span className={`text-xs ${groupAll ? 'text-orange-300' : groupPartial ? 'text-orange-400/70' : 'text-gray-600'}`}>
                                {groupAll ? '☑' : groupPartial ? '▣' : '☐'}
                              </span>
                              <span className={`text-xs font-bold ${groupAll || groupPartial ? 'text-orange-400' : 'text-gray-500'}`}>
                                {group.name}
                              </span>
                              <div className="h-[1px] flex-grow bg-gradient-to-r from-orange-500/10 to-transparent" />
                            </button>

                            {/* Subtopics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-4">
                              {group.subtopics.map(sub => {
                                const isSelected = selectedSubtopics.has(sub);
                                return (
                                  <button
                                    key={sub}
                                    onClick={() => toggleSubtopic(sub)}
                                    className={`px-2.5 py-1.5 rounded text-[11px] font-medium text-left transition-all truncate ${
                                      isSelected
                                        ? 'bg-orange-900/30 text-orange-200 border border-orange-500/30'
                                        : 'bg-slate-900/30 text-gray-600 border border-slate-700/20 hover:border-gray-600 hover:text-gray-400'
                                    }`}
                                    title={sub}
                                  >
                                    {sub}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Format Selection */}
        <div className="hud-panel rounded-xl p-4 sm:p-5 mb-6 border border-orange-800/30">
          <h3 className="text-sm font-bold text-orange-400 tracking-widest uppercase mb-4">対戦形式</h3>
          <div className="grid grid-cols-2 gap-3">
            {SPEED_FORMATS.map(f => (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  format === f.key
                    ? 'border-orange-500/50 bg-orange-900/20'
                    : 'border-slate-700/30 bg-slate-900/30 hover:border-gray-600'
                }`}
              >
                <div className={`text-sm font-bold ${format === f.key ? 'text-orange-300' : 'text-gray-400'}`}>
                  {f.label}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="hud-panel rounded-xl p-4 mb-6 border border-slate-700/30">
          <h3 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">ルール</h3>
          <ul className="space-y-1 text-[11px] text-gray-400">
            <li>• 同じ問題が両プレイヤーに同時出題</li>
            <li>• 先に正解した方がラウンド勝利</li>
            <li>• 不正解の場合、相手に解答権が移る</li>
            <li>• デッキ構築は不要（カード不要）</li>
          </ul>
        </div>

        {/* Start Buttons */}
        <div className="grid grid-cols-2 gap-4 pb-4">
          <button
            onClick={() => handleStart('cpu')}
            disabled={selectedCount === 0}
            className="btn-tactical py-5 rounded-2xl font-bold tracking-[0.15em] text-base group relative overflow-hidden disabled:opacity-40"
          >
            <div className="absolute -right-4 -bottom-4 text-5xl opacity-[0.08] group-hover:opacity-[0.15] transition-all">🤖</div>
            <div className="text-lg font-black">CPU対戦</div>
            <div className="text-[10px] text-red-400 opacity-70 mt-1">コンピュータと早押し勝負</div>
          </button>
          <button
            onClick={() => handleStart('pvp')}
            disabled={!isLoggedIn || selectedCount === 0}
            className="btn-tactical py-5 rounded-2xl font-bold tracking-[0.15em] text-base group relative overflow-hidden disabled:opacity-40"
          >
            <div className="absolute -right-4 -bottom-4 text-5xl opacity-[0.08] group-hover:opacity-[0.15] transition-all">⚔</div>
            <div className="text-lg font-black">プレイヤー対戦</div>
            <div className="text-[10px] text-red-400 opacity-70 mt-1">
              {isLoggedIn ? 'オンラインで早押し勝負' : 'ログインが必要です'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeedDuelSetup;
