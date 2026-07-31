import React, { useState } from 'react';
import { CHARACTERS, getCharacterSprite, stageForLevel, xpToNext, STAGE_MULT, MAX_LEVEL, CharacterFamily } from '../../data/characters';
import { useArmyStore } from '../../store/useArmyStore';

interface Props {
  onBack: () => void;
}

const font = { fontFamily: '"M PLUS Rounded 1c", sans-serif' };
const fontMono = { fontFamily: 'Orbitron, monospace' };

export const ArmyRosterScreen: React.FC<Props> = ({ onBack }) => {
  const { army } = useArmyStore();
  const [selected, setSelected] = useState<CharacterFamily | null>(null);

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-[#0a0e1a] overflow-y-auto" style={font}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 sticky top-0 z-10"
        style={{ background: 'rgba(10,14,26,0.95)' }}>
        <button onClick={onBack} className="text-white/50 hover:text-white text-sm">← もどる</button>
        <h2 className="text-[#22d3ee] font-bold text-base" style={fontMono}>ネコ図鑑</h2>
        <span className="text-white/40 text-xs ml-auto">{CHARACTERS.length}系統 / {CHARACTERS.length * 3}フォーム</span>
      </div>

      {/* Grid of families */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {CHARACTERS.map(fam => {
          const entry = army[fam.id] ?? { level: 1, xp: 0, totalBattles: 0 };
          const stage = stageForLevel(entry.level);
          const form = fam.forms[stage - 1];
          return (
            <button key={fam.id} onClick={() => setSelected(fam)}
              className="flex flex-col items-center p-3 rounded-2xl border transition-all active:scale-95"
              style={{ borderColor: `${fam.accent}55`, background: `${fam.accent}0d` }}>
              <div className="relative">
                <img src={getCharacterSprite(fam.spriteFamily, stage)} alt={form.name}
                  style={{ width: 72, height: 72, objectFit: 'contain' }} draggable={false} />
                <span className="absolute -top-1 -right-1 text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: fam.accent, color: '#0a0e1a', ...fontMono }}>
                  Lv{entry.level}
                </span>
              </div>
              <div className="text-white font-bold text-sm mt-1 text-center leading-tight">{form.name}</div>
              <div className="text-white/40 text-[10px]">{fam.displayName}・進化{stage}</div>
              {/* XP bar */}
              <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full" style={{
                  width: entry.level >= MAX_LEVEL ? '100%' : `${Math.min(100, (entry.xp / xpToNext(entry.level)) * 100)}%`,
                  background: fam.accent,
                }} />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-white/30 text-xs px-6 pb-4">
        戦闘に出すとネコが経験値を得てレベルアップ！ Lv10とLv30で姿が進化するニャ。
      </p>

      {/* Detail modal */}
      {selected && (
        <DetailModal fam={selected} entry={army[selected.id] ?? { level: 1, xp: 0, totalBattles: 0 }}
          onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

const DetailModal: React.FC<{
  fam: CharacterFamily;
  entry: { level: number; xp: number; totalBattles: number };
  onClose: () => void;
}> = ({ fam, entry, onClose }) => {
  const curStage = stageForLevel(entry.level);
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-5 max-h-[88dvh] overflow-y-auto"
        style={{ background: 'linear-gradient(160deg,#0a0e1a,#161029)', border: `2px solid ${fam.accent}`, ...font }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-bold text-lg" style={fontMono}>{fam.displayName}</h3>
            <p className="text-white/50 text-xs">{fam.role}</p>
          </div>
          <button onClick={onClose} className="text-white/40 text-2xl leading-none">×</button>
        </div>

        {/* Current level summary */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: `${fam.accent}14` }}>
          <span className="font-black text-2xl" style={{ color: fam.accent, ...fontMono }}>Lv{entry.level}</span>
          <div className="flex-1">
            <div className="text-white/70 text-xs">バトル {entry.totalBattles} 回</div>
            <div className="w-full h-2 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full" style={{
                width: entry.level >= MAX_LEVEL ? '100%' : `${Math.min(100, (entry.xp / xpToNext(entry.level)) * 100)}%`,
                background: fam.accent,
              }} />
            </div>
            <div className="text-white/40 text-[10px] mt-0.5">
              {entry.level >= MAX_LEVEL ? 'MAX' : `次のレベルまで ${xpToNext(entry.level) - entry.xp} XP`}
            </div>
          </div>
        </div>

        {/* 3 evolution forms */}
        <div className="text-white/60 text-xs font-bold mb-2" style={fontMono}>しんか</div>
        <div className="flex flex-col gap-2">
          {fam.forms.map(form => {
            const unlocked = entry.level >= form.minLevel;
            const isCurrent = form.stage === curStage;
            const mult = STAGE_MULT[form.stage];
            return (
              <div key={form.stage}
                className="flex items-center gap-3 p-2.5 rounded-xl border"
                style={{
                  borderColor: isCurrent ? fam.accent : 'rgba(255,255,255,0.08)',
                  background: isCurrent ? `${fam.accent}14` : 'rgba(255,255,255,0.02)',
                  opacity: unlocked ? 1 : 0.45,
                }}>
                <div className="relative flex-shrink-0">
                  <img src={getCharacterSprite(fam.spriteFamily, form.stage)} alt={form.name}
                    style={{ width: 56, height: 56, objectFit: 'contain', filter: unlocked ? undefined : 'grayscale(1) brightness(0.6)' }}
                    draggable={false} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm">{unlocked ? form.name : '???'}</span>
                    {isCurrent && <span className="text-[9px] px-1.5 rounded-full font-bold" style={{ background: fam.accent, color: '#0a0e1a' }}>いま</span>}
                  </div>
                  <div className="text-white/40 text-[10px]">
                    {form.stage === 1 ? 'Lv1〜' : `Lv${form.minLevel}で進化`} ・ HP×{mult.hp} 攻×{mult.dmg}
                  </div>
                  <div className="text-white/50 text-[10px] mt-0.5 leading-tight">{unlocked ? form.flavor : '進化するとわかる！'}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Base stats */}
        {/* 射程・再出撃・攻城倍率は、どのネコをいつ出すかを決める中核の数字なので
            図鑑にも出す（砲台の射程4.5と見くらべられるようにする）。 */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { l: 'HP', v: Math.round(fam.base.hp * STAGE_MULT[curStage].hp) },
            { l: '攻撃', v: Math.round(fam.base.damage * STAGE_MULT[curStage].dmg) },
            { l: '速さ', v: fam.base.moveSpeed.toFixed(1) },
            { l: '射程', v: fam.base.attackRange.toFixed(1) },
            { l: '再出撃', v: (fam.cooldownMs / 1000).toFixed(1) + '秒' },
            { l: '建物へ', v: '×' + fam.buildingDamageMult.toFixed(1) },
          ].map(s => (
            <div key={s.l} className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-white font-bold text-base" style={fontMono}>{s.v}</div>
              <div className="text-white/40 text-[10px]">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="text-white/35 text-[10px] mt-2 leading-relaxed">
          ※ 敵の砲台は射程4.5・とても長い。射程で勝てないネコは、タンク系に受けてもらうか、
          建物へのダメージが大きいネコ（ぼむにゃー ×4.0）でこわそう。
        </div>
      </div>
    </div>
  );
};
