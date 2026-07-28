import React, { useMemo, useState } from 'react';
import { BuildingType, DeployedBuilding, GRID_W, GRID_H, BattleMap } from '../types';
import { BUILDING_STATS } from '../constants';
import { useBaseStore, FACILITY_ENERGY_COST } from '../store/useBaseStore';
import { useProgressStore } from '../store/useProgressStore';
import { computeBattleLoadout } from '../utils/battleLoadout';
import { BATTLE_MAP_BY_ID, zoneSize } from '../data/battleMaps';
import { CampaignChapter } from '../data/campaign';
import { sfx } from '../utils/audioEngine';

const font = { fontFamily: '"M PLUS Rounded 1c", sans-serif' };
const fontMono = { fontFamily: 'Orbitron, monospace' };

// 陣地に置ける施設（コアは必須・無料で常に1つ）
const PLACEABLE: BuildingType[] = [
  BuildingType.WALL,
  BuildingType.CANNON,
  BuildingType.HIDDEN_TESLA,
  BuildingType.ARMY_CAMP,
];
// 戦場には出ないが、建てておくと効果がある施設（マス目を消費しない）
const SUPPORT: BuildingType[] = [
  BuildingType.BARRACKS,
  BuildingType.GOLD_MINE,
];

const TERRAIN_BG: Record<string, string> = {
  GRASS: 'rgba(255,255,255,0.03)',
  WATER: 'linear-gradient(180deg, #1e40af 0%, #1d4ed8 45%, #1e3a8a 100%)',
  BRIDGE: '#92400e',
  ROCK: '#374151',
  SWAMP: 'rgba(20,83,45,0.85)',
  LAVA: '#7f1d1d',
};

interface Props {
  chapter: CampaignChapter;
  onBack: () => void;
  /** 出撃フローから来たときだけ渡される（ハブから来た場合は無し） */
  onProceed?: () => void;
}

/**
 * ステージごとの陣地づくり。
 *
 * ・施設は ⚡エナジー で「その日ぶん」建設する（翌日リセット）
 * ・建てた施設は今日のうちなら、どのステージでも自由に置き直せる
 * ・置ける範囲（自陣ゾーン）はステージごとに違う。広い章もあれば、ほとんど置けない章もある
 */
