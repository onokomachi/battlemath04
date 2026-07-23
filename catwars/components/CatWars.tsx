import React, { useEffect, useMemo, useState } from 'react';
import { BuildingType, BuildingStatus, GameState } from '../types';
import { BUILDING_STATS } from '../constants';
import { usePlayerStore } from '../store/usePlayerStore';
import { useProgressStore } from '../store/useProgressStore';
import { useBattleSetupStore } from '../store/useBattleSetupStore';
import { computeBattleLoadout } from '../utils/battleLoadout';
import { BATTLE_MAPS } from '../data/battleMaps';
import { BattleScene } from './game/BattleScene';
import { BattleSetupScreen } from './game/BattleSetupScreen';
import { RangeSelect } from './game/RangeSelect';
import { ArmyRosterScreen } from './army/ArmyRosterScreen';
import { DailyBuffsPanel } from './learn/DailyBuffsPanel';
import { ExchangePanel } from './learn/ExchangePanel';
import { BaseBuilder } from './BaseBuilder';
import { sfx } from '../utils/audioEngine';

const font = { fontFamily: '"M PLUS Rounded 1c", sans-serif' };
const fontMono = { fontFamily: 'Orbitron, monospace' };

type View = 'home' | 'base' | 'army' | 'range' | 'setup' | 'battle' | 'buffs' | 'mercs';

interface Props {
  onExit: () => void;
  playerName?: string;
}

