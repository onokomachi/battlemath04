import React, { useState } from 'react';
import { useProgressStore } from '../../store/useProgressStore';
import { CHARACTERS, CHARACTER_BY_ID } from '../../data/characters';
import { sfx } from '../../utils/audioEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const font = { fontFamily: '"M PLUS Rounded 1c", sans-serif' };
const fontMono = { fontFamily: 'Orbitron, monospace' };

const starCostFor = (id: string): number => (id.startsWith('boss') ? 3 : 1);

export const ExchangePanel: React.FC = () => {
  const { stars, unlockCharacterWithSuperStar, unlockedToday, unlockedTodayDate } = useProgressStore();
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; cost: number } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isUnlockedToday = (id: string) =>
    unlockedTodayDate === today && unlockedToday.includes(id);

  // スターターでないキャラ＝レア解放対象
  const rares = CHARACTERS.filter(c => !c.isStarter);

  const confirmBuy = () => {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (!unlockCharacterWithSuperStar(p.id, p.cost)) { sfx.incorrect(); return; }
    sfx.correct();
    setFlash(p.id);
    setTimeout(() => setFlash(null), 600);
  };

  return (
    <div className="w-full max-w-sm mx-auto" style={font}>
      <div className="flex items-center gap-2 mb-4 bg-white/5 rounded-2xl p-3">
        <span className="text-2xl">🌟</span>
        <div>
          <span className="text-[#a3e635] text-xl font-bold" style={fontMono}>{stars}</span>
          <span className="text-white/60 text-xs ml-2">スーパースター（永続）</span>
        </div>
      </div>
      <p className="text-white/40 text-xs mb-4" style={font}>
        🌟 をつかうと、レアな宇宙ネコを<b style={{ color: '#a3e635' }}>きょう一日</b>つかえるよ。問題を解いてなくてもOK！
      </p>

      <div className="flex flex-col gap-2.5">
        {rares.map((c) => {
          const cost = starCostFor(c.id);
          const owned = isUnlockedToday(c.id);
          const canAfford = !owned && stars >= cost;
          const isFlashing = flash === c.id;
          const isBoss = c.id.startsWith('boss');
          return (
            <div key={c.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all"
              style={{
                borderColor: isFlashing ? '#a3e635' : owned ? 'rgba(163,230,53,0.4)' : `${c.accent}55`,
                background: isFlashing ? 'rgba(163,230,53,0.15)' : owned ? 'rgba(163,230,53,0.08)' : 'rgba(255,255,255,0.04)',
              }}>
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ background: `${c.accent}22`, border: `1px solid ${c.accent}66` }}>
                <span className="text-xl">{isBoss ? '👾' : '🐱'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/90 font-bold text-sm truncate">{c.forms[0].name}</span>
                  {isBoss && <span className="text-[8px] font-black px-1 rounded bg-[#f43f5e] text-white">BOSS</span>}
                </div>
                <div className="text-white/40 text-[10px] mt-0.5 leading-snug truncate">{c.role}</div>
              </div>
              {owned ? (
                <span className="text-[#a3e635] text-xs font-bold flex-shrink-0" style={fontMono}>解放中 ✓</span>
              ) : (
                <button
                  onClick={() => setPending({ id: c.id, cost })}
                  disabled={!canAfford}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: canAfford ? 'rgba(163,230,53,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${canAfford ? '#a3e635' : 'rgba(255,255,255,0.2)'}`,
                  }}>
                  <span className="text-[#a3e635] font-bold text-sm" style={fontMono}>{cost}</span>
                  <span className="text-base">🌟</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-white/50 text-xs text-center mt-4" style={font}>
        もんだいを といて 🌟 を あつめよう！
      </p>

      <ConfirmDialog
        open={pending !== null}
        accent="#a3e635"
        title="スーパースターを つかう？"
        message={pending ? (
          <>🌟 <b style={{ color: '#a3e635' }}>{pending.cost}こ</b> をつかって<br />
            「{CHARACTER_BY_ID[pending.id]?.forms[0].name}」を きょう一日 解放します。<br />
            <span className="text-white/50 text-xs">🌟はめったに手に入らないよ。いい？</span></>
        ) : ''}
        confirmLabel="つかう"
        onConfirm={confirmBuy}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
