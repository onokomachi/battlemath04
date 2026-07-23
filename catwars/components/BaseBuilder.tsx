import React, { useState } from 'react';
import { BuildingType, BuildingStatus, GRID_SIZE, Building } from '../types';
import { BUILDING_STATS } from '../constants';
import { usePlayerStore } from '../store/usePlayerStore';
import { computeBattleLoadout } from '../utils/battleLoadout';
import { sfx } from '../utils/audioEngine';

const font = { fontFamily: '"M PLUS Rounded 1c", sans-serif' };
const fontMono = { fontFamily: 'Orbitron, monospace' };

// 拠点に建設できる施設（タウンホールは初期配置ずみ・撤去不可）
const BUILDABLE: BuildingType[] = [
  BuildingType.GOLD_MINE,
  BuildingType.BARRACKS,
  BuildingType.ARMY_CAMP,
  BuildingType.CANNON,
  BuildingType.HIDDEN_TESLA,
  BuildingType.WALL,
];

interface Props {
  onBack: () => void;
}

export const BaseBuilder: React.FC<Props> = ({ onBack }) => {
  const { resources, buildings, setGameState, spendResources } = usePlayerStore();
  const [placing, setPlacing] = useState<BuildingType | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const CELL = 26;

  const loadout = computeBattleLoadout(buildings);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 1800); };

  const cellOccupant = (x: number, y: number): Building | undefined =>
    buildings.find(b => {
      const s = BUILDING_STATS[b.type];
      return x >= b.position.x && x < b.position.x + s.width && y >= b.position.y && y < b.position.y + s.height;
    });

  const canPlaceAt = (type: BuildingType, x: number, y: number): boolean => {
    const s = BUILDING_STATS[type];
    if (x + s.width > GRID_SIZE || y + s.height > GRID_SIZE) return false;
    for (let dy = 0; dy < s.height; dy++)
      for (let dx = 0; dx < s.width; dx++)
        if (cellOccupant(x + dx, y + dy)) return false;
    return true;
  };

  const place = (x: number, y: number) => {
    if (!placing) return;
    const stats = BUILDING_STATS[placing];
    if (!canPlaceAt(placing, x, y)) { flash('⛔ ここには置けないよ'); return; }
    if (resources.gold < stats.cost.gold) { flash('💰 ゴールドがたりない！問題を解いてためよう'); return; }
    if (!spendResources(stats.cost.gold)) { flash('💰 ゴールドがたりない！'); return; }
    const nb: Building = {
      id: `b-${Date.now()}-${x}-${y}`,
      type: placing,
      level: 1,
      position: { x, y },
      hp: stats.hp,
      maxHp: stats.hp,
      status: BuildingStatus.ACTIVE,
    };
    setGameState(prev => ({ ...prev, buildings: [...prev.buildings, nb] }));
    sfx.tap();
    flash(`🏗️ ${stats.name}を建設！（-${stats.cost.gold}💰）`);
  };

  const remove = (b: Building) => {
    if (b.type === BuildingType.TOWN_HALL) { flash('🏰 コアは撤去できません'); return; }
    const refund = Math.round(BUILDING_STATS[b.type].cost.gold * 0.5);
    setGameState(prev => ({
      ...prev,
      buildings: prev.buildings.filter(x => x.id !== b.id),
      resources: { ...prev.resources, gold: Math.min(prev.resources.maxGold, prev.resources.gold + refund) },
    }));
    sfx.tap();
    flash(`♻️ 撤去して ${refund}💰 もどってきた`);
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-transparent overflow-y-auto" style={font}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 sticky top-0 z-20"
        style={{ background: 'rgba(6,10,24,0.82)', backdropFilter: 'blur(12px)' }}>
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm">← もどる</button>
        <h2 className="text-[#38bdf8] font-bold text-base" style={fontMono}>拠点づくり</h2>
        <span className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full"
          style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.35)' }}>
          <span>💰</span>
          <span className="text-[#facc15] font-bold" style={fontMono}>{Math.floor(resources.gold)}</span>
        </span>
      </div>

      {msg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-[#38bdf8]/50 text-white text-xs font-bold px-5 py-2 rounded-full shadow-2xl animate-bounce">
          {msg}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 flex items-start justify-center px-2 py-3 overflow-auto">
        <div style={{ position: 'relative', width: GRID_SIZE * CELL, height: GRID_SIZE * CELL, flexShrink: 0 }}>
          {/* soil grid */}
          {Array.from({ length: GRID_SIZE }, (_, y) =>
            Array.from({ length: GRID_SIZE }, (_, x) => {
              const occ = cellOccupant(x, y);
              const isTopLeft = occ && occ.position.x === x && occ.position.y === y;
              const placeable = placing && !occ && canPlaceAt(placing, x, y);
              return (
                <div key={`${x}-${y}`}
                  onClick={() => { if (occ) remove(occ); else if (placing) place(x, y); }}
                  style={{
                    position: 'absolute', left: x * CELL, top: y * CELL, width: CELL, height: CELL,
                    background: (x + y) % 2 === 0 ? 'rgba(34,60,40,0.55)' : 'rgba(28,52,34,0.55)',
                    border: `1px solid ${placeable ? 'rgba(56,189,248,0.55)' : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: placeable ? 'inset 0 0 8px rgba(56,189,248,0.35)' : undefined,
                    cursor: placing || occ ? 'pointer' : 'default',
                  }}
                >
                  {isTopLeft && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img src={`/assets/sprites/${occ!.type.toLowerCase().replace(/_/g, '-')}.svg`}
                        alt={occ!.type}
                        style={{
                          width: BUILDING_STATS[occ!.type].width * CELL - 4,
                          height: BUILDING_STATS[occ!.type].height * CELL - 4,
                          objectFit: 'contain',
                        }}
                        draggable={false} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Loadout summary */}
      <div className="px-4 py-2 text-[11px] text-white/60 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10" style={font}>
        <span>出撃で使える力 →</span>
        <span className="text-[#a3e635]">🐱 {loadout.unlockedTroopTypes.length}系統(基本)</span>
        <span className="text-white/70">🧱 壁×{loadout.maxWallSlots}</span>
        {loadout.canBringCannon && <span className="text-[#f87171]">💣 大砲OK</span>}
        {loadout.canBringTesla && <span className="text-[#22d3ee]">⚡ テスラOK</span>}
        <span className="text-white/70">🏗️ 防衛スロット {loadout.maxBuildingSlots}</span>
      </div>

      {/* Building picker */}
      <div className="border-t border-white/10 px-3 pt-3"
        style={{ background: 'rgba(6,10,24,0.9)', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {BUILDABLE.map(type => {
            const s = BUILDING_STATS[type];
            const poor = resources.gold < s.cost.gold;
            const sel = placing === type;
            return (
              <button key={type}
                onClick={() => setPlacing(sel ? null : type)}
                className="flex-shrink-0 flex flex-col items-center p-2 rounded-xl border-2 min-w-[76px] transition-all active:scale-95"
                style={{
                  borderColor: sel ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                  background: sel ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)',
                  opacity: poor && !sel ? 0.45 : 1,
                }}>
                <img src={`/assets/sprites/${type.toLowerCase().replace(/_/g, '-')}.svg`} alt={s.name}
                  style={{ width: 34, height: 34, objectFit: 'contain' }} draggable={false} />
                <span className="text-[10px] text-white/80 mt-1 leading-none">{s.name}</span>
                <span className="text-[10px] font-bold text-[#facc15] mt-0.5" style={fontMono}>{s.cost.gold}💰</span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-white/40 text-[10px] pb-2" style={font}>
          {placing
            ? `👆 マスをタップして「${BUILDING_STATS[placing].name}」を配置 ・ もう一度タップで撤去(半額返金)`
            : '施設をえらんで拠点を強くしよう。施設が増えると出撃できる兵や防衛が増える！'}
        </p>
      </div>
    </div>
  );
};