export const BaseBuilder: React.FC<Props> = ({ chapter, onBack, onProceed }) => {
  const map: BattleMap = BATTLE_MAP_BY_ID[chapter.mapId];
  const base = useBaseStore();
  const { getTodayDailyStars, spendDailyStars, addDailyStars } = useProgressStore();
  const energy = getTodayDailyStars();

  const [layout, setLayoutLocal] = useState<DeployedBuilding[]>(() => {
    const saved = base.getLayout(chapter.id);
    // コアが無ければ自陣の奥に自動配置（毎回置かせるのは手間なので）
    if (saved.some(d => d.type === BuildingType.TOWN_HALL)) return saved;
    const z = map.playerDeployZone;
    const cx = z.xMin;
    const cy = Math.max(z.yMin, Math.min(z.yMax - 1, Math.floor((z.yMin + z.yMax) / 2)));
    return [...saved, { type: BuildingType.TOWN_HALL, x: cx, y: cy }];
  });
  const [selected, setSelected] = useState<BuildingType | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const built = base.getBuilt();
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 1900); };

  // 自動配置したコアは、まだストアに入っていないので初回に保存しておく。
  // （これを忘れると、何も編集せずに出撃したときコアが戦場に出ない）
  React.useEffect(() => {
    // 日付が変わっていればここでリセットする（描画中ではなく効果の中で行う）
    base.rollDateIfNeeded();
    const saved = base.getLayout(chapter.id);
    if (!saved.some(d => d.type === BuildingType.TOWN_HALL)) {
      base.setLayout(chapter.id, layout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  const save = (next: DeployedBuilding[]) => {
    setLayoutLocal(next);
    base.setLayout(chapter.id, next);
  };

  const used = useMemo(() => {
    const u: Partial<Record<BuildingType, number>> = {};
    for (const d of layout) u[d.type] = (u[d.type] ?? 0) + 1;
    return u;
  }, [layout]);

  /** その施設をあと何個 置けるか（もちもの − 配置ずみ） */
  const spare = (t: BuildingType) => (built[t] ?? 0) - (used[t] ?? 0);

  const loadout = useMemo(() => computeBattleLoadout(built), [built]);
  const zone = map.playerDeployZone;
  const zs = zoneSize(map);

  const terrainAt = (x: number, y: number) =>
    map.terrain.find(t => t.x === x && t.y === y)?.type ?? 'GRASS';

  const inZone = (x: number, y: number) =>
    x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax;

  const placedAt = (x: number, y: number): DeployedBuilding | undefined =>
    layout.find(d => {
      const s = BUILDING_STATS[d.type];
      return x >= d.x && x < d.x + s.width && y >= d.y && y < d.y + s.height;
    });

  const enemyAt = (x: number, y: number) =>
    map.enemyBase.find(e => {
      const s = BUILDING_STATS[e.type];
      return x >= e.x && x < e.x + s.width && y >= e.y && y < e.y + s.height;
    });

  const canPlaceAt = (type: BuildingType, x: number, y: number): boolean => {
    const s = BUILDING_STATS[type];
    for (let dy = 0; dy < s.height; dy++) {
      for (let dx = 0; dx < s.width; dx++) {
        const px = x + dx, py = y + dy;
        if (px >= GRID_W || py >= GRID_H) return false;
        if (!inZone(px, py)) return false;
        const t = terrainAt(px, py);
        if (t === 'WATER' || t === 'ROCK' || t === 'LAVA') return false;
        if (placedAt(px, py)) return false;
      }
    }
    return true;
  };

  const handleCell = (x: number, y: number) => {
    const existing = placedAt(x, y);
    // 置いてあるものをタップ → もちものにもどす（コアは動かせない扱いにせず、選び直しで移動できる）
    if (existing) {
      if (existing.type === BuildingType.TOWN_HALL) {
        flash('🏰 コアは、おきたいマスをえらんで動かせるよ');
        setSelected(BuildingType.TOWN_HALL);
        return;
      }
      save(layout.filter(d => !(d.x === existing.x && d.y === existing.y)));
      sfx.tap();
      return;
    }
    if (!selected) return;
    if (!canPlaceAt(selected, x, y)) { flash('⛔ ここにはおけないよ'); return; }

    if (selected === BuildingType.TOWN_HALL) {
      save([...layout.filter(d => d.type !== BuildingType.TOWN_HALL), { type: selected, x, y }]);
      sfx.tap();
      return;
    }

    // もちものが無ければ、その場で⚡をはらって建設する
    if (spare(selected) <= 0) {
      const cost = FACILITY_ENERGY_COST[selected] ?? 0;
      if (energy < cost) { flash(`⚡ エナジーが ${cost - energy} たりない！問題をといてためよう`); return; }
      const ok = base.build(selected, (n) => spendDailyStars(n));
      if (!ok) { flash('⚡ エナジーがたりない！'); return; }
      flash(`🏗️ ${BUILDING_STATS[selected].name}を建設！（-${cost}⚡）`);
    }
    save([...layout, { type: selected, x, y }]);
    sfx.tap();
  };

  /** 戦場に出ない施設（兵舎・金山）を建設する */
  const buildSupport = (t: BuildingType) => {
    const cost = FACILITY_ENERGY_COST[t] ?? 0;
    if (energy < cost) { flash(`⚡ エナジーが ${cost - energy} たりない！`); return; }
    if (base.build(t, (n) => spendDailyStars(n))) {
      sfx.tap();
      flash(`🏗️ ${BUILDING_STATS[t].name}を建設！（-${cost}⚡）`);
    }
  };

  /** もちもの（未配置ぶん）を1つこわして⚡をもどす */
  const demolish = (t: BuildingType) => {
    if (spare(t) <= 0) { flash('⚡ 置いてあるものは、さきに陣地からはずしてね'); return; }
    base.demolish(t, (n) => addDailyStars(n));
    sfx.tap();
    flash(`♻️ ${BUILDING_STATS[t].name}をこわして ⚡がもどった`);
  };

  // 盤面は 28×16 と横長なので、表示領域に合わせてマス目の大きさを決める。
  // 固定サイズだと iPad 横向きで盤面が小さく、まわりが余ってしまう。
  const boardRef = React.useRef<HTMLDivElement | null>(null);
  const [cell, setCell] = useState(22);
  React.useLayoutEffect(() => {
    const fit = () => {
      const el = boardRef.current;
      if (!el) return;
      const w = el.clientWidth - 8;
      const h = el.clientHeight - 8;
      if (w <= 0 || h <= 0) return;
      setCell(Math.max(14, Math.min(44, Math.floor(Math.min(w / GRID_W, h / GRID_H)))));
    };
    fit();
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const CELL = cell;

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden" style={font}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0"
        style={{ background: 'rgba(6,10,24,0.85)', backdropFilter: 'blur(12px)' }}>
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm">← もどる</button>
        <div className="min-w-0">
          <h2 className="text-[#38bdf8] font-bold text-sm leading-tight" style={fontMono}>陣地づくり</h2>
          <p className="text-white/45 text-[10px] truncate">第{chapter.no}章「{chapter.title}」／{map.name}</p>
        </div>
        <span className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full flex-shrink-0"
          style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.4)' }}>
          <span>⚡</span>
          <span className="text-[#facc15] font-bold" style={fontMono}>{energy}</span>
        </span>
      </div>

      {msg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-[#38bdf8]/50 text-white text-xs font-bold px-5 py-2 rounded-full shadow-2xl">
          {msg}
        </div>
      )}

      {/* ゾーン情報 */}
      <div className="px-4 py-1.5 flex items-center gap-2 flex-wrap text-[11px] flex-shrink-0">
        <span className="px-2 py-0.5 rounded-full border text-[#a3e635]"
          style={{ background: 'rgba(163,230,53,0.1)', borderColor: 'rgba(163,230,53,0.35)' }}>
          この章の陣地 {zs.w}×{zs.h}マス
        </span>
        <span className="text-white/45">
          {zs.w >= 9 ? 'ひろい！ たっぷり組めるよ' : zs.w <= 5 ? 'せまい…えらんで置こう' : 'ふつうの広さ'}
        </span>
      </div>

      {/* Battlefield */}
      <div ref={boardRef} className="flex-1 overflow-auto px-2 py-1 flex items-center justify-center">
        <div style={{ position: 'relative', width: GRID_W * CELL, height: GRID_H * CELL, flexShrink: 0 }}>
          {Array.from({ length: GRID_H }, (_, y) =>
            Array.from({ length: GRID_W }, (_, x) => {
              const t = terrainAt(x, y);
              const iz = inZone(x, y);
              const p = placedAt(x, y);
              const e = !p && enemyAt(x, y);
              const isTopLeft = p && p.x === x && p.y === y;
              const isEnemyTopLeft = e && e.x === x && e.y === y;
              const placeable = selected && iz && !p && canPlaceAt(selected, x, y);
              return (
                <div key={`${x}-${y}`}
                  onClick={() => { if (iz) handleCell(x, y); }}
                  style={{
                    position: 'absolute', left: x * CELL, top: y * CELL, width: CELL, height: CELL,
                    background: iz && t === 'GRASS' ? 'rgba(56,189,248,0.09)' : TERRAIN_BG[t],
                    border: `1px solid ${placeable ? 'rgba(56,189,248,0.7)' : iz ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: placeable ? 'inset 0 0 6px rgba(56,189,248,0.45)' : undefined,
                    cursor: iz ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: CELL * 0.55, lineHeight: 1,
                  }}>
                  {isTopLeft && (
                    <span style={{ filter: 'drop-shadow(0 0 4px #22d3ee)', fontSize: CELL * 0.68 }}>
                      {BUILDING_STATS[p!.type].icon || '🧱'}
                    </span>
                  )}
                  {isEnemyTopLeft && <span style={{ opacity: 0.5 }}>{BUILDING_STATS[e!.type].icon || '🧱'}</span>}
                  {t === 'LAVA' && !p && !e && <span style={{ opacity: 0.7, fontSize: CELL * 0.5 }}>🔥</span>}
                </div>
              );
            })
          )}
          {/* 自陣ゾーンの外枠 */}
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            left: zone.xMin * CELL, top: zone.yMin * CELL,
            width: (zone.xMax - zone.xMin + 1) * CELL, height: (zone.yMax - zone.yMin + 1) * CELL,
            border: '2px dashed rgba(56,189,248,0.55)', borderRadius: 4,
          }} />
        </div>
      </div>

      {/* Loadout summary */}
      <div className="px-4 py-1 text-[10px] text-white/55 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/10 flex-shrink-0">
        <span className="text-white/40">今日つかえる力 →</span>
        <span className="text-[#a3e635]">🐱 {loadout.unlockedTroopTypes.length}系統</span>
        <span>💊 ヒール{loadout.healCharges}</span>
        <span>😤 レイジ{loadout.rageCharges}</span>
      </div>

      {/* Facility picker */}
      <div className="border-t border-white/10 px-3 pt-2 flex-shrink-0"
        style={{ background: 'rgba(6,10,24,0.95)', paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {/* コア */}
          <button onClick={() => setSelected(selected === BuildingType.TOWN_HALL ? null : BuildingType.TOWN_HALL)}
            className="flex-shrink-0 flex flex-col items-center p-1.5 rounded-xl border-2 min-w-[68px] transition-all active:scale-95"
            style={{
              borderColor: selected === BuildingType.TOWN_HALL ? '#38bdf8' : 'rgba(255,255,255,0.15)',
              background: selected === BuildingType.TOWN_HALL ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)',
            }}>
            <span className="text-xl leading-none">🏰</span>
            <span className="text-[10px] text-white/80 mt-1 leading-none">コア</span>
            <span className="text-[9px] font-bold text-[#a3e635] mt-0.5" style={fontMono}>ひっす</span>
          </button>

          {PLACEABLE.map(type => {
            const s = BUILDING_STATS[type];
            const cost = FACILITY_ENERGY_COST[type];
            const sp = spare(type);
            const own = built[type] ?? 0;
            const sel = selected === type;
            const poor = sp <= 0 && energy < cost;
            return (
              <div key={type} className="flex-shrink-0 flex flex-col items-center">
                <button onClick={() => setSelected(sel ? null : type)}
                  className="flex flex-col items-center p-1.5 rounded-xl border-2 min-w-[68px] transition-all active:scale-95"
                  style={{
                    borderColor: sel ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                    background: sel ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)',
                    opacity: poor && !sel ? 0.45 : 1,
                  }}>
                  <span className="text-xl leading-none">{s.icon || '🧱'}</span>
                  <span className="text-[10px] text-white/80 mt-1 leading-none">{s.name}</span>
                  <span className="text-[9px] font-bold mt-0.5" style={{ ...fontMono, color: sp > 0 ? '#a3e635' : '#facc15' }}>
                    {sp > 0 ? `もちもの${sp}` : `${cost}⚡`}
                  </span>
                </button>
                {own > 0 && (
                  <button onClick={() => demolish(type)}
                    className="text-[9px] text-white/35 hover:text-white/70 mt-0.5">
                    ♻️こわす
                  </button>
                )}
              </div>
            );
          })}

          {/* 戦場に出ない支援施設 */}
          {SUPPORT.map(type => {
            const s = BUILDING_STATS[type];
            const cost = FACILITY_ENERGY_COST[type];
            const own = built[type] ?? 0;
            return (
              <div key={type} className="flex-shrink-0 flex flex-col items-center">
                <button onClick={() => buildSupport(type)}
                  className="flex flex-col items-center p-1.5 rounded-xl border-2 min-w-[68px] transition-all active:scale-95"
                  style={{
                    borderColor: own > 0 ? 'rgba(163,230,53,0.5)' : 'rgba(255,255,255,0.15)',
                    background: own > 0 ? 'rgba(163,230,53,0.1)' : 'rgba(255,255,255,0.04)',
                    opacity: energy < cost && own === 0 ? 0.45 : 1,
                  }}>
                  <span className="text-xl leading-none">{s.icon || '🏭'}</span>
                  <span className="text-[10px] text-white/80 mt-1 leading-none">{s.name}</span>
                  <span className="text-[9px] font-bold mt-0.5" style={{ ...fontMono, color: '#facc15' }}>
                    {own > 0 ? `×${own} ・ ${cost}⚡` : `${cost}⚡`}
                  </span>
                </button>
                {own > 0 && (
                  <button onClick={() => demolish(type)}
                    className="text-[9px] text-white/35 hover:text-white/70 mt-0.5">
                    ♻️こわす
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-white/40 text-[10px] pb-1.5">
          {selected
            ? `👆 青いわくの中をタップして「${BUILDING_STATS[selected].name}」をおく ・ おいたものをタップではずす`
            : '⚡エナジーで施設を建てよう。今日建てた施設は、今日じゅうは どのステージでも使えるよ（明日リセット）'}
        </p>

        {onProceed && (
          <button onClick={() => { sfx.select(); onProceed(); }}
            className="w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-95 mb-1"
            style={{
              ...fontMono,
              background: 'rgba(239,68,68,0.2)', border: '2px solid #ef4444', color: '#f87171',
              boxShadow: '0 0 14px rgba(239,68,68,0.45)',
            }}>
            ⚔️ この陣地で 出撃！
          </button>
        )}
      </div>
    </div>
  );
};
