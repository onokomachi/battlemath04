import React, { useMemo, useState } from 'react';
import { MATH_CATEGORIES } from '../../../constants';

const font = { fontFamily: '"M PLUS Rounded 1c", sans-serif' };
const fontMono = { fontFamily: 'Orbitron, monospace' };

interface Props {
  lockedUnits?: Set<string>;
  onBack: () => void;
  onConfirm: (subtopics: string[]) => void;
}

/**
 * 出撃前の「出題範囲」選択（スピードモードと同じ発想）。
 * ここで選んだ単元の問題が、戦闘中にランダム出題され、正解すると ⚡エナジー を稼げる。
 * 既定は解放ずみ全単元。単元(ワールド)単位でオン/オフを切り替える簡潔なUI。
 */
export const RangeSelect: React.FC<Props> = ({ lockedUnits, onBack, onConfirm }) => {
  const openCategories = useMemo(
    () => MATH_CATEGORIES.filter(c => !lockedUnits?.has(c.name)),
    [lockedUnits],
  );
  const subtopicsOf = (catName: string): string[] =>
    openCategories.find(c => c.name === catName)?.groups.flatMap(g => g.subtopics) ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set(openCategories.map(c => c.name)));

  const toggle = (name: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) { if (next.size > 1) next.delete(name); }
      else next.add(name);
      return next;
    });

  const allOn = selected.size === openCategories.length;
  const chosenSubtopics = openCategories
    .filter(c => selected.has(c.name))
    .flatMap(c => subtopicsOf(c.name));

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col overflow-y-auto" style={font}>
      <div className="flex items-center gap-3 p-4 border-b border-white/10 sticky top-0 z-20"
        style={{ background: 'rgba(6,10,24,0.82)', backdropFilter: 'blur(12px)' }}>
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm">← もどる</button>
        <h2 className="text-[#f87171] font-bold text-base" style={fontMono}>出題範囲をえらぶ</h2>
        <button
          onClick={() => setSelected(allOn ? new Set([openCategories[0].name]) : new Set(openCategories.map(c => c.name)))}
          className="ml-auto text-[11px] px-3 py-1 rounded-full border border-white/20 text-white/70 hover:text-white">
          {allOn ? 'ぜんぶ外す' : 'ぜんぶ選ぶ'}
        </button>
      </div>

      <p className="px-4 pt-3 text-white/60 text-xs leading-relaxed">
        えらんだ単元の問題が、<span className="text-[#facc15] font-bold">戦闘中にランダム出題</span>されます。
        正解すると <span className="text-[#facc15] font-bold">⚡エナジー</span> が手に入り、ネコをどんどん出撃させられる！
      </p>

      <div className="flex-1 overflow-y-auto px-3 py-3 grid grid-cols-2 gap-2.5">
        {openCategories.map(c => {
          const on = selected.has(c.name);
          const n = subtopicsOf(c.name).length;
          return (
            <button key={c.name} onClick={() => toggle(c.name)}
              className="flex items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 text-left"
              style={{
                borderColor: on ? '#f87171' : 'rgba(255,255,255,0.12)',
                background: on ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.03)',
              }}>
              <span className="text-lg">{on ? '✅' : '⬜'}</span>
              <div className="min-w-0">
                <div className="text-white font-bold text-xs truncate">{c.name}</div>
                <div className="text-white/40 text-[10px]" style={fontMono}>{n}項目</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-4 pt-3"
        style={{ background: 'rgba(6,10,24,0.9)', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <button
          onClick={() => onConfirm(chosenSubtopics)}
          disabled={chosenSubtopics.length === 0}
          className="w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95 disabled:opacity-30"
          style={{
            fontFamily: 'Orbitron, monospace',
            background: 'rgba(239,68,68,0.18)', border: '2px solid #ef4444', color: '#f87171',
            boxShadow: '0 0 14px rgba(239,68,68,0.5)',
          }}>
          この範囲で 作戦立案へ →
        </button>
      </div>
    </div>
  );
};
