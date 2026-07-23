import React, { useState } from 'react';
import { BATTLE_MAPS } from '../../data/battleMaps';
import { BuildingType, BattleMap, DeployedBuilding, BattleLoadout, TerrainTile, GRID_SIZE } from '../../types';
import { BUILDING_STATS } from '../../constants';
import { DailyBuffsPanel } from '../learn/DailyBuffsPanel';
import { useProgressStore } from '../../store/useProgressStore';
import { sfx } from '../../utils/audioEngine';

// 戦闘前ショップ：⭐デイリースターで施設を配置。freeAllow までは無料（バランス床）。
const FACILITY_SHOP: { type: BuildingType; starCost: number; freeAllow: number }[] = [
  { type: BuildingType.WALL,      starCost: 2,  freeAllow: 4 },
  { type: BuildingType.CANNON,    starCost: 8,  freeAllow: 1 },
  { type: BuildingType.ARMY_CAMP, starCost: 10, freeAllow: 0 },
];
const shopOf = (t: BuildingType) => FACILITY_SHOP.find(f => f.type === t);
const costForRank = (type: BuildingType, rank: number): number => {
  const sh = shopOf(type);
  if (!sh) return 0;
  return rank < sh.freeAllow ? 0 : sh.starCost;
};

const TERRAIN_BG: Record<string, string> = {
  GRASS:  '#166534',
  WATER:  '#1d4ed8',
  BRIDGE: '#92400e',
  ROCK:   '#374151',
  SWAMP:  '#14532d',
};

interface Props {
  loadout: BattleLoadout;
  onStartBattle: (mapId: string, deployments: DeployedBuilding[]) => void;
  onBack: () => void;
}

function getTileType(terrain: TerrainTile[], x: number, y: number): string {
  return terrain.find(t => t.x === x && t.y === y)?.type ?? 'GRASS';
}

