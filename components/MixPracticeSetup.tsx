import React, { useState, useMemo } from 'react';
import type { SubCategoryGroup } from '../types';
import { MATH_CATEGORIES } from '../constants';
import { BackIcon } from './Icons';

interface MixPracticeSetupProps {
  onStart: (subtopics: string[], count: number) => void;
  onBack: () => void;
  /** ロックされた単元(ワールド)。出題対象から除外する */
  lockedUnits?: Set<string>;
}

const COUNT_PRESETS: { count: number; label: string; desc: string }[] = [
  { count: 5, label: '5問', desc: 'サクッと1分' },
  { count: 10, label: '10問', desc: 'ちょうどいい量' },
  { count: 15, label: '15問', desc: 'しっかり練習' },
  { count: 20, label: '20問', desc: 'がっつり演習' },
];

/**
 * ミックス演習セットアップ — 複数の単元を選び、まとめてランダム出題する。
 *
 * エビデンスA: インターリーブ効果 (Rohrer & Taylor, 2007; Rohrer, Dedrick & Stershic, 2015)
 *   類題を混ぜて出題すると、解法を毎回自分で判別する負荷が生まれ、
 *   同じ手順を連続でこなす「ブロック練習」より長期定着率が高い。
 */
const MixPracticeSetup: React.FC<MixPracticeSetupProps> = ({ onStart, onBack, lockedUnits }) => {
  const openCategories = useMemo(
    () => MATH_CATEGORIES.filter(c => !lockedUnits?.has(c.name)),
    [lockedUnits],
  );
  const allSubtopics = useMemo(
    () => openCategories.flatMap(c => c.groups.flatMap(g => g.subtopics)),
    [openCategories],
  );
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set(allSubtopics));
  const [count, setCount] = useState<number>(10);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const getSubtopicsForCategory = (catName: string): string[] =>
    openCategories.find(c => c.name === catName)?.groups.flatMap(g => g.subtopics) || [];

  const getSubtopicsForGroup = (catName: string, groupName: string): string[] =>
    openCategories.find(c => c.name === catName)?.groups.find(g => g.name === groupName)?.subtopics || [];

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

  const handleStart = () => {
    onStart(Array.from(selectedSubtopics), count);
  };

  return (
    <div className="w-full h-full flex flex-col items-center p-4 text-white relative overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-radial from-red-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-2">
            <BackIcon className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-wider">
              <span className="text-hologram">ミックス演習</span>
            </h2>
            <p className="text-xs text-red-400 font-bold mt-1">
              単元と問題数を選んで、まぜて練習しよう
            </p>
          </div>
        </div>

        {/* Category Selection - Hierarchical */}
        <div className="hud-panel rounded-xl p-4 sm:p-5 mb-6 border border-red-800/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-red-400 tracking-widest uppercase">出題範囲</h3>
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
                <div key={cat.name} className="rounded-lg border border-red-900/20 overflow-hidden">
                  <div className="flex items-center gap-2 bg-slate-900/60">
                    <button
                      onClick={() => toggleCategory(cat.name)}
                      className={`p-2.5 pl-3 text-sm font-bold transition-colors ${
                        allSelected ? 'text-red-300' : partial ? 'text-red-400/70' : 'text-gray-500'
                      }`}
                      title={allSelected ? '全解除' : '全選択'}
                    >
                      {allSelected ? '☑' : partial ? '▣' : '☐'}
                    </button>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                      className="flex-grow flex items-center justify-between p-2.5 pr-3 text-left"
                    >
                      <span className={`text-sm font-bold ${allSelected || partial ? 'text-red-200' : 'text-gray-400'}`}>
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{catSelectedCount}/{catSubCount}</span>
                        <span className={`text-xs text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-950/40 border-t border-red-900/10 p-3 space-y-3 animate-math-fade-in">
                      {cat.groups.map((group: SubCategoryGroup) => {
                        const groupAll = isGroupAllSelected(cat.name, group.name);
                        const groupPartial = isGroupPartial(cat.name, group.name);
                        return (
                          <div key={group.name}>
                            <button
                              onClick={() => toggleGroup(cat.name, group.name)}
                              className="flex items-center gap-2 mb-2 w-full text-left"
                            >
                              <span className={`text-xs ${groupAll ? 'text-red-300' : groupPartial ? 'text-red-400/70' : 'text-gray-600'}`}>
                                {groupAll ? '☑' : groupPartial ? '▣' : '☐'}
                              </span>
                              <span className={`text-xs font-bold ${groupAll || groupPartial ? 'text-red-400' : 'text-gray-500'}`}>
                                {group.name}
                              </span>
                              <div className="h-[1px] flex-grow bg-gradient-to-r from-red-500/10 to-transparent" />
                            </button>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-4">
                              {group.subtopics.map(sub => {
                                const isSelected = selectedSubtopics.has(sub);
                                return (
                                  <button
                                    key={sub}
                                    onClick={() => toggleSubtopic(sub)}
                                    className={`px-2.5 py-1.5 rounded text-[11px] font-medium text-left transition-all truncate ${
                                      isSelected
                                        ? 'bg-red-900/30 text-red-200 border border-red-500/30'
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

        {/* Count Selection */}
        <div className="hud-panel rounded-xl p-4 sm:p-5 mb-6 border border-red-800/30">
          <h3 className="text-sm font-bold text-red-400 tracking-widest uppercase mb-4">問題数</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COUNT_PRESETS.map(p => (
              <button
                key={p.count}
                onClick={() => setCount(p.count)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  count === p.count
                    ? 'border-red-500/50 bg-red-900/20'
                    : 'border-slate-700/30 bg-slate-900/30 hover:border-gray-600'
                }`}
              >
                <div className={`text-sm font-bold ${count === p.count ? 'text-red-300' : 'text-gray-400'}`}>
                  {p.label}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="pb-4">
          <button
            onClick={handleStart}
            disabled={selectedCount === 0}
            className="btn-tactical w-full py-5 rounded-2xl font-bold tracking-[0.15em] text-base disabled:opacity-40"
          >
            <div className="text-lg font-black">ミックス演習をはじめる（{count}問）</div>
            <div className="text-[10px] text-red-400 opacity-70 mt-1">{selectedCount}単元からランダムに出題</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MixPracticeSetup;