export const CatWars: React.FC<Props> = ({ onExit, playerName }) => {
  const [view, setView] = useState<View>('home');
  const { resources, buildings, troops, lastTick, addResources, setGameState } = usePlayerStore();
  const { selectedMapId, playerDeployments, commitPlan, resetBattleSession } = useBattleSetupStore();
  const {
    getTodayDailyStars, dailyStreak, todayAnswered, dailyGoal, updateDailyStreak,
  } = useProgressStore();

  const [enemyLayout, setEnemyLayout] = useState<{ type: BuildingType; x: number; y: number }[]>([]);
  const [quizSubtopics, setQuizSubtopics] = useState<string[]>([]);
  const gameState: GameState = { resources, buildings, troops, lastTick };
  const loadout = useMemo(() => computeBattleLoadout(buildings), [buildings]);
  const dailyStars = getTodayDailyStars();

  // 金山のパッシブ収入を来訪時にまとめて回収（放置ボーナス）
  useEffect(() => {
    updateDailyStreak();
    const now = Date.now();
    const mins = Math.min(240, (now - lastTick) / 60000); // 最大4時間ぶん
    const rate = buildings
      .filter(b => b.type === BuildingType.GOLD_MINE && b.status === BuildingStatus.ACTIVE)
      .reduce((s, b) => s + (BUILDING_STATS[BuildingType.GOLD_MINE].productionRate ?? 0), 0);
    const earned = Math.floor(rate * (mins / 60));
    if (earned > 0) addResources(earned);
    setGameState(prev => ({ ...prev, lastTick: now }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndBattle = (win: boolean, loot: { gold: number }) => {
    if (win) addResources(Math.round(loot.gold));
    setView('home');
  };

  // ── サブ画面 ───────────────────────────────
  if (view === 'base') return <BaseBuilder onBack={() => setView('home')} />;
  if (view === 'army') return <ArmyRosterScreen onBack={() => setView('home')} />;

  if (view === 'range') {
    return (
      <RangeSelect
        onBack={() => setView('home')}
        onConfirm={(subs) => { setQuizSubtopics(subs); setView('setup'); }}
      />
    );
  }

  if (view === 'setup') {
    return (
      <BattleSetupScreen
        loadout={loadout}
        onBack={() => setView('home')}
        onStartBattle={(mapId, deployments) => {
          const map = BATTLE_MAPS.find(m => m.id === mapId) ?? BATTLE_MAPS[0];
          commitPlan(mapId, deployments);
          setEnemyLayout(map.enemyBase);
          setView('battle');
        }}
      />
    );
  }

  if (view === 'battle') {
    const map = BATTLE_MAPS.find(m => m.id === selectedMapId) ?? BATTLE_MAPS[0];
    return (
      <BattleScene
        attackerState={gameState}
        defenderBuildings={enemyLayout}
        playerDeployments={playerDeployments}
        battleMap={map}
        loadout={loadout}
        quizSubtopics={quizSubtopics}
        onEndBattle={handleEndBattle}
      />
    );
  }

  // ── ハブ（ホーム）───────────────────────────
  const dailyProgress = Math.min(1, todayAnswered / Math.max(1, dailyGoal));

  const StatChip: React.FC<{ icon: string; value: React.ReactNode; color: string }> = ({ icon, value, color }) => (
    <div className="flex items-center gap-1 border rounded-full px-2.5 py-1"
      style={{ borderColor: `${color}66`, background: `${color}14` }}>
      <span className="text-sm">{icon}</span>
      <span className="font-bold text-xs" style={{ color, ...fontMono }}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col overflow-y-auto" style={font}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={onExit} className="text-white/60 hover:text-white text-sm">← メニュー</button>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {dailyStreak >= 1 && <StatChip icon="🔥" value={`${dailyStreak}`} color="#fb923c" />}
          <StatChip icon="💠" value={Math.floor(resources.gold)} color="#38bdf8" />
          <StatChip icon="⚡" value={dailyStars} color="#facc15" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center px-4 mt-1 mb-3">
        <h1 className="text-3xl sm:text-4xl font-black text-hologram tracking-wide" style={fontMono}>CAT-WARS</h1>
        <p className="text-[11px] text-[#38bdf8]/80 tracking-[0.3em] mt-1">拠点をきずき ネコ軍団で せめこもう</p>
      </div>

      {/* Daily goal */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/60 text-[11px]">きょうの学習で 💠クレジット と ⚡エナジー がたまる</span>
          <span className="text-[#38bdf8] text-[11px]" style={fontMono}>{todayAnswered}/{dailyGoal}問</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${dailyProgress * 100}%`, background: 'linear-gradient(90deg,#2563eb,#ef4444)' }} />
        </div>
      </div>

      {/* Big actions */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <HubButton icon="⚔️" label="出撃！" sub="範囲をえらんで敵拠点を襲撃" color="#ef4444"
          onClick={() => { resetBattleSession(); setView('range'); }} big />
        <HubButton icon="🏰" label="拠点づくり" sub="💠クレジットで施設を建設" color="#38bdf8"
          onClick={() => setView('base')} />
        <HubButton icon="🐱" label="ネコ図鑑" sub="部隊のレベル・進化" color="#a3e635"
          onClick={() => setView('army')} />
        <HubButton icon="✨" label="出撃バフ" sub="⚡エナジーで今日の戦力UP" color="#facc15"
          onClick={() => setView('buffs')} />
      </div>

      {/* Base mini-preview */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-white/10 p-3" style={{ background: 'rgba(6,10,24,0.55)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-xs font-bold" style={fontMono}>じぶんの拠点</span>
            <button onClick={() => setView('base')} className="text-[#38bdf8] text-[11px]">くわしく ›</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(
              buildings.reduce<Record<string, number>>((acc, b) => {
                acc[b.type] = (acc[b.type] ?? 0) + 1; return acc;
              }, {})
            ).length === 0 && <span className="text-white/40 text-xs">まだ施設がありません</span>}
            {Object.entries(
              buildings.reduce<Record<string, number>>((acc, b) => {
                acc[b.type] = (acc[b.type] ?? 0) + 1; return acc;
              }, {})
            ).map(([type, n]) => (
              <div key={type} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                <img src={`/assets/sprites/${type.toLowerCase().replace(/_/g, '-')}.svg`} alt={type}
                  style={{ width: 20, height: 20, objectFit: 'contain' }} draggable={false} />
                <span className="text-white/70 text-[11px]">{BUILDING_STATS[type as BuildingType].name}×{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mercenaries shortcut */}
      <div className="px-4 pt-3 pb-8">
        <button onClick={() => setView('mercs')}
          className="w-full py-3 rounded-xl border border-[#a3e635]/40 text-[#a3e635] text-sm font-bold hover:bg-[#a3e635]/10 transition-all active:scale-95">
          💠 傭兵召集（クレジットでレアな宇宙ネコを解放）
        </button>
      </div>

      {/* Overlay panels */}
      {view === 'buffs' && (
        <Overlay title="出撃バフ" onClose={() => setView('home')}>
          <DailyBuffsPanel />
        </Overlay>
      )}
      {view === 'mercs' && (
        <Overlay title="傭兵召集" onClose={() => setView('home')}>
          <ExchangePanel />
        </Overlay>
      )}
    </div>
  );
};

const HubButton: React.FC<{
  icon: string; label: string; sub: string; color: string; onClick: () => void; big?: boolean;
}> = ({ icon, label, sub, color, onClick, big }) => (
  <button onClick={() => { sfx.select(); onClick(); }}
    className={`relative overflow-hidden rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${big ? 'col-span-2 py-6' : 'py-5'}`}
    style={{ borderColor: `${color}`, background: `${color}18`, boxShadow: big ? `0 0 22px ${color}55` : `0 0 10px ${color}33` }}>
    <span className={big ? 'text-4xl' : 'text-3xl'}>{icon}</span>
    <span className="font-black text-white tracking-wide" style={{ ...fontMono, fontSize: big ? 18 : 15 }}>{label}</span>
    <span className="text-[11px]" style={{ color }}>{sub}</span>
  </button>
);

const Overlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: 'rgba(4,7,18,0.96)', backdropFilter: 'blur(10px)' }}>
    <div className="flex items-center gap-3 p-4 border-b border-white/10">
      <button onClick={onClose} className="text-white/60 hover:text-white text-sm">← もどる</button>
      <h2 className="text-[#38bdf8] font-bold text-base" style={fontMono}>{title}</h2>
    </div>
    <div className="flex-1 overflow-y-auto p-4">{children}</div>
  </div>
);