export const BattleSetupScreen: React.FC<Props> = ({ loadout, onStartBattle, onBack }) => {
  const [selectedMapId, setSelectedMapId] = useState(BATTLE_MAPS[0].id);
  const [deployments, setDeployments] = useState<DeployedBuilding[]>([]);
  const [buildingToPlace, setBuildingToPlace] = useState<BuildingType | null>(BuildingType.TOWN_HALL);
  const [townHallPlaced, setTownHallPlaced] = useState(false);
  const { getTodayDailyStars, spendDailyStars, addDailyStars } = useProgressStore();
  const dailyStars = getTodayDailyStars();

  const selectedMap = BATTLE_MAPS.find(m => m.id === selectedMapId)!;

  const getDeployedAt = (x: number, y: number): DeployedBuilding | undefined =>
    deployments.find(d => {
      const s = BUILDING_STATS[d.type];
      return x >= d.x && x < d.x + s.width && y >= d.y && y < d.y + s.height;
    });

  const isValidCell = (x: number, y: number): boolean => {
    const zone = selectedMap.playerDeployZone;
    if (x < zone.xMin || x > zone.xMax || y < zone.yMin || y > zone.yMax) return false;
    const ttype = getTileType(selectedMap.terrain, x, y);
    if (ttype === 'WATER' || ttype === 'ROCK') return false;
    return true;
  };

  const handleCellClick = (x: number, y: number) => {
    if (!buildingToPlace) return;
    if (!isValidCell(x, y)) return;
    const stats = BUILDING_STATS[buildingToPlace];
    // Check overlap with existing deployments and enemy buildings
    for (let dy = 0; dy < stats.height; dy++) {
      for (let dx = 0; dx < stats.width; dx++) {
        if (getDeployedAt(x + dx, y + dy)) return;
        if (!isValidCell(x + dx, y + dy)) return;
        if (selectedMap.enemyBase.some(e => e.x === x + dx && e.y === y + dy)) return;
      }
    }

    const newDeployment: DeployedBuilding = { type: buildingToPlace, x, y };
    if (buildingToPlace === BuildingType.TOWN_HALL) {
      // 城は無料・必須。既存の城を置き換える
      setDeployments(prev => [
        ...prev.filter(d => d.type !== BuildingType.TOWN_HALL),
        newDeployment,
      ]);
      setTownHallPlaced(true);
    } else {
      // ⭐コスト（freeAllow を超えたぶんだけ消費）
      const rank = deployments.filter(d => d.type === buildingToPlace).length;
      const cost = costForRank(buildingToPlace, rank);
      if (cost > 0 && !spendDailyStars(cost)) {
        sfx.incorrect();
        return; // ⭐不足
      }
      sfx.tap();
      setDeployments(prev => [...prev, newDeployment]);
    }
  };

  const handleRemove = (x: number, y: number) => {
    const d = getDeployedAt(x, y);
    if (!d) return;
    if (d.type === BuildingType.TOWN_HALL) {
      setTownHallPlaced(false);
    } else {
      // 撤去したぶんの⭐を払い戻し
      const typeList = deployments.filter(dep => dep.type === d.type);
      const idx = typeList.findIndex(dep => dep.x === d.x && dep.y === d.y);
      const refund = costForRank(d.type, idx);
      if (refund > 0) addDailyStars(refund);
    }
    setDeployments(prev => prev.filter(dep => !(dep.x === d.x && dep.y === d.y)));
  };

  // Building picker options（戦闘前ショップ）
  const pickerOptions: BuildingType[] = [BuildingType.TOWN_HALL, ...FACILITY_SHOP.map(f => f.type)];
  // 選択中タイプの「次に置くときの⭐コスト」
  const nextCostFor = (type: BuildingType): number => {
    if (type === BuildingType.TOWN_HALL) return 0;
    const rank = deployments.filter(d => d.type === type).length;
    return costForRank(type, rank);
  };

  const zone = selectedMap.playerDeployZone;
  const CELL = 30;

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-[#0a0e1a] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button
          onClick={onBack}
          className="text-white/50 hover:text-white text-sm"
          style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
        >
          ← もどる
        </button>
        <h2
          className="text-[#22d3ee] font-bold text-base"
          style={{ fontFamily: 'Orbitron, monospace' }}
        >
          作戦立案
        </h2>
      </div>

      {/* Map selector */}
      <div className="flex gap-3 px-4 pt-3 pb-2 overflow-x-auto">
        {BATTLE_MAPS.map(m => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMapId(m.id);
              setDeployments([]);
              setTownHallPlaced(false);
            }}
            className={`flex-shrink-0 p-3 rounded-xl border-2 min-w-[120px] text-left transition-all
              ${
                selectedMapId === m.id
                  ? 'border-[#22d3ee] bg-[#22d3ee]/10'
                  : 'border-white/10 bg-white/5'
              }`}
          >
            <div
              className="font-bold text-sm text-white"
              style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
            >
              {m.name}
            </div>
            <div
              className="text-white/40 text-xs mt-1 leading-tight"
              style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
            >
              {m.description}
            </div>
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div
        className="px-4 py-2 text-xs flex items-center gap-3"
        style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
      >
        <span className="text-white/40"><span className="text-[#a3e635]">緑ゾーン</span>に コア（🏰）と拠点施設を構築しよう</span>
        <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)' }}>
          <span>⭐</span>
          <span className="text-[#facc15] font-bold" style={{ fontFamily: 'Orbitron, monospace' }}>{dailyStars}</span>
        </span>
      </div>

      {/* Battle grid - flat top-down view */}
      <div className="flex-1 flex items-start justify-center px-2 pb-2 overflow-auto">
        <div
          style={{
            position: 'relative',
            width: GRID_SIZE * CELL,
            height: GRID_SIZE * CELL,
            flexShrink: 0,
          }}
        >
          {Array.from({ length: GRID_SIZE }, (_, y) =>
            Array.from({ length: GRID_SIZE }, (_, x) => {
              const ttype = getTileType(selectedMap.terrain, x, y);
              const inZone =
                x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax;
              const enemyB = selectedMap.enemyBase.find(e => {
                const s = BUILDING_STATS[e.type];
                return x >= e.x && x < e.x + s.width && y >= e.y && y < e.y + s.height;
              });
              const deployed = getDeployedAt(x, y);
              const isTopLeft = deployed && deployed.x === x && deployed.y === y;

              const bgColor = TERRAIN_BG[ttype] ?? TERRAIN_BG.GRASS;
              const borderColor =
                inZone && ttype !== 'WATER' && ttype !== 'ROCK'
                  ? 'rgba(74,222,128,0.3)'
                  : 'rgba(255,255,255,0.05)';
              const isClickable =
                inZone && ttype !== 'WATER' && ttype !== 'ROCK';

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={() => {
                    if (deployed) {
                      handleRemove(x, y);
                      return;
                    }
                    if (isClickable) handleCellClick(x, y);
                  }}
                  style={{
                    position: 'absolute',
                    left: x * CELL,
                    top: y * CELL,
                    width: CELL,
                    height: CELL,
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                >
                  {/* Enemy buildings (dimmed) */}
                  {enemyB && !deployed && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.5,
                        fontSize: 14,
                      }}
                    >
                      {BUILDING_STATS[enemyB.type].icon}
                    </div>
                  )}
                  {/* Player deployments */}
                  {isTopLeft && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        background: 'rgba(34,211,238,0.2)',
                        border: '2px solid #22d3ee',
                        borderRadius: 4,
                      }}
                    >
                      {BUILDING_STATS[deployed!.type].icon}
                    </div>
                  )}
                  {/* Terrain label for bridge */}
                  {ttype === 'BRIDGE' && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: '#fef3c7',
                      }}
                    >
                      橋
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Daily Buffs (compact) */}
      <div className="border-t border-white/10 px-3 pt-3" style={{ background: 'rgba(10,14,26,0.95)' }}>
        <DailyBuffsPanel compact />
      </div>

      {/* Building picker */}
      <div className="border-t border-white/10 px-3 pt-3" style={{ background: 'rgba(10,14,26,0.95)', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
          {pickerOptions.map(type => {
            const isTH = type === BuildingType.TOWN_HALL;
            const cost = nextCostFor(type);
            const tooPoor = !isTH && cost > 0 && dailyStars < cost;
            return (
              <button
                key={type}
                onClick={() => setBuildingToPlace(buildingToPlace === type ? null : type)}
                disabled={tooPoor}
                className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl border-2 min-w-[64px] transition-all
                  ${
                    buildingToPlace === type
                      ? 'border-[#22d3ee] bg-[#22d3ee]/20'
                      : 'border-white/20 bg-white/5'
                  }
                  ${tooPoor ? 'opacity-30' : ''}`}
              >
                <span className="text-2xl">{BUILDING_STATS[type].icon === '' ? '🧱' : BUILDING_STATS[type].icon}</span>
                <span
                  className="text-[10px] text-white/70 mt-1 leading-none"
                  style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
                >
                  {BUILDING_STATS[type].name}
                </span>
                <span className="text-[9px] font-bold mt-0.5" style={{ fontFamily: 'Orbitron, monospace', color: isTH || cost === 0 ? '#a3e635' : '#facc15' }}>
                  {isTH ? '必須' : cost === 0 ? 'むりょう' : `${cost}⭐`}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onStartBattle(selectedMapId, deployments)}
          disabled={!townHallPlaced}
          className="w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Orbitron, monospace',
            background: townHallPlaced ? 'rgba(239,68,68,0.2)' : 'transparent',
            border: `2px solid ${townHallPlaced ? '#ef4444' : '#6b7280'}`,
            color: townHallPlaced ? '#ef4444' : '#6b7280',
            boxShadow: townHallPlaced ? '0 0 12px #ef4444' : 'none',
          }}
        >
          {townHallPlaced ? '⚔️ 出撃！' : '🏰 まずコアを配置してください'}
        </button>
      </div>
    </div>
  );
};
