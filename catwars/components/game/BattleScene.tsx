import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GameState, Troop, BuildingType, BattleEntity, GRID_W, GRID_H } from '../../types';
import { BUILDING_STATS } from '../../constants';
import { Button } from '../ui/Button';
import { Swords, Trophy, Skull, Zap, Heart } from '../ui/Icons';
import { buildTerrainCostMap, findPathWithTerrain, TerrainCostMap } from '../../utils/aiEngine';
import { SeededRNG } from '../../utils/random';
import { TerrainLayer } from './TerrainLayer';
import { InBattleQuiz } from './InBattleQuiz';
import { sfx } from '../../utils/audioEngine';
import { useProgressStore, BUFF_LEVEL_INFO } from '../../store/useProgressStore';
import { useArmyStore } from '../../store/useArmyStore';
import { CHARACTERS, CHARACTER_BY_ID, STAGE_MULT, getCharacterSprite, spriteFamilyForSubType, stageForLevel } from '../../data/characters';
import { PinchZoomLayer } from './PinchZoomLayer';
import { CampaignChapter, ChapterDifficulty, ENEMY_UNIT_STATS, ASSIST_LEVELS, EnemyUnitKind } from '../../data/campaign';
import { collectWallCells, hasLineOfSight, isFlying, pickDefenseTarget } from '../../utils/combatRules';
import {
  ALIEN_STATS, LAVA_DPS, MeteorState, collectLavaCells, isOnLava,
  makeAlienEntity, makeTitanEntity, stepTitan,
} from '../../utils/stageHazards';

const IN_BATTLE_BUILD_COSTS: Partial<Record<BuildingType, number>> = {
  [BuildingType.WALL]: 40,
  [BuildingType.CANNON]: 120,
  [BuildingType.ARMY_CAMP]: 80,
};
const IN_BATTLE_BUILD_OPTIONS: BuildingType[] = [BuildingType.WALL, BuildingType.CANNON, BuildingType.ARMY_CAMP];

// 兵士subType + 進化段階 → スプライトURL（図鑑系統にマップ）
const troopSpriteUrl = (subType: string, stage: 1 | 2 | 3 = 1): string | null => {
  const fam = spriteFamilyForSubType(subType);
  return fam ? getCharacterSprite(fam, stage) : null;
};

// Humanoid high-contrast stick figure SVG renderer with micro limb-swinging animations
const renderStickFigure = (subType: string, isMoving: boolean, lastAttack: number) => {
  const now = Date.now();
  const isAttacking = now - lastAttack < 400;
  
  let headColor = "#fcd34d"; // barb blonde
  let skinColor = "#fbcfe8"; // skin node
  let strokeColor = "#ffffff"; 
  let clothesColor = "#dc2626"; // Crimson
  let strokeWidth = "2.2";
  let bodyWidth = "2.8";

  // Customize based on role cards
  if (subType === 'archer') {
    headColor = "#ec4899"; // pink archer hair
    clothesColor = "#059669"; // green outfit
    strokeWidth = "2.0";
  } else if (subType === 'giant') {
    headColor = "#f97316"; // orange hair/beard
    clothesColor = "#7c2d12"; // brown leather vest
    strokeWidth = "3.5"; // extra thick outline for giant
    bodyWidth = "4.5";
  } else if (subType === 'skeleton') {
    headColor = "#cbd5e1"; // skull slate
    clothesColor = "#1e3a8a"; // deep blue military vest
    strokeWidth = "1.8";
    strokeColor = "#94a3b8"; // bone color
    bodyWidth = "2.0";
  }

  const legLClass = isMoving ? "anim-leg-L" : "";
  const legRClass = isMoving ? "anim-leg-R" : "";
  const headClass = isMoving ? "anim-head" : "";
  
  let armRClass = "";
  if (isAttacking) {
    if (subType === 'barbarian') armRClass = "anim-attack-sword";
    else if (subType === 'archer') armRClass = "anim-attack-bow";
    else if (subType === 'skeleton') armRClass = "anim-attack-sword";
    else armRClass = "anim-attack-fist";
  } else if (isMoving) {
    armRClass = "anim-leg-R";
  }

  const armLClass = isMoving ? "anim-leg-L" : "";

  return (
    <svg viewBox="0 0 40 46" className="w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
      {/* Torso/Clothes (back bone) */}
      <line 
        x1="20" y1="18" 
        x2="20" y2="30" 
        stroke={clothesColor} 
        strokeWidth={bodyWidth} 
        strokeLinecap="round" 
      />

      {/* Head */}
      <g className={headClass} style={{ transformOrigin: "20px 14px" }}>
        {/* Face circle */}
        <circle 
          cx="20" cy="12" r="5" 
          fill={subType === 'skeleton' ? '#475569' : '#fee2e2'} 
          stroke={strokeColor} 
          strokeWidth="1.2" 
        />
        {/* Hair shape */}
        {subType === 'barbarian' && (
          <path d="M 15 12 A 4 4 0 0 1 25 12" fill={headColor} />
        )}
        {subType === 'archer' && (
          <path d="M 14 14 A 5 5 0 0 1 26 14" fill={headColor} fillOpacity="0.85" />
        )}
        {subType === 'giant' && (
          <path d="M 13 10 A 6 6 0 0 1 27 10" fill={headColor} />
        )}
      </g>

      {/* Left Arm */}
      <line 
         x1="20" y1="18" 
         x2="12" y2="24" 
         stroke={strokeColor} 
         strokeWidth={strokeWidth} 
         strokeLinecap="round"
         className={armLClass}
         style={{ transformOrigin: "20px 18px" }}
      />

      {/* Left Leg */}
      <line 
         x1="20" y1="30" 
         x2="14" y2="42" 
         stroke={strokeColor} 
         strokeWidth={strokeWidth} 
         strokeLinecap="round"
         className={legLClass}
         style={{ transformOrigin: "20px 30px" }}
      />

      {/* Right Leg */}
      <line 
         x1="20" y1="30" 
         x2="26" y2="42" 
         stroke={strokeColor} 
         strokeWidth={strokeWidth} 
         strokeLinecap="round"
         className={legRClass}
         style={{ transformOrigin: "20px 30px" }}
      />

      {/* Right Arm & Weapon Group */}
      <g 
        className={armRClass} 
        style={{ transformOrigin: "20px 18px" }}
      >
        {/* Right Arm */}
        <line 
           x1="20" y1="18" 
           x2="28" y2="24" 
           stroke={strokeColor} 
           strokeWidth={strokeWidth} 
           strokeLinecap="round"
        />

        {/* Custom Weapons representing roles */}
        {(subType === 'barbarian' || subType === 'skeleton') && (
          <g transform="translate(28, 24) rotate(45)">
            <line x1="0" y1="0" x2="0" y2="-12" stroke={subType === 'skeleton' ? '#94a3b8' : '#cbd5e1'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-3" y1="-3" x2="3" y2="-3" stroke={subType === 'skeleton' ? '#475569' : '#eab308'} strokeWidth="1.5" />
          </g>
        )}

        {subType === 'archer' && (
          <g transform="translate(28, 24)">
            {/* Bow */}
            <path d="M -2 -6 Q 4 0 -2 6" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
            {/* Bow String */}
            <line x1="-2" y1="-6" x2="-2" y2="6" stroke="#94a3b8" strokeWidth="0.8" />
            {/* Arrow */}
            <line x1="-4" y1="0" x2="3" y2="0" stroke="#f472b6" strokeWidth="1" />
          </g>
        )}

        {subType === 'giant' && (
          <circle cx="28" cy="24" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
        )}
      </g>
    </svg>
  );
};

interface Props {
  attackerState: GameState;
  defenderBuildings: { type: BuildingType; x: number; y: number }[];
  playerDeployments?: import('../../types').DeployedBuilding[];
  battleMap?: import('../../types').BattleMap;
  loadout?: import('../../types').BattleLoadout;
  /** 挑戦中の章（ストーリー表示・報酬に使う） */
  chapter: CampaignChapter;
  /** サポートモードを反映ずみの実効難易度 */
  difficulty: ChapterDifficulty;
  /** 0=通常 / 1,2=サポートモード（プレイヤーに明示する） */
  assistLevel?: 0 | 1 | 2;
  /** 出撃前に選んだ出題範囲（戦闘中クイズで使う。空なら「といて⚡」は無効） */
  quizSubtopics?: string[];
  onEndBattle: (win: boolean, loot: { gold: number }) => void;
}

export const BattleScene: React.FC<Props> = ({
  attackerState,
  defenderBuildings,
  playerDeployments = [],
  battleMap,
  loadout,
  chapter,
  difficulty,
  assistLevel = 0,
  quizSubtopics = [],
  onEndBattle,
}) => {
  const [entities, setEntities] = useState<BattleEntity[]>([]);
  const [selectedTroopId, setSelectedTroopId] = useState<string | null>(null);
  const [availableTroops, setAvailableTroops] = useState<Troop[]>([]);
  const [battleStarted, setBattleStarted] = useState(false);
  const [battleResult, setBattleResult] = useState<'WIN' | 'LOSE' | null>(null);
  
  // Interactive Active Spells
  const [selectedSpell, setSelectedSpell] = useState<'HEAL' | 'RAGE' | null>(null);
  // 呪文の所持数は拠点の規模（loadout）で決まる ＝ 拠点づくりが戦闘に効く導線のひとつ
  const [spellCounts, setSpellCounts] = useState(() => ({
    HEAL: loadout?.healCharges ?? 2,
    RAGE: loadout?.rageCharges ?? 2,
  }));
  // 開戦前のストーリーブリーフィング（②）
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [activeSpells, setActiveSpells] = useState<{ id: string; x: number; y: number; type: 'HEAL' | 'RAGE'; endTime: number }[]>([]);

  // Projectiles
  const [projectiles, setProjectiles] = useState<{ id: string; fromX: number; fromY: number; toX: number; toY: number; startedAt: number; duration: number; type: 'CANNON' | 'TESLA' }[]>([]);
  // 兵士の攻撃エフェクト（攻撃タイプごとに見た目を変える）。SLASH=斬撃, BOLT=遠距離, SHOCK=巨人/ボスの衝撃
  const [hitFx, setHitFx] = useState<{ id: string; x: number; y: number; fromX: number; fromY: number; kind: 'SLASH' | 'BOLT' | 'SHOCK'; color: string; startedAt: number; duration: number }[]>([]);

  // Sensory Juice States
  const [damagedEntities, setDamagedEntities] = useState<Set<string>>(new Set());
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const [battlePaused, setBattlePaused] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [selectedOrderTroopId, setSelectedOrderTroopId] = useState<string | null>(null);
  const terrainCostsRef = useRef<TerrainCostMap>(new Map());

  const { getTodayBuffs, unlockCharacterToday, permanentUnlocks, unlockedToday, unlockedTodayDate } = useProgressStore();
  const { getStage, grantBattleXp } = useArmyStore();
  const activeBuffs = getTodayBuffs();
  const hasBuff = (t: string) => activeBuffs.some(b => b.type === t);
  // バフのレベル（0=無効, 1=小, 2=中, 3=大）
  const buffLvl = (t: string): 0 | 1 | 2 | 3 => {
    const b = activeBuffs.find(b => b.type === t);
    if (!b) return 0;
    return ((b as { level?: number }).level ?? 2) as 0 | 1 | 2 | 3;
  };
  // バフの現在レベルの効果量（小/中/大の数値）。無効なら0。
  const buffVal = (t: string): number => {
    const lv = buffLvl(t);
    if (lv === 0) return 0;
    const info = (BUFF_LEVEL_INFO as Record<string, { values: number[] }>)[t];
    return info ? info.values[lv - 1] : 0;
  };

  // ── 戦闘中ゴールド（にゃんこ式・このバトル内だけの通貨）──
  const [gold, setGold] = useState(0);
  const lastGoldTickRef = useRef(0);
  const goldKillRef = useRef(0);                               // 撃破・破壊で得たゴールドのバッファ
  const deployCdRef = useRef<Record<string, number>>({});      // 系統ごとの出撃クールダウン
  const [, forceTick] = useState(0);                            // CD表示の再描画用
  // この戦闘で出撃した系統（XP付与用）
  const deployedFamiliesRef = useRef<Set<string>>(new Set());

  // 一時ランクアップ（戦闘中ゴールドで購入。このバトル中だけ +1段階相当）
  const [tempRank, setTempRank] = useState<Record<string, number>>({});

  const [buildMode, setBuildMode] = useState<BuildingType | null>(null);

  const rngRef = useRef(new SeededRNG(12345));
  const obstaclesRef = useRef<Set<string>>(new Set());
  const gameLoopRef = useRef<number | undefined>(undefined);
  const skeletonsSpawnedRef = useRef(false);
  const lastEnemySpawnRef = useRef(0);
  const enemyWaveRef = useRef(0);
  const bossSpawnedRef = useRef(false);
  // ── ステージギミックの状態 ──
  const lavaCellsRef = useRef<Set<string>>(new Set());
  const lastLavaTickRef = useRef(0);
  const [meteors, setMeteors] = useState<MeteorState[]>([]);
  const meteorsRef = useRef<MeteorState[]>([]);
  const lastMeteorRef = useRef<Record<number, number>>({});
  const lastAlienRef = useRef<Record<number, number>>({});
  const titanDirRef = useRef<1 | -1>(1);
  const lastFrameRef = useRef(0);
  // 防衛施設の「照準」状態: 施設ID → { targetId, lockedAt }。
  // 標的を変えるたびに aimTimeMs ぶんの予告時間を挟むための記録（⑥ 反応の余地）。
  const aimRef = useRef<Record<string, { targetId: string; lockedAt: number }>>({});
  const wallCellsRef = useRef<Set<string>>(new Set());
  // 壁を無視して進む飛行系のための、壁を含まない障害物セット
  const obstaclesNoWallRef = useRef<Set<string>>(new Set());
  const lastHealRef = useRef(0);
  const xpGrantedRef = useRef(false);
  const [levelUps, setLevelUps] = useState<import('../../store/useArmyStore').LevelUpEvent[]>([]);

  // Initialize cells
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      cells.push({ x, y });
    }
  }

  useEffect(() => {
    rngRef.current = new SeededRNG(Date.now()); 

    const defenseEntities: BattleEntity[] = defenderBuildings.map((b, i) => {
      const stats = BUILDING_STATS[b.type];
      for(let dy=0; dy<stats.height; dy++) {
        for(let dx=0; dx<stats.width; dx++) {
          obstaclesRef.current.add(`${b.x + dx},${b.y + dy}`);
        }
      }

      // 章ごとの難易度倍率を敵の防衛設備へ適用（⑤ 段階的な難易度設計の実体）
      const hp = Math.round(stats.hp * difficulty.defenseHpMult);
      const dmg = Math.round((stats.damage ?? 0) * difficulty.defenseDamageMult);

      return {
        id: `def-${i}`,
        type: 'BUILDING',
        subType: b.type,
        x: b.x,
        y: b.y,
        hp,
        maxHp: hp,
        damage: dmg,
        team: 'DEFENDER',
        attackRange: stats.range || 0,
        attackSpeed: stats.attackSpeed ?? 1000,
        lastAttack: 0,
        moveSpeed: 0,
        targetPreference: 'ANY',
        isHidden: b.type === BuildingType.HIDDEN_TESLA
      };
    });

    // 地形コストマップを構築
    if (battleMap) {
      terrainCostsRef.current = buildTerrainCostMap(battleMap.terrain);
      // 通行不可地形をobstaclesに追加（溶岩は「通れるが痛い」ので障害物にはしない）
      battleMap.terrain.forEach(tile => {
        if (tile.type === 'WATER' || tile.type === 'ROCK') {
          obstaclesRef.current.add(`${tile.x},${tile.y}`);
        }
      });
      lavaCellsRef.current = collectLavaCells(battleMap.terrain);
    }

    // プレイヤー配置施設（ATTACKER_BUILDING）をentitiesに追加
    const playerBuildingEntities: BattleEntity[] = playerDeployments.map(b => {
      const stats = BUILDING_STATS[b.type];
      return {
        id: `player-b-${b.x}-${b.y}`,
        type: 'BUILDING' as const,
        subType: b.type,
        x: b.x,
        y: b.y,
        hp: stats.hp,
        maxHp: stats.hp,
        damage: stats.damage ?? 0,
        team: 'ATTACKER_BUILDING' as const,
        attackRange: stats.range ?? 0,
        attackSpeed: stats.attackSpeed ?? 1500,
        lastAttack: 0,
        moveSpeed: 0,
        targetPreference: 'ANY' as const,
      };
    });

    // 巨大生物（中立）を配置。開始時から盤面にいて、決まった経路を往復する。
    const titanEntities: BattleEntity[] = battleMap?.titan
      ? [makeTitanEntity(battleMap.titan, 'titan-1')]
      : [];

    setEntities([...defenseEntities, ...playerBuildingEntities, ...titanEntities]);
    // ロスター＝出撃できる系統一覧（にゃんこ式：ゴールドを払って何度でも出せる）
    const roster: Troop[] = CHARACTERS.map(c => ({
      id: c.id, name: c.forms[0].name, count: 1,
      damage: c.base.damage, hp: c.base.hp, target: c.base.target, moveSpeed: c.base.moveSpeed,
    }));
    setAvailableTroops(roster);

    // 戦闘開始時ゴールド。章ごとの `startEnergy` を土台にバフを上乗せする。
    // 旧実装は 0 スタート＋1⚡/秒だったため、最初のネコを出すまで30秒待たされた。
    // 開始直後に「まず動かせる」ことは初期エンゲージメントの前提条件（⑤）。
    let startGold = difficulty.startEnergy;
    startGold += buffVal('GOLD_RUSH');
    startGold += buffVal('EXTRA_TROOPS');
    startGold += buffVal('WIZARD_SUPPORT');
    startGold += buffVal('DRAGON_SUMMON');
    setGold(startGold);
    lastGoldTickRef.current = Date.now();
  }, []);

  // 戦闘終了時：出撃した系統にXPを付与し、レベルアップ/進化を集計
  useEffect(() => {
    if (!battleResult || xpGrantedRef.current) return;
    xpGrantedRef.current = true;
    const families: string[] = Array.from(deployedFamiliesRef.current);
    if (families.length > 0) {
      const events = grantBattleXp(families, battleResult === 'WIN');
      if (events.length > 0) setLevelUps(events);
    }
  }, [battleResult]);

  // 兵士エンティティを生成（図鑑の系統ベース + 進化段階 + デイリーバフ）
  const makeAttacker = (t: Troop, px: number, py: number): BattleEntity => {
    const fam = CHARACTER_BY_ID[t.id];
    const stage = getStage(t.id);
    const mult = STAGE_MULT[stage];

    let spawnHp = (fam ? fam.base.hp : t.hp) * mult.hp;
    let spawnDamage = (fam ? fam.base.damage : t.damage) * mult.dmg;
    let spawnRange = fam ? fam.base.attackRange : 1.2;
    let spawnSpeed = fam ? fam.base.moveSpeed : t.moveSpeed;
    let spawnAttackSpeed = fam ? fam.base.attackSpeed : 1000;

    // デイリーバフ
    if (hasBuff('POWER_BOOST')) spawnDamage *= 1 + buffVal('POWER_BOOST') / 100;
    if (hasBuff('ARMAGEDDON')) spawnDamage *= 1 + buffVal('ARMAGEDDON') / 100;
    if (hasBuff('SWIFT_ARMY')) spawnSpeed *= 1 + buffVal('SWIFT_ARMY') / 100;
    if (hasBuff('GENIUS_COMMANDER')) { const v = buffVal('GENIUS_COMMANDER') / 100; spawnDamage *= 1 + v; spawnHp *= 1 + v; }
    if (t.id === 'barbarian' && hasBuff('RARE_BARBARIAN')) { const v = buffVal('RARE_BARBARIAN') / 100; spawnHp *= 1 + v; spawnDamage *= 1 + v; }
    if (t.id === 'archer' && hasBuff('RARE_ARCHER')) { const v = buffVal('RARE_ARCHER') / 100; spawnRange += v * 3; spawnAttackSpeed *= 1 - v * 0.5; }
    if (t.id === 'giant' && hasBuff('GIANT_FORTRESS')) spawnHp *= 1 + buffVal('GIANT_FORTRESS') / 100;

    // 一時ランクアップ（戦闘中ゴールドで購入）：1ランクにつき HP・攻撃 +25%
    const tr = tempRank[t.id] ?? 0;
    if (tr > 0) { spawnHp *= 1 + 0.25 * tr; spawnDamage *= 1 + 0.25 * tr; }

    return {
      id: `atk-${Date.now()}-${rngRef.current.next()}`,
      type: 'TROOP',
      subType: t.id,
      x: px,
      y: py,
      hp: Math.round(spawnHp),
      maxHp: Math.round(spawnHp),
      damage: Math.round(spawnDamage),
      team: 'ATTACKER',
      attackRange: spawnRange,
      attackSpeed: Math.round(spawnAttackSpeed),
      lastAttack: 0,
      moveSpeed: spawnSpeed,
      targetPreference: t.target,
      path: [],
    };
  };

  // Deploying troops
  // 出撃可能エリア判定: 自陣ゾーン内、または自分の城/キャンプの周囲のみ
  const canDeployAt = (x: number, y: number): boolean => {
    const zone = battleMap?.playerDeployZone;
    if (zone && x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax) return true;
    // 城・キャンプの周囲 半径2.5
    const R = 2.5;
    return playerDeployments.some(b => {
      if (b.type !== BuildingType.TOWN_HALL && b.type !== BuildingType.ARMY_CAMP) return false;
      const s = BUILDING_STATS[b.type];
      const cx = b.x + s.width / 2;
      const cy = b.y + s.height / 2;
      return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R + Math.max(s.width, s.height) / 2;
    });
  };

  const spawnTroop = (x: number, y: number) => {
    if (!selectedTroopId || battleResult) return;
    if (obstaclesRef.current.has(`${x},${y}`)) return;
    if (!canDeployAt(x, y)) {
      setTriggerMessage('⛔ ここには出せないよ！ お城やキャンプの近くから出そう');
      setTimeout(() => setTriggerMessage(null), 1800);
      return;
    }

    const fam = CHARACTER_BY_ID[selectedTroopId];
    if (!fam) return;
    const cost = Math.round(fam.cost.gold * (1 - buffVal('COST_REDUCTION') / 100));
    const cd = hasBuff('FAST_DEPLOY') ? Math.round(1500 * (1 - buffVal('FAST_DEPLOY') / 100)) : 1500;
    const now = Date.now();
    if (now - (deployCdRef.current[selectedTroopId] ?? 0) < cd) return; // クールダウン中
    if (gold < cost) {
      setTriggerMessage('⚡ エナジーがたりない！ 問題を解くか、待ってためよう');
      setTimeout(() => setTriggerMessage(null), 1600);
      return;
    }

    const base = availableTroops.find(t => t.id === selectedTroopId) ?? {
      id: fam.id, name: fam.forms[0].name, count: 1,
      damage: fam.base.damage, hp: fam.base.hp, target: fam.base.target, moveSpeed: fam.base.moveSpeed,
    };
    const jitterX = (rngRef.current.next() - 0.5) * 0.4;
    const jitterY = (rngRef.current.next() - 0.5) * 0.4;
    const spawned = makeAttacker(base, x + jitterX, y + jitterY);

    setGold(g => g - cost);
    deployCdRef.current[selectedTroopId] = now;
    deployedFamiliesRef.current.add(selectedTroopId);
    setEntities(prev => [...prev, spawned]);
    setBattleStarted(true);
    sfx.deploy();
    forceTick(n => n + 1);
  };

  // Click on the battlefield grid: Handles spell placement, move-to orders, or troop spawn
  const handleGridClick = (x: number, y: number) => {
    if (battleResult) return;

    // ── 戦闘中施設配置 ──
    if (buildMode !== null) {
      const bCost = IN_BATTLE_BUILD_COSTS[buildMode] ?? 999;
      if (Math.floor(gold) < bCost) {
        setTriggerMessage('⚡ エナジーがたりない！');
        setTimeout(() => setTriggerMessage(null), 1400);
        setBuildMode(null);
        return;
      }
      if (!canDeployAt(x, y)) {
        setTriggerMessage('⛔ ここには建設できない！お城の近くに置こう');
        setTimeout(() => setTriggerMessage(null), 1600);
        setBuildMode(null);
        return;
      }
      // Check for overlaps with existing entities
      const stats = BUILDING_STATS[buildMode];
      const occupied = entities.some(e =>
        e.type === 'BUILDING' &&
        e.x < x + stats.width && e.x + (BUILDING_STATS[e.subType as BuildingType]?.width ?? 1) > x &&
        e.y < y + stats.height && e.y + (BUILDING_STATS[e.subType as BuildingType]?.height ?? 1) > y
      );
      if (occupied) {
        setTriggerMessage('⛔ そこには置けないよ！別の場所を選んで');
        setTimeout(() => setTriggerMessage(null), 1600);
        setBuildMode(null);
        return;
      }
      const newBuilding: BattleEntity = {
        id: `battle-b-${Date.now()}-${x}-${y}`,
        type: 'BUILDING',
        subType: buildMode,
        x, y,
        hp: BUILDING_STATS[buildMode].hp,
        maxHp: BUILDING_STATS[buildMode].hp,
        damage: BUILDING_STATS[buildMode].damage ?? 0,
        team: 'ATTACKER_BUILDING',
        attackRange: BUILDING_STATS[buildMode].range ?? 0,
        attackSpeed: 1500,
        lastAttack: 0,
        moveSpeed: 0,
        targetPreference: 'ANY',
      };
      setGold(g => g - bCost);
      setEntities(prev => [...prev, newBuilding]);
      sfx.tap();
      setTriggerMessage(`🏗️ ${BUILDING_STATS[buildMode].name}を建設した！（${bCost}⚡）`);
      setTimeout(() => setTriggerMessage(null), 1600);
      setBuildMode(null);
      return;
    }

    if (selectedSpell) {
      if (spellCounts[selectedSpell] <= 0) return;

      const newSpell = {
        id: `spell-${Date.now()}`,
        x,
        y,
        type: selectedSpell,
        endTime: Date.now() + 6000
      };

      setActiveSpells(prev => [...prev, newSpell]);
      setSpellCounts(prev => ({ ...prev, [selectedSpell]: prev[selectedSpell] - 1 }));
      setSelectedSpell(null);
      setBattleStarted(true);

      setTriggerMessage(selectedSpell === 'HEAL' ? "💚 【回復の呪文】を発動！味方部隊のHPを持続回復します" : "💜 【レイジの呪文】を発動！味方の攻撃・移動をブースト！");
      setTimeout(() => setTriggerMessage(null), 2500);
      return;
    }

    // Move-to order: redirect a selected troop to clicked location
    if (selectedOrderTroopId && !obstaclesRef.current.has(`${x},${y}`)) {
      setEntities(prev => prev.map(e =>
        e.id === selectedOrderTroopId
          ? { ...e, customTarget: { x, y }, path: [], targetPreference: 'MOVE_TO' }
          : e
      ));
      setSelectedOrderTroopId(null);
      setTriggerMessage("📍 移動命令を発令！");
      setTimeout(() => setTriggerMessage(null), 1500);
      return;
    }

    spawnTroop(x, y);
  };

  // Main game tick function
  const updateBattle = useCallback(() => {
    // 戦闘一時停止中はスキップ
    if (battlePaused) {
      gameLoopRef.current = requestAnimationFrame(updateBattle);
      return;
    }

    const now = Date.now();

    // ── 戦闘中ゴールド：城のパッシブ湧き＋金鉱＋撃破/破壊報酬 ──
    if (!battleResult) {
      const since = now - lastGoldTickRef.current;
      if (since >= 400) {
        lastGoldTickRef.current = now;
        let rate = difficulty.energyPerSec;               // 城の自動湧き（章ごとに設定）
        if (hasBuff('GOLD_BOOST')) rate *= 1 + buffVal('GOLD_BOOST') / 100;
        const inc = rate * (since / 1000) + goldKillRef.current;
        goldKillRef.current = 0;
        if (inc > 0) setGold(g => Math.min(9999, g + inc));
      }
    }

    // Clean up expired projectiles / attack effects from state
    setProjectiles(prev => prev.filter(p => now - p.startedAt < p.duration));
    setHitFx(prev => prev.filter(f => now - f.startedAt < f.duration));

    // ── 流星の予告をスケジュールする（着弾の damage 適用は setEntities の中で行う）──
    if (battleStarted && !battleResult && battleMap?.meteorZones) {
      let changed = false;
      battleMap.meteorZones.forEach((z, i) => {
        const last = lastMeteorRef.current[i] ?? now;
        if (lastMeteorRef.current[i] === undefined) { lastMeteorRef.current[i] = now; return; }
        if (now - last > z.intervalMs) {
          lastMeteorRef.current[i] = now;
          meteorsRef.current.push({
            id: `met-${i}-${now}`, zone: z,
            warnedAt: now, impactAt: now + z.warningMs, resolved: false,
          });
          changed = true;
        }
      });
      // 着弾から600ms たったものは表示から消す
      const before = meteorsRef.current.length;
      meteorsRef.current = meteorsRef.current.filter(m => now - m.impactAt < 600);
      if (changed || meteorsRef.current.length !== before) setMeteors([...meteorsRef.current]);
    }

    setEntities(prevEntities => {
      const mapped = prevEntities.map(e => ({ ...e }));
      // 撃破/破壊報酬（前フレームでHP0になった敵を集計）
      mapped.forEach(e => {
        if (e.hp <= 0 && e.team === 'DEFENDER') {
          goldKillRef.current += e.type === 'BUILDING' ? 30 : 8;
        }
        if (e.hp <= 0 && e.type === 'BUILDING') {
          sfx.explosion();
        }
      });
      const nextEntities = mapped.filter(e => e.hp > 0);

      // HEAL_AURA バフ：3秒ごとに自軍兵士のHPを5%回復
      if (hasBuff('HEAL_AURA') && now - lastHealRef.current > 3000) {
        lastHealRef.current = now;
        nextEntities.forEach(e => {
          if (e.team === 'ATTACKER' && e.type === 'TROOP' && e.hp > 0 && e.hp < e.maxHp) {
            e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (buffVal('HEAL_AURA') / 100));
          }
        });
      }

      const attackers = nextEntities.filter(e => e.team === 'ATTACKER');
      const defenders = nextEntities.filter(e => e.team === 'DEFENDER');

      // Win vs Loss evaluation
      const minTroopCost = Math.min(...CHARACTERS.map(c => c.cost.gold));
      if (battleStarted && attackers.length === 0 && Math.floor(gold) < minTroopCost) {
        sfx.battleLose();
        setBattleResult('LOSE');
      }

      // 敵の Town Hall が破壊されたら WIN
      const enemyTownHallExists = defenders.some(
        e => e.type === 'BUILDING' && e.subType === BuildingType.TOWN_HALL && e.hp > 0
      );
      if (battleStarted && !enemyTownHallExists && defenders.filter(e => e.type === 'BUILDING').length > 0) {
        sfx.battleWin();
        setBattleResult('WIN');
      }

      // 自軍 Town Hall が破壊されたら LOSE
      const playerTownHallDestroyed = nextEntities.some(
        e => e.team === 'ATTACKER_BUILDING' && e.subType === BuildingType.TOWN_HALL && e.hp <= 0
      );
      if (battleStarted && playerTownHallDestroyed) {
        sfx.battleLose();
        setBattleResult('LOSE');
      }

      // Check breakthrough for Skeletons Trap spawn from Town Hall
      const townHall = defenders.find(d => d.subType === 'TOWN_HALL');
      if (townHall && !skeletonsSpawnedRef.current) {
        const nearAttacker = attackers.some(a => {
           const dist = Math.sqrt(Math.pow(a.x - townHall.x, 2) + Math.pow(a.y - townHall.y, 2));
           return dist < 3.5;
        });
        if (nearAttacker) {
           skeletonsSpawnedRef.current = true;
           setTriggerMessage("⚠️ 警告: 敵のTownHall防衛兵（スケルトンガード）が２体覚醒し突撃してきた！");
           setTimeout(() => setTriggerMessage(null), 3500);

           const skel1: BattleEntity = {
              id: `ske-${Date.now()}-1`,
              type: 'TROOP',
              subType: 'skeleton',
              x: townHall.x,
              y: townHall.y + 1,
              hp: 55,
              maxHp: 55,
              damage: 14,
              team: 'DEFENDER',
              attackRange: 1.1,
              attackSpeed: 950,
              lastAttack: 0,
              moveSpeed: 2.1,
              targetPreference: 'ANY',
              path: []
           };

           const skel2: BattleEntity = {
              id: `ske-${Date.now()}-2`,
              type: 'TROOP',
              subType: 'skeleton',
              x: townHall.x + 1,
              y: townHall.y,
              hp: 55,
              maxHp: 55,
              damage: 14,
              team: 'DEFENDER',
              attackRange: 1.1,
              attackSpeed: 950,
              lastAttack: 0,
              moveSpeed: 2.1,
              targetPreference: 'ANY',
              path: []
           };

           nextEntities.push(skel1, skel2);
        }
      }

      // --- ENEMY WAVE SPAWNER: 章ごとの難易度仕様にしたがって援軍を送る ---
      // 旧実装は「18秒→12秒・最大3体・2種類固定」のハードコードで、章の概念が無かった。
      // ここを difficulty 駆動にしたことで、⑤の段階的な難易度設計が実際に効くようになる。
      if (battleStarted && lastEnemySpawnRef.current === 0) lastEnemySpawnRef.current = now;
      const spawnInterval = enemyWaveRef.current === 0
        ? difficulty.firstWaveDelayMs
        : difficulty.waveIntervalMs;
      if (battleStarted && battleResult === null && lastEnemySpawnRef.current > 0
          && now - lastEnemySpawnRef.current > spawnInterval) {
        lastEnemySpawnRef.current = now;
        enemyWaveRef.current += 1;
        const wave = enemyWaveRef.current;

        const defenderBldgs = nextEntities.filter(e => e.team === 'DEFENDER' && e.type === 'BUILDING' && e.hp > 0);
        if (defenderBldgs.length > 0) {
          const spawnBaseX = Math.max(...defenderBldgs.map(b => b.x));
          const spawnBaseY = Math.round(defenderBldgs.reduce((s, b) => s + b.y, 0) / defenderBldgs.length);

          // ウェーブが進むと体数が waveSize → waveSizeMax まで増える
          const count = Math.min(
            difficulty.waveSizeMax,
            difficulty.waveSize + Math.floor((wave - 1) / 3),
          );

          const isBossWave = difficulty.bossAtWave === wave && !bossSpawnedRef.current;
          if (isBossWave) bossSpawnedRef.current = true;

          const kinds: EnemyUnitKind[] = isBossWave
            ? ['boss']
            : Array.from({ length: count }, (_, i) =>
                difficulty.unitPool[(wave + i) % difficulty.unitPool.length]);

          kinds.forEach((kind, i) => {
            const s = ENEMY_UNIT_STATS[kind];
            const hp = Math.round(s.hp * difficulty.enemyHpMult);
            nextEntities.push({
              id: `wave-${now}-${i}`,
              type: 'TROOP',
              subType: s.subType,
              x: Math.max(0, Math.min(GRID_W - 1, spawnBaseX + 1 + (i % 2) * 0.8)),
              y: Math.max(0, Math.min(GRID_H - 1, spawnBaseY + (i - 1) * 1.2)),
              hp,
              maxHp: hp,
              damage: Math.round(s.damage * difficulty.enemyDamageMult),
              team: 'DEFENDER',
              attackRange: s.attackRange,
              attackSpeed: s.attackSpeed,
              lastAttack: 0,
              moveSpeed: s.moveSpeed,
              targetPreference: 'ANY',
              path: [],
            });
          });

          setTriggerMessage(isBossWave
            ? `👑 ${chapter.enemyName}の親衛隊が出現！ 総力をあげて食い止めろ！`
            : `⚠️ 敵の援軍 Wave ${wave}（${ENEMY_UNIT_STATS[kinds[0]].label}）が出現！`);
          setTimeout(() => setTriggerMessage(null), 3000);
        }
      }

      const newDamagedEntities = new Set<string>();

      // ── ステージギミック ────────────────────────────────────────────
      if (battleStarted && battleResult === null) {
        const dt = lastFrameRef.current ? Math.min(0.1, (now - lastFrameRef.current) / 1000) : 0;
        lastFrameRef.current = now;

        // 溶岩: 乗っているキャラに継続ダメージ（敵・味方・中立すべてに等しく適用）
        if (lavaCellsRef.current.size > 0 && now - lastLavaTickRef.current > 500) {
          const elapsed = (now - lastLavaTickRef.current) / 1000;
          lastLavaTickRef.current = now;
          nextEntities.forEach(e => {
            if (e.type !== 'TROOP' || e.hp <= 0) return;
            if (e.subType === 'titan') return;            // ヌシは溶岩を気にしない
            if (isFlying(e.subType)) return;              // 飛行系は溶岩の上を飛べる
            if (isOnLava(e, lavaCellsRef.current)) {
              e.hp -= LAVA_DPS * Math.min(1, elapsed);
              newDamagedEntities.add(e.id);
            }
          });
        }

        // 流星: 着弾時刻をすぎたものに範囲ダメージ
        for (const m of meteorsRef.current) {
          if (m.resolved || now < m.impactAt) continue;
          m.resolved = true;
          sfx.explosion();
          nextEntities.forEach(e => {
            if (e.hp <= 0) return;
            const d = Math.hypot(e.x - m.zone.x, e.y - m.zone.y);
            if (d <= m.zone.radius) {
              e.hp -= m.zone.damage;
              newDamagedEntities.add(e.id);
            }
          });
        }

        // 中立エイリアン: 巣から定期的に湧く（上限あり）
        if (battleMap?.alienNests) {
          battleMap.alienNests.forEach((nest, i) => {
            const last = lastAlienRef.current[i];
            if (last === undefined) { lastAlienRef.current[i] = now; return; }
            if (now - last <= nest.intervalMs) return;
            lastAlienRef.current[i] = now;
            const alive = nextEntities.filter(
              e => e.team === 'NEUTRAL' && e.subType === ALIEN_STATS.subType && e.hp > 0
            ).length;
            if (alive >= nest.max * battleMap.alienNests!.length) return;
            nextEntities.push(makeAlienEntity(nest, `alien-${i}-${now}`));
            setTriggerMessage('👾 エイリアンが出現！ 敵も味方もおかまいなしに おそってくるぞ');
            setTimeout(() => setTriggerMessage(null), 2600);
          });
        }

        // 巨大生物: 決まった経路を往復する（攻撃は通常のTROOP AIが処理する）
        if (battleMap?.titan && dt > 0) {
          const titan = nextEntities.find(e => e.subType === 'titan' && e.hp > 0);
          if (titan) {
            titanDirRef.current = stepTitan(titan, battleMap.titan, titanDirRef.current, dt);
          }
        }
      }

      // Rebuild obstacle lookups
      const currentObstacles = new Set<string>();
      const noWallObstacles = new Set<string>();
      defenders.forEach(d => {
        if (d.type === 'BUILDING') {
          const stats = BUILDING_STATS[d.subType as BuildingType];
          if(stats) {
             for(let dy=0; dy<stats.height; dy++) {
                 for(let dx=0; dx<stats.width; dx++) {
                     currentObstacles.add(`${d.x + dx},${d.y + dy}`);
                     // 飛行系は壁だけを無視する（建物本体は素通りできない）
                     if (d.subType !== BuildingType.WALL) noWallObstacles.add(`${d.x + dx},${d.y + dy}`);
                 }
             }
          }
        }
      });
      obstaclesRef.current = currentObstacles;
      obstaclesNoWallRef.current = noWallObstacles;
      // 壁は砲撃・ビームを遮る（⑥「壁を越えて撃ってくる」への対策）
      wallCellsRef.current = collectWallCells(nextEntities);


      // Update loops
      nextEntities.forEach(entity => {
        
        // --- BUILDING ATTACKS (both DEFENDER towers and ATTACKER_BUILDING defenses) ---
        if (entity.type === 'BUILDING') {
           // Determine hostile targets based on this building's team
           // 中立勢力（エイリアン・ヌシ）は、どちらの防衛施設からも攻撃対象になる
           const hostiles = entity.team === 'ATTACKER_BUILDING'
             ? nextEntities.filter(e => e.type === 'TROOP' && (e.team === 'DEFENDER' || e.team === 'NEUTRAL'))
             : nextEntities.filter(e => e.team === 'ATTACKER' || (e.type === 'TROOP' && e.team === 'NEUTRAL'));

           if (entity.isHidden) {
             const enemyNearby = hostiles.some(a => {
                const dist = Math.sqrt(Math.pow(a.x - entity.x, 2) + Math.pow(a.y - entity.y, 2));
                return dist < (entity.attackRange || 3);
             });
             if (enemyNearby) entity.isHidden = false;
             return;
           }

          if (entity.damage > 0) {
            // ⑥ 標的選択の修正:
            //   旧: hostiles.find(距離だけ) → 配列の先頭を撃つため、壁のむこうも撃つし
            //       タンクで砲撃を引きつける戦術も成立しなかった。
            //   新: 壁で遮られていない相手だけを候補にし、ヘイト値→距離の順で選ぶ。
            const target = pickDefenseTarget(entity, hostiles, wallCellsRef.current);

            // 照準時間（aimTimeMs）: 標的をとらえてから初弾までの予告。
            // 「なぜ削られたのか」を目で追えるようにし、対処の時間をつくる。
            const aimMs = BUILDING_STATS[entity.subType as BuildingType]?.aimTimeMs ?? 0;
            let aimed = true;
            if (target && aimMs > 0) {
              const rec = aimRef.current[entity.id];
              if (!rec || rec.targetId !== target.id) {
                aimRef.current[entity.id] = { targetId: target.id, lockedAt: now };
                aimed = false;
              } else {
                aimed = now - rec.lockedAt >= aimMs;
              }
            }
            if (!target) delete aimRef.current[entity.id];

            if (target && aimed && now - entity.lastAttack > entity.attackSpeed) {
                // Record dynamic projectiles
                const isTesla = entity.subType === BuildingType.HIDDEN_TESLA;
                
                const newProj = {
                  id: `p-${Date.now()}-${Math.random()}`,
                  fromX: entity.x + 0.5,
                  fromY: entity.y + 0.5,
                  toX: target.x,
                  toY: target.y,
                  startedAt: now,
                  duration: isTesla ? 220 : 500,
                  type: (isTesla ? 'TESLA' : 'CANNON') as 'TESLA' | 'CANNON'
                };
                setProjectiles(prev => [...prev, newProj]);
                sfx.laserShot();

                // 役割ごとの防衛施設ダメージ耐性を適用する。
                // タンク系は砲撃を受け止める役なので大きく軽減し、高速系は打たれ弱い。
                // HPを上げるのではなく「大砲に強い」という形にすることで役割の個性が立つ。
                const resist = CHARACTER_BY_ID[target.subType]?.defenseResist ?? 0;
                const dealt = Math.max(1, Math.round(entity.damage * (1 - resist)));
                const prevHp = target.hp;
                target.hp -= dealt;
                if (target.hp < prevHp) newDamagedEntities.add(target.id);
                entity.lastAttack = now;
            }
          }
          return;
        }

        // --- TROOP AI (Both player attack stick figure AND defensive skeleton) ---
        // Opposing characters filter
        const potentialTargets = nextEntities.filter(opp => {
          if (opp.team === entity.team) return false;
          // 自軍施設は攻撃対象から除外（フレンドリーファイア防止）
          if (entity.team === 'ATTACKER' && opp.team === 'ATTACKER_BUILDING') return false;
          if (opp.isHidden) return false;
          return true;
        });
        if (potentialTargets.length === 0) return;

        let preferredTargets = potentialTargets;
        if (entity.team === 'ATTACKER' && entity.targetPreference === 'DEFENSE') {
            const defenses = potentialTargets.filter(t => t.type === 'BUILDING' && BUILDING_STATS[t.subType as BuildingType]?.damage && BUILDING_STATS[t.subType as BuildingType]?.damage! > 0);
            if (defenses.length > 0) preferredTargets = defenses;
        } else if (entity.team === 'ATTACKER' && entity.targetPreference === 'RUSH') {
            // RUSH: Town Hall を最優先
            const townHalls = potentialTargets.filter(t => t.subType === BuildingType.TOWN_HALL);
            if (townHalls.length > 0) preferredTargets = townHalls;
        }

        let bestTarget: BattleEntity | null = null;
        let minDist = Infinity;

        preferredTargets.forEach(t => {
            const dist = Math.sqrt(Math.pow(t.x - entity.x, 2) + Math.pow(t.y - entity.y, 2));
            if (dist < minDist) {
                minDist = dist;
                bestTarget = t;
            }
        });

        if (!bestTarget) {
           minDist = Infinity;
           potentialTargets.forEach(t => {
              const dist = Math.sqrt(Math.pow(t.x - entity.x, 2) + Math.pow(t.y - entity.y, 2));
              if (dist < minDist) {
                 minDist = dist;
                 bestTarget = t;
              }
           });
        }

        if (bestTarget) {
            // Apply Spells logic
            let currentAttackSpeed = entity.attackSpeed;
            let currentMoveSpeed = entity.moveSpeed;
            let currentDamage = entity.damage;

            // Check Rage
            const isRaged = activeSpells.some(spell => {
              if (spell.type !== 'RAGE' || now > spell.endTime) return false;
              const spellDist = Math.sqrt(Math.pow(spell.x - entity.x, 2) + Math.pow(spell.y - entity.y, 2));
              return spellDist <= 2.8; 
            });

            if (isRaged) {
              currentAttackSpeed = entity.attackSpeed * 0.5; // attack 2x faster (halved wait)
              currentMoveSpeed = entity.moveSpeed * 1.6;
              currentDamage = entity.damage * 1.5;
            }

            // Check Heal (Regen)
            const isHealed = activeSpells.some(spell => {
              if (spell.type !== 'HEAL' || now > spell.endTime) return false;
              const spellDist = Math.sqrt(Math.pow(spell.x - entity.x, 2) + Math.pow(spell.y - entity.y, 2));
              return spellDist <= 2.8;
            });
            if (isHealed && entity.hp < entity.maxHp) {
              entity.hp = Math.min(entity.maxHp, entity.hp + 0.3); // tick heal
            }

            // Target dimensions
            const targetIsBuilding = bestTarget.type === 'BUILDING';
            const targetW = targetIsBuilding ? (BUILDING_STATS[bestTarget.subType as BuildingType]?.width || 1) : 0.6;
            const targetH = targetIsBuilding ? (BUILDING_STATS[bestTarget.subType as BuildingType]?.height || 1) : 0.6;

            // 施設は「中心」ではなく「いちばん近いふち」までの距離で交戦判定する。
            // こうしないと大きな建物では中心に届くまで建物の上に乗り上げて
            // “施設に引っかかる”状態になってしまう。
            let distToTarget: number;
            if (targetIsBuilding) {
              // 建物の占有マス x..x+W-1, y..y+H-1 のうち最も近い点までの距離
              const nearX = Math.max(bestTarget.x, Math.min(entity.x, bestTarget.x + targetW - 1));
              const nearY = Math.max(bestTarget.y, Math.min(entity.y, bestTarget.y + targetH - 1));
              distToTarget = Math.sqrt(Math.pow(nearX - entity.x, 2) + Math.pow(nearY - entity.y, 2));
            } else {
              const targetCenterX = bestTarget.x + targetW / 2 - 0.5;
              const targetCenterY = bestTarget.y + targetH / 2 - 0.5;
              distToTarget = Math.sqrt(Math.pow(targetCenterX - entity.x, 2) + Math.pow(targetCenterY - entity.y, 2));
            }

            // 遠距離ユニットも壁ごしには撃てない（防衛施設と同じルール）。
            // 近接(射程2未満)と飛行系は、この制限を受けない。
            const canSeeTarget =
              entity.attackRange < 2 ||
              isFlying(entity.subType) ||
              bestTarget!.subType === BuildingType.WALL ||
              hasLineOfSight(entity.x + 0.5, entity.y + 0.5, bestTarget!.x + 0.5, bestTarget!.y + 0.5, wallCellsRef.current);

            if (distToTarget <= entity.attackRange && canSeeTarget) {
                if (now - entity.lastAttack > currentAttackSpeed) {
                    const prevHp = bestTarget.hp;
                    bestTarget.hp -= currentDamage;
                    if (bestTarget.hp < prevHp) newDamagedEntities.add(bestTarget.id);
                    entity.lastAttack = now;
                    sfx.hit();
                    // 攻撃タイプ別エフェクトを発生（遠距離=BOLT, 巨人/ボス=SHOCK, それ以外=斬撃）
                    const sub = entity.subType as string;
                    const isRanged = entity.attackRange >= 2;
                    const isHeavy = sub.startsWith('boss') || sub === 'giant';
                    const kind: 'SLASH' | 'BOLT' | 'SHOCK' = isRanged ? 'BOLT' : isHeavy ? 'SHOCK' : 'SLASH';
                    const color = isRanged
                      ? (sub.includes('wizard') || sub.includes('mage') ? '#c084fc' : '#67e8f9')
                      : isHeavy ? '#fb923c' : '#fde68a';
                    const fxId = `fx-${now}-${rngRef.current.next()}`;
                    setHitFx(prev => (prev.length > 40 ? prev.slice(-40) : prev).concat({
                      id: fxId,
                      x: bestTarget.x, y: bestTarget.y,
                      fromX: entity.x, fromY: entity.y,
                      kind, color,
                      startedAt: now, duration: kind === 'BOLT' ? 260 : 360,
                    }));
                }
                entity.path = [];
            }
            else if (entity.targetPreference === 'HOLD') {
                // HOLD命令: 移動しない、攻撃のみ継続
                entity.path = [];
            }
            else if (entity.targetPreference === 'MOVE_TO' && entity.customTarget) {
                // MOVE_TO命令: 指定座標へ移動、到達後に通常戦闘復帰
                const ct = entity.customTarget;
                const distToCustom = Math.sqrt(Math.pow(ct.x - entity.x, 2) + Math.pow(ct.y - entity.y, 2));
                if (distToCustom < 0.8) {
                    entity.customTarget = undefined;
                    entity.targetPreference = 'ANY';
                    entity.path = [];
                } else if (!entity.path || entity.path.length === 0) {
                    const path = findPathWithTerrain(
                        { x: entity.x, y: entity.y },
                        ct,
                        obstaclesRef.current,
                        terrainCostsRef.current
                    );
                    if (path && path.length > 0) {
                        entity.path = path;
                    } else {
                        const dx = ct.x - entity.x;
                        const dy = ct.y - entity.y;
                        const angle = Math.atan2(dy, dx);
                        entity.x += Math.cos(angle) * (entity.moveSpeed * 0.010);
                        entity.y += Math.sin(angle) * (entity.moveSpeed * 0.010);
                    }
                }
            }
            else {
                // Move towards nearest coordinate
                if (!entity.path || entity.path.length === 0) {
                     // 飛行系は壁を無視して直進できる（その代わり壁のかげにも隠れられない）
                     const obstacles = isFlying(entity.subType)
                       ? obstaclesNoWallRef.current
                       : obstaclesRef.current;
                     const path = findPathWithTerrain(
                         {x: entity.x, y: entity.y},
                         {x: bestTarget.x, y: bestTarget.y},
                         obstacles,
                         terrainCostsRef.current
                     );

                     if (path && path.length > 0) {
                         entity.path = path;
                     } else {
                         // Line pathing / break obstruction walls
                         const dx = bestTarget.x - entity.x;
                         const dy = bestTarget.y - entity.y;
                         const angle = Math.atan2(dy, dx);
                         entity.x += Math.cos(angle) * (currentMoveSpeed * 0.010);
                         entity.y += Math.sin(angle) * (currentMoveSpeed * 0.010);
                         
                         const wallCol = defenders.find(d => 
                             d.subType === 'WALL' && 
                             Math.abs(d.x - entity.x) < 0.8 && 
                             Math.abs(d.y - entity.y) < 0.8
                          );
                          if (wallCol && now - entity.lastAttack > currentAttackSpeed) {
                              const prevHp = wallCol.hp;
                              wallCol.hp -= currentDamage;
                              if (wallCol.hp < prevHp) newDamagedEntities.add(wallCol.id);
                              entity.lastAttack = now;
                              sfx.hit();
                          }
                          return;
                     }
                }

                // Vectors apply stepper
                let moveX = 0, moveY = 0;
                if (entity.path && entity.path.length > 0) {
                    const nextNode = entity.path[0];
                    const dx = nextNode.x - entity.x;
                    const dy = nextNode.y - entity.y;
                    const distToNode = Math.sqrt(dx * dx + dy * dy);
                    const moveStep = currentMoveSpeed * 0.013; 

                    if (distToNode < moveStep) {
                        entity.x = nextNode.x;
                        entity.y = nextNode.y;
                        entity.path.shift();
                    } else {
                        moveX = (dx / distToNode) * moveStep;
                        moveY = (dy / distToNode) * moveStep;
                    }
                }

                // Friendly collision spacing (flocking algorithm separation)
                let sepX = 0, sepY = 0;
                const separationRadius = 0.55;
                const separationForce = 0.035;
                const neighbors = nextEntities.filter(other => 
                    other.id !== entity.id && 
                    other.type === 'TROOP' &&
                    Math.abs(other.x - entity.x) < separationRadius &&
                    Math.abs(other.y - entity.y) < separationRadius
                );

                neighbors.forEach(n => {
                    const dx = entity.x - n.x;
                    const dy = entity.y - n.y;
                    const distSq = dx*dx + dy*dy;
                    if (distSq > 0 && distSq < separationRadius * separationRadius) {
                         const dist = Math.sqrt(distSq);
                         sepX += (dx / dist) / dist;
                         sepY += (dy / dist) / dist;
                    }
                });

                entity.x += moveX + (sepX * separationForce);
                entity.y += moveY + (sepY * separationForce);
            }
        }
      });
      
      setDamagedEntities(newDamagedEntities);
      return nextEntities;
    });

    gameLoopRef.current = requestAnimationFrame(updateBattle);
  }, [battleStarted, availableTroops, battleResult, activeSpells, battlePaused, difficulty, chapter]);

  useEffect(() => {
    if (battleResult) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    } else {
      gameLoopRef.current = requestAnimationFrame(updateBattle);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [updateBattle, battleResult]);

  const isCharUnlocked = (id: string): boolean => {
    const fam = CHARACTER_BY_ID[id];
    if (fam?.isStarter) return true;
    // 兵舎を建てた日は、その解放ぶんを無料で使える（＝施設を建てる意味がここに出る）
    if (loadout?.unlockedTroopTypes?.includes(id)) return true;
    if (permanentUnlocks.includes(id)) return true;
    // reset unlockedToday if date changed
    const today = new Date().toISOString().slice(0, 10);
    if (unlockedTodayDate !== today) return false;
    return unlockedToday.includes(id);
  };

  const buildingAccentColor: Record<string, string> = {
    TOWN_HALL: 'rgba(250,204,21,0.25)',
    WALL: 'rgba(148,163,184,0.2)',
    CANNON: 'rgba(239,68,68,0.25)',
    ARMY_CAMP: 'rgba(34,197,94,0.2)',
    GOLD_MINE: 'rgba(250,204,21,0.2)',
    HIDDEN_TESLA: 'rgba(34,211,238,0.2)',
  };

  return (
    <div className="relative w-full min-h-[100dvh] h-[100dvh] bg-[#05070f] flex flex-col overflow-hidden">
       {/* High-quality micro-dynamic keyframes style definitions */}
       <style>{`
         @keyframes limb-swing-L {
           0%, 100% { transform: rotate(0deg); }
           50% { transform: rotate(26deg); }
         }
         @keyframes limb-swing-R {
           0%, 100% { transform: rotate(0deg); }
           50% { transform: rotate(-26deg); }
         }
         @keyframes head-bob {
           0%, 100% { transform: translateY(0px); }
           50% { transform: translateY(1.5px); }
         }
         @keyframes weapon-attack {
           0%, 100% { transform: rotate(0deg) translateY(0); }
           50% { transform: rotate(-45deg) translateY(-2px); }
         }
         @keyframes archer-pull {
           0%, 100% { transform: scale(1) translateX(0); }
           50% { transform: scale(1.1) translateX(-1px); }
         }
         @keyframes giant-fist {
           0%, 100% { transform: scale(1) translateY(0); }
           50% { transform: scale(1.2) translateY(2.5px); }
         }
         @keyframes pulse-ring {
           0% { transform: scale(0.95); opacity: 0.4; }
           50% { transform: scale(1.05); opacity: 0.75; }
           100% { transform: scale(0.95); opacity: 0.4; }
         }
         .anim-leg-L {
           animation: limb-swing-L 0.6s infinite ease-in-out;
         }
         .anim-leg-R {
           animation: limb-swing-R 0.6s infinite ease-in-out;
         }
         .anim-head {
           animation: head-bob 0.6s infinite ease-in-out;
         }
         .anim-attack-sword {
           animation: weapon-attack 0.3s infinite ease-in-out;
         }
         .anim-attack-bow {
           animation: archer-pull 0.35s infinite ease-in-out;
         }
         .anim-attack-fist {
           animation: giant-fist 0.4s infinite ease-in-out;
         }
         .animate-ping-slow {
           animation: pulse-ring 2s infinite ease-in-out;
         }
         @keyframes cw-aura-spin {
           0% { transform: rotate(0deg) scale(1.7); }
           100% { transform: rotate(360deg) scale(1.7); }
         }
         .cw-battle-aura {
           position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0.30;
           background: conic-gradient(from 0deg at 50% 50%,
             rgba(37,99,235,0) 0%, rgba(37,99,235,0.55) 18%, rgba(2,4,12,0) 34%,
             rgba(239,68,68,0.55) 62%, rgba(2,4,12,0) 80%, rgba(37,99,235,0) 100%);
           animation: cw-aura-spin 26s linear infinite;
           filter: blur(34px);
         }
         @keyframes cw-titan-breathe {
           0%, 100% { transform: scale(1); }
           50% { transform: scale(1.07); }
         }
         @keyframes cw-meteor-warn {
           0%, 100% { opacity: 0.30; transform: scale(0.9); }
           50% { opacity: 0.75; transform: scale(1.04); }
         }
         @media (prefers-reduced-motion: reduce) {
           .cw-battle-aura, .cw-meteor-ring { animation: none; }
         }
         .building-3d {
           box-shadow:
             inset -3px -3px 6px rgba(0,0,0,0.5),
             inset 2px 2px 4px rgba(255,255,255,0.08),
             2px 4px 8px rgba(0,0,0,0.6);
         }
       `}</style>

       {/* Top Bar */}
       <div className="h-16 bg-black/75 flex justify-between items-center px-4 text-white z-50 relative border-b border-white/5">
          <div className="font-bold text-sm tracking-tight flex items-center gap-2 min-w-0">
            <Swords className="text-red-500 animate-pulse flex-shrink-0" size={18} />
            <span className="text-red-400 font-extrabold text-base whitespace-nowrap">第{chapter.no}章</span>
            <span className="text-white/60 text-xs truncate hidden sm:inline" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              {chapter.title}
            </span>
            {assistLevel > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0"
                style={{ background: 'rgba(163,230,53,0.12)', borderColor: 'rgba(163,230,53,0.45)', color: '#a3e635' }}>
                🛟 {ASSIST_LEVELS[assistLevel].label}
              </span>
            )}
            {selectedSpell && (
              <span className="text-xs bg-purple-600/50 text-purple-200 px-2 py-0.5 rounded-full select-none animate-bounce border border-purple-400/30">
                🔮 呪文投下ポインター
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {quizSubtopics.length > 0 && (
              <button
                onClick={() => { setBattlePaused(true); setQuizOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#22d3ee] text-xs font-bold animate-pulse"
                style={{ fontFamily: 'Orbitron, monospace' }}
              >
                📚 といて⚡
              </button>
            )}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#facc15]/50 bg-[#facc15]/10"
              style={{ fontFamily: 'Orbitron, monospace' }}>
              <span className="text-base">⚡</span>
              <span className="text-[#facc15] font-bold text-sm">{Math.floor(gold)}</span>
            </div>
            <Button variant="secondary" size="xs" onClick={() => onEndBattle(false, { gold: 0 })}>
              全軍撤退（降伏）
            </Button>
          </div>
       </div>

       {/* Temporary visual dynamic notification banner inside combat */}
       {triggerMessage && (
         <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-900/95 border-2 border-amber-500 text-white font-bold text-xs py-2 px-6 rounded-full shadow-2xl animate-bounce backdrop-blur">
           {triggerMessage}
         </div>
       )}

       {/* Battle Stage */}
       <div
         className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#0a0e1a]"
         style={{
           backgroundImage: 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.6) 0, transparent 100%), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.5) 0, transparent 100%), radial-gradient(1px 1px at 40% 80%, rgba(34,211,238,0.5) 0, transparent 100%), radial-gradient(1.5px 1.5px at 85% 20%, rgba(168,85,247,0.5) 0, transparent 100%)',
           backgroundColor: '#0a0e1a',
         }}
       >
        {/* 青⇄赤の回転オーラ（CAT-WARS 世界観の動的バックドロップ） */}
        <div className="cw-battle-aura" />
        {/* contentSize を渡すと盤面が表示領域に自動で収まる（iPad 横向きで下が切れていた対策） */}
        <PinchZoomLayer contentSize={{ width: GRID_W * 40, height: GRID_H * 40 }} minScale={0.25}>
          {/* ISOMETRIC CONTAINER */}
          <div
            className="relative iso-container shadow-2xl"
            style={{
                width: GRID_W * 40,
                height: GRID_H * 40,
                backgroundColor: 'rgba(10,14,26,0.5)'
            }}
          >
            {/* Terrain Layer */}
            {battleMap && <TerrainLayer terrain={battleMap.terrain} />}

            {/* Clickable Grid Layer */}
            {cells.map(cell => (
                 <div 
                    key={`grid-${cell.x}-${cell.y}`}
                    className={`absolute w-10 h-10 border border-white/5 transition-colors ${
                      selectedSpell ? 'hover:bg-purple-500/35 cursor-crosshair' :
                      buildMode ? 'hover:bg-[#22d3ee]/20 cursor-cell' : 'hover:bg-white/15'
                    }`}
                    style={{ left: cell.x * 40, top: cell.y * 40 }}
                    onClick={() => handleGridClick(cell.x, cell.y)}
                 />
            ))}

            {/* Active spells ring indicators on isometric perspective */}
            {activeSpells.filter(s => Date.now() < s.endTime).map(s => (
              <div
                 key={s.id}
                 className={`absolute rounded-full border-4 animate-ping-slow flex items-center justify-center`}
                 style={{
                    left: (s.x - 1.5) * 40,
                    top: (s.y - 1.5) * 40,
                    width: 140, // spell boundary
                    height: 140,
                    zIndex: 10,
                    pointerEvents: 'none',
                    borderColor: s.type === 'HEAL' ? 'rgba(16,185,129,0.7)' : 'rgba(139,92,246,0.7)',
                    background: s.type === 'HEAL' ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.12)',
                    boxShadow: s.type === 'HEAL' 
                      ? 'inset 0 0 15px rgba(16,185,129,0.4), 0 0 15px rgba(16,185,129,0.4)' 
                      : 'inset 0 0 15px rgba(139,92,246,0.4), 0 0 15px rgba(139,92,246,0.4)'
                 }}
              >
                <span className={`text-[9px] font-black tracking-widest uppercase scale-75 ${s.type === 'HEAL' ? 'text-emerald-400' : 'text-purple-300'}`}>
                  {s.type === 'HEAL' ? '💚 HEAL ZONE' : '⚡ RAGE ZONE'}
                </span>
              </div>
            ))}

            {/* Render flying projectiles overlay perfectly positioned */}
            {projectiles.map(p => {
              const elapsed = Date.now() - p.startedAt;
              const pct = Math.min(1, elapsed / p.duration);
              const curX = p.fromX + (p.toX - p.fromX) * pct;
              const curY = p.fromY + (p.toY - p.fromY) * pct;

              if (p.type === 'TESLA') {
                return (
                  <svg key={p.id} className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 60 }}>
                    <line 
                      x1={p.fromX * 40 + 20} y1={p.fromY * 40 + 20} 
                      x2={p.toX * 40 + 13} y2={p.toY * 40 + 16} 
                      stroke="#22d3ee" 
                      strokeWidth="3.2" 
                      strokeDasharray="4,2"
                      className="animate-pulse"
                    />
                    <line 
                      x1={p.fromX * 40 + 20} y1={p.fromY * 40 + 20} 
                      x2={p.toX * 40 + 13} y2={p.toY * 40 + 16} 
                      stroke="#ffffff" 
                      strokeWidth="1.2" 
                    />
                  </svg>
                );
              } else {
                return (
                  <div 
                    key={p.id}
                    className="absolute w-3.5 h-3.5 bg-gradient-to-r from-amber-500 to-amber-700 border border-black rounded-full shadow-lg z-50 flex items-center justify-center pointer-events-none"
                    style={{
                      left: curX * 40 + 13,
                      top: curY * 40 + 16
                    }}
                  >
                    <span className="w-1.5 h-1.5 bg-yellow-200 rounded-full animate-ping" />
                  </div>
                );
              }
            })}

            {/* 移動命令の矢印（うすい赤）＋ 遠距離攻撃のビーム */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 58 }}>
              <defs>
                <marker id="moveArrowHead" markerWidth="6" markerHeight="6" refX="4.5" refY="3"
                  orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L6,3 L0,6 Z" fill="rgba(248,113,113,0.55)" />
                </marker>
              </defs>
              {entities
                .filter(e => e.type === 'TROOP' && e.team === 'ATTACKER' && e.customTarget && e.hp > 0)
                .map(e => (
                  <line
                    key={`mv-${e.id}`}
                    x1={e.x * 40 + 20} y1={e.y * 40 + 20}
                    x2={e.customTarget!.x * 40 + 20} y2={e.customTarget!.y * 40 + 20}
                    stroke="rgba(248,113,113,0.45)" strokeWidth="2.5"
                    strokeDasharray="6,4" strokeLinecap="round"
                    markerEnd="url(#moveArrowHead)"
                  />
                ))}
              {hitFx.filter(f => f.kind === 'BOLT').map(f => {
                const t = Math.min(1, (Date.now() - f.startedAt) / f.duration);
                return (
                  <line key={f.id}
                    x1={f.fromX * 40 + 20} y1={f.fromY * 40 + 20}
                    x2={f.x * 40 + 20} y2={f.y * 40 + 20}
                    stroke={f.color} strokeWidth={3 * (1 - t) + 0.5} strokeLinecap="round"
                    style={{ opacity: 1 - t, filter: `drop-shadow(0 0 3px ${f.color})` }}
                  />
                );
              })}
            </svg>

            {/* 攻撃ヒットの華やかなエフェクト（斬撃・衝撃・遠距離スパーク） */}
            {hitFx.map(f => {
              const t = Math.min(1, (Date.now() - f.startedAt) / f.duration);
              const cx = f.x * 40 + 20;
              const cy = f.y * 40 + 20;
              if (f.kind === 'SHOCK') {
                const size = 18 + t * 52;
                return (
                  <div key={f.id} className="absolute rounded-full pointer-events-none"
                    style={{
                      left: cx - size / 2, top: cy - size / 2, width: size, height: size,
                      border: `3px solid ${f.color}`, opacity: 0.8 * (1 - t),
                      boxShadow: `0 0 12px ${f.color}`, zIndex: 59,
                    }} />
                );
              }
              if (f.kind === 'BOLT') {
                const s = 10 * (1 - t) + 4;
                return (
                  <div key={f.id} className="absolute rounded-full pointer-events-none"
                    style={{
                      left: cx - s / 2, top: cy - s / 2, width: s, height: s,
                      background: f.color, opacity: 1 - t,
                      boxShadow: `0 0 8px ${f.color}`, zIndex: 59,
                    }} />
                );
              }
              // SLASH: 斜めに走る斬撃の光
              const len = 26 + t * 8;
              return (
                <div key={f.id} className="absolute pointer-events-none"
                  style={{
                    left: cx, top: cy, width: len, height: 4,
                    background: `linear-gradient(90deg, transparent, ${f.color}, transparent)`,
                    borderRadius: 4, opacity: 1 - t,
                    transform: `translate(-50%,-50%) rotate(-35deg) scaleX(${0.6 + t})`,
                    boxShadow: `0 0 8px ${f.color}`, zIndex: 59,
                  }} />
              );
            })}

            {/* 流星の予告円 → 着弾（予告が出てから約1.7秒あるので、見てから逃がせる） */}
            {meteors.map(m => {
              const now2 = Date.now();
              const impacted = now2 >= m.impactAt;
              const size = m.zone.radius * 2 * 40;
              const left = m.zone.x * 40 + 20 - size / 2;
              const top = m.zone.y * 40 + 20 - size / 2;
              const prog = Math.min(1, (now2 - m.warnedAt) / Math.max(1, m.impactAt - m.warnedAt));
              return (
                <div key={m.id} className="absolute rounded-full pointer-events-none cw-meteor-ring"
                  style={{
                    left, top, width: size, height: size, zIndex: 57,
                    border: impacted ? '4px solid rgba(255,237,213,0.95)' : '3px dashed rgba(251,146,60,0.9)',
                    background: impacted
                      ? 'radial-gradient(circle, rgba(255,237,213,0.75), rgba(239,68,68,0.25) 60%, transparent 72%)'
                      : `radial-gradient(circle, rgba(251,146,60,${0.10 + prog * 0.25}), transparent 70%)`,
                    boxShadow: impacted ? '0 0 40px rgba(251,146,60,0.95)' : '0 0 16px rgba(251,146,60,0.55)',
                    animation: impacted ? undefined : 'cw-meteor-warn 0.55s ease-in-out infinite',
                  }}>
                  {!impacted && (
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl">☄️</span>
                  )}
                </div>
              );
            })}

            {/* Entities Render sorted correctly */}
            {entities
                .sort((a, b) => (a.x + a.y) - (b.x + b.y)) // pseudo depth sort
                .map(e => {
                if (e.isHidden) return null;

                let width = 28;
                let height = 32;
                let bgStyle = "";
                
                if (e.type === 'BUILDING') {
                   const bStats = BUILDING_STATS[e.subType as BuildingType];
                   width = (bStats?.width || 1) * 40;
                   height = (bStats?.height || 1) * 40;
                   bgStyle = bStats?.color || 'bg-gray-500';
                } else {
                   // 体格は系統ごとに定義した bodySize から決める（1マス=40px）。
                   // タンクはマスをはみ出す大柄、高速系は小さく、ボスは圧倒的に大きい。
                   const fam = CHARACTER_BY_ID[e.subType];
                   if (fam) {
                      width = fam.bodySize;
                      height = Math.round(fam.bodySize * 1.15);
                   } else if (e.subType === 'titan') {
                      width = 110;
                      height = 120;
                   } else if (e.subType === ALIEN_STATS.subType) {
                      width = ALIEN_STATS.bodySize;
                      height = Math.round(ALIEN_STATS.bodySize * 1.15);
                   } else if (e.subType === 'skeleton') {
                      width = 24;
                      height = 28;
                   } else {
                      width = 28;
                      height = 32;
                   }
                }

                const isDamaged = damagedEntities.has(e.id);

                return (
                    <div
                        key={e.id}
                        className={`absolute flex items-center justify-center transition-transform iso-item
                            ${e.type === 'BUILDING' ? `building-3d rounded-md border border-white/5 ${bgStyle}` : 'bg-transparent'}
                            ${isDamaged ? 'animate-shake hit-flash scale-105' : ''}
                            ${e.team === 'ATTACKER_BUILDING' ? 'ring-2 ring-[#22d3ee]/50' : ''}
                        `}
                        style={{
                            // 施設はマスの左上に合わせる。キャラは体格がまちまちなので、
                            // マスの中心を基準にそろえる（大型が右下にずれて見えるのを防ぐ）。
                            left: e.type === 'BUILDING' ? e.x * 40 : e.x * 40 + 20 - width / 2,
                            top:  e.type === 'BUILDING' ? e.y * 40 : e.y * 40 + 20 - height / 2,
                            width: width,
                            height: height,
                            // 大型ほど手前に描く（小さいキャラが巨体の裏に完全に隠れないよう TROOP に加算）
                            zIndex: Math.floor(e.x + e.y) + (e.type === 'TROOP' ? 3 : 0), // Z depth
                            ...(e.type === 'BUILDING' ? {
                              background: buildingAccentColor[e.subType as string] ?? 'rgba(255,255,255,0.05)',
                              boxShadow: e.team === 'ATTACKER_BUILDING'
                                ? 'inset -3px -3px 6px rgba(0,0,0,0.5), inset 2px 2px 4px rgba(255,255,255,0.1), 0 0 8px rgba(34,211,238,0.4)'
                                : 'inset -3px -3px 6px rgba(0,0,0,0.5), inset 2px 2px 4px rgba(255,255,255,0.08), 2px 4px 8px rgba(0,0,0,0.6)',
                            } : {}),
                        }}
                        onClick={(ev) => {
                          if (e.team === 'ATTACKER' && e.type === 'TROOP') {
                            ev.stopPropagation();
                            setSelectedOrderTroopId(prev => prev === e.id ? null : e.id);
                          }
                        }}
                    >
                        {e.type === 'BUILDING' ? (
                          <div className="flex flex-col items-center w-full h-full relative">
                            <img
                              src={`/assets/sprites/${(e.subType as string).toLowerCase().replace(/_/g, '-')}.png`}
                              alt={e.subType as string}
                              style={{
                                width: '100%', height: '100%',
                                objectFit: 'contain',
                                imageRendering: 'crisp-edges',
                                filter: e.team === 'ATTACKER_BUILDING'
                                  ? 'drop-shadow(0 0 5px rgba(34,211,238,0.7)) brightness(1.1)'
                                  : e.hp < e.maxHp * 0.3
                                  ? 'brightness(0.6) sepia(1) saturate(3) hue-rotate(-20deg)'
                                  : undefined,
                              }}
                              draggable={false}
                            />
                            {e.subType === BuildingType.HIDDEN_TESLA && (
                              <span className="text-[7px] font-black text-cyan-400 select-none bg-cyan-950/80 px-1 rounded absolute -bottom-1">活性中</span>
                            )}
                          </div>
                        ) : (
                          <div className="relative w-full h-full flex items-center justify-center">
                            {e.subType === 'skeleton' && (
                              <div className="absolute w-4 h-1.5 bg-blue-900/40 rounded-full bottom-0 left-1/2 -translate-x-1/2 blur-[1px]" />
                            )}
                            {(() => {
                              // 中立勢力（エイリアン・ヌシ）はネコではないので、専用の見た目にする
                              if (e.team === 'NEUTRAL') {
                                const isTitan = e.subType === 'titan';
                                return (
                                  <div className="w-full h-full flex items-center justify-center select-none"
                                    style={{
                                      fontSize: isTitan ? 84 : 26,
                                      lineHeight: 1,
                                      filter: isTitan
                                        ? 'drop-shadow(0 0 14px rgba(168,85,247,0.95)) saturate(1.4)'
                                        : 'drop-shadow(0 0 7px rgba(74,222,128,0.9))',
                                      animation: isTitan ? 'cw-titan-breathe 2.6s ease-in-out infinite' : undefined,
                                    }}>
                                    {isTitan ? '🦑' : '👾'}
                                  </div>
                                );
                              }
                              // 攻撃側は自軍の進化段階、敵側は段階1で描画
                              const st = e.team === 'ATTACKER' ? getStage(e.subType) : 1;
                              const url = troopSpriteUrl(e.subType, st);
                              return url ? (
                                <img
                                  src={url}
                                  alt={e.subType}
                                  style={{
                                    width: '100%', height: '100%',
                                    objectFit: 'contain',
                                    imageRendering: 'crisp-edges',
                                    filter: e.team !== 'ATTACKER'
                                      ? 'hue-rotate(150deg) brightness(0.85) drop-shadow(0 0 3px rgba(239,68,68,0.8))'
                                      : (tempRank[e.subType] ?? 0) > 0
                                        ? 'drop-shadow(0 0 7px rgba(250,204,21,0.95)) brightness(1.2) sepia(0.2) saturate(1.8)'
                                        : 'drop-shadow(0 2px 3px rgba(34,211,238,0.4))',
                                    transform: e.team !== 'ATTACKER' ? 'scaleX(-1)' : (tempRank[e.subType] ?? 0) > 0 ? 'scale(1.18)' : undefined,
                                  }}
                                  draggable={false}
                                />
                              ) : renderStickFigure(e.subType, !!(e.path && e.path.length > 0), e.lastAttack);
                            })()}

                            {/* Unit order menu */}
                            {selectedOrderTroopId === e.id && (
                              <div
                                className="absolute flex gap-1 z-[150]"
                                style={{ top: -42, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all' }}
                                onClick={ev => ev.stopPropagation()}
                              >
                                {(
                                  [
                                    { order: 'RUSH' as const, label: '🏃突撃', color: '#ef4444' },
                                    { order: 'DEFENSE' as const, label: '🛡防衛', color: '#22d3ee' },
                                    { order: 'HOLD' as const, label: '⏸待機', color: '#94a3b8' },
                                  ] as { order: 'RUSH' | 'DEFENSE' | 'HOLD'; label: string; color: string }[]
                                ).map(({ order, label, color }) => (
                                  <button
                                    key={order}
                                    onClick={() => {
                                      setEntities(prev =>
                                        prev.map(en =>
                                          en.id === selectedOrderTroopId
                                            ? { ...en, targetPreference: order === 'DEFENSE' ? 'DEFENSE' : order }
                                            : en
                                        )
                                      );
                                      setSelectedOrderTroopId(null);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black rounded-lg text-white"
                                    style={{
                                      background: 'rgba(10,14,26,0.95)',
                                      border: `1px solid ${color}`,
                                      color,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                                {/* Move-to: clicking map will redirect this troop */}
                                <button
                                  className="px-2 py-1 text-[10px] font-black rounded-lg text-white"
                                  style={{
                                    background: 'rgba(10,14,26,0.95)',
                                    border: '1px solid #a78bfa',
                                    color: '#a78bfa',
                                    whiteSpace: 'nowrap',
                                    animation: 'glow-pulse-cyan 1s ease-in-out infinite',
                                  }}
                                >
                                  📍移動先タップ
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* HP Bar with color dynamics based on health depletion */}
                        <div className="absolute -top-4 left-0 w-full h-1.5 bg-gray-950/80 rounded-full border border-black/30 overflow-hidden">
                            <div
                              className="h-full transition-all duration-150"
                              style={{
                                width: `${(e.hp / e.maxHp) * 100}%`,
                                background: e.team === 'DEFENDER' ? '#ef4444' : '#22c55e',
                                boxShadow: e.team === 'DEFENDER' ? '0 0 4px #ef4444' : '0 0 4px #22c55e',
                              }}
                            ></div>
                        </div>
                        {e.team === 'ATTACKER' && (tempRank[e.subType] ?? 0) > 0 && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-black text-[#facc15] bg-black/80 px-1 rounded-full border border-[#facc15]/60 whitespace-nowrap" style={{ fontFamily: 'Orbitron, monospace' }}>
                            ⬆+{tempRank[e.subType]}
                          </div>
                        )}
                    </div>
                );
            })}
            
            {/* Spawn Ground Overlay */}
            {!battleStarted && (
               <div className="absolute inset-0 border-4 border-dashed border-teal-400/40 pointer-events-none flex items-center justify-center iso-item">
                  <span className="text-white text-xs font-black bg-slate-950/90 py-3 px-6 rounded-full border border-teal-400/30 shadow-2xl backdrop-blur-md animate-pulse">
                     👈 外側の空地（砂地）をタップして、味方部隊やアクティブ呪文を投入せよ
                  </span>
               </div>
            )}
          </div>
        </PinchZoomLayer>
       </div>

       {/* Result Modal display */}
       {battleResult && (() => {
         const lootMult = hasBuff('DOUBLE_LOOT') ? 1 + buffVal('DOUBLE_LOOT') / 100 : 1;
         const win = battleResult === 'WIN';
         // 戦利品は章ごとに設定（難しい章ほど多い）
         const loot = win ? { gold: Math.round(chapter.rewardCredits * lootMult) } : { gold: 0 };
         // fixed + z-[160] にして、下部のキャラ出撃バー(z-50)より確実に手前へ出す。
         // 以前は両方 z-50 の兄弟要素で、DOM順が後のバーがリザルトを覆っていた。
         return (
         <div className="fixed inset-0 z-[160] bg-black/90 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 p-4 overflow-y-auto">
            {win ? (
               <div className="text-center p-6 bg-slate-900/70 border border-yellow-500/30 rounded-2xl max-w-sm w-full max-h-[92dvh] overflow-y-auto backdrop-blur-md shadow-2xl">
                 <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-3 animate-bounce" />
                 <div className="text-[10px] tracking-[0.25em] text-yellow-400/70 mb-1" style={{ fontFamily: 'Orbitron, monospace' }}>
                   CHAPTER {chapter.no} CLEAR
                 </div>
                 <h2 className="text-2xl font-extrabold text-yellow-400 mb-2 leading-tight">{chapter.title}</h2>
                 <p className="text-sm text-gray-200 mb-4 leading-relaxed">{chapter.victoryLine}</p>
                 <LevelUpSummary events={levelUps} />
                 <Button className="w-full mt-2" size="lg" onClick={() => onEndBattle(true, loot)}>
                   戦利品を獲得して帰還 (💠{loot.gold} クレジット){hasBuff('DOUBLE_LOOT') && ' ×2!'}
                 </Button>
               </div>
            ) : (
               <div className="text-center p-6 bg-slate-900/70 border border-red-500/30 rounded-2xl max-w-sm w-full max-h-[92dvh] overflow-y-auto backdrop-blur-md shadow-2xl">
                 <Skull className="w-16 h-16 text-red-500 mx-auto mb-3" />
                 <h2 className="text-2xl font-extrabold text-red-500 mb-2">たいきゃく...</h2>
                 <p className="text-sm text-gray-200 mb-2 leading-relaxed">{chapter.defeatLine}</p>
                 <p className="text-[11px] text-cyan-300/80 mb-3 leading-relaxed">
                   💡 {chapter.hint}
                 </p>
                 {/* 連敗時は次回サポートが入ることを先に伝える（隠れた調整はしない） */}
                 <div className="text-[11px] text-[#a3e635] mb-3 leading-relaxed">
                   まけても部隊の経験値は手に入るよ。何回かまけると「サポートモード」で やさしくなるので、あきらめずにもう一回！
                 </div>
                 <LevelUpSummary events={levelUps} />
                 <Button className="w-full mt-2" size="lg" variant="secondary" onClick={() => onEndBattle(false, { gold: 0 })}>
                   村へ撤退する
                 </Button>
               </div>
            )}
         </div>
         );
       })()}

       {/* Hotbar: Bottom selection console for both troops and spells */}
       {/* iPad 横向きでは画面の高さが限られるため、行数を減らしてコンパクトにしている */}
       <div className="bg-gray-950/95 border-t border-gray-800 px-3 py-1.5 z-50 relative shadow-2xl flex flex-col gap-1.5 flex-shrink-0">
         {/* Row 1: 魔法カード（選択＋補充を1行にまとめた） */}
         <div className="flex gap-2 items-center justify-center flex-wrap">
           <span className="text-[10px] font-black text-gray-400 self-center uppercase pr-1">魔法カード:</span>
           <button
             onClick={() => {
               setSelectedSpell('HEAL');
               setSelectedTroopId(null);
             }}
             disabled={spellCounts.HEAL <= 0}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs ${
               selectedSpell === 'HEAL'
                 ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                 : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-850'
             } ${spellCounts.HEAL <= 0 ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
           >
             <Heart size={13} className="text-emerald-400" />
             <span className="font-bold">回復(HEAL)</span>
             <span className="text-[10px] bg-slate-850 text-stone-300 px-1.5 py-0.2 rounded font-mono">
               残: {spellCounts.HEAL}
             </span>
           </button>

           <button
             onClick={() => {
               setSelectedSpell('RAGE');
               setSelectedTroopId(null);
             }}
             disabled={spellCounts.RAGE <= 0}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs ${
               selectedSpell === 'RAGE'
                 ? 'bg-purple-950 text-purple-300 border-purple-400'
                 : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-850'
             } ${spellCounts.RAGE <= 0 ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
           >
             <Zap size={13} className="text-purple-400" />
             <span className="font-bold">激怒(RAGE)</span>
             <span className="text-[10px] bg-slate-850 text-stone-300 px-1.5 py-0.2 rounded font-mono">
               残: {spellCounts.RAGE}
             </span>
           </button>

           {/* 補充（旧・独立した行を、この行のチップに統合してバーの高さを削った） */}
           <button
             onClick={() => { if (gold >= 60) { setGold(g => g - 60); setSpellCounts(s => ({ ...s, HEAL: s.HEAL + 1 })); } }}
             disabled={gold < 60}
             className="px-2 py-1.5 text-[10px] font-bold rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 text-[#22d3ee] disabled:opacity-30 whitespace-nowrap"
           >
             ＋💊60⚡
           </button>
           <button
             onClick={() => { if (gold >= 80) { setGold(g => g - 80); setSpellCounts(s => ({ ...s, RAGE: s.RAGE + 1 })); } }}
             disabled={gold < 80}
             className="px-2 py-1.5 text-[10px] font-bold rounded-lg border border-[#fb923c]/40 bg-[#fb923c]/10 text-[#fb923c] disabled:opacity-30 whitespace-nowrap"
           >
             ＋😤80⚡
           </button>

           {/* 建設（旧・独立した行を、この行に統合） */}
           <span className="text-[10px] font-black text-gray-400 self-center uppercase pl-2">建設:</span>
           {IN_BATTLE_BUILD_OPTIONS.map(type => {
             const bCost = IN_BATTLE_BUILD_COSTS[type] ?? 0;
             const canAfford = Math.floor(gold) >= bCost;
             const selected = buildMode === type;
             return (
               <button
                 key={type}
                 onClick={() => {
                   setBuildMode(selected ? null : type);
                   setSelectedTroopId(null);
                   setSelectedSpell(null);
                 }}
                 disabled={!canAfford && !selected}
                 className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                   selected
                     ? 'border-[#22d3ee] bg-[#22d3ee]/20 text-[#22d3ee]'
                     : canAfford
                       ? 'border-white/25 bg-white/5 text-white/75 hover:bg-white/10'
                       : 'border-white/10 bg-transparent text-white/40 opacity-40'
                 }`}
               >
                 <span className="text-sm leading-none">{BUILDING_STATS[type].icon || '🧱'}</span>
                 <span style={{ fontFamily: 'Orbitron, monospace' }}>{bCost}⚡</span>
               </button>
             );
           })}
           {buildMode && (
             <span className="text-[10px] text-[#22d3ee] font-bold animate-pulse whitespace-nowrap">
               👆 配置する場所をタップ
             </span>
           )}
         </div>

         {/* Row 2: 出撃（ゴールド消費・にゃんこ式）+ 一時ランクアップ */}
         <div className="relative flex items-center gap-2 overflow-x-auto px-1">
            {availableTroops.map(troop => {
               const fam = CHARACTER_BY_ID[troop.id];
               const baseStage = getStage(troop.id);
               const tr = tempRank[troop.id] ?? 0;
               const formName = fam ? fam.forms[baseStage - 1].name : troop.name;
               const sprite = troopSpriteUrl(troop.id, baseStage) ?? `/assets/sprites/${troop.id}.png`;
               const cost = fam ? Math.round(fam.cost.gold * (1 - buffVal('COST_REDUCTION') / 100)) : 0;
               const cdLeft = Math.max(0, (deployCdRef.current[troop.id] ?? 0) + (hasBuff('FAST_DEPLOY') ? Math.round(1500 * (1 - buffVal('FAST_DEPLOY') / 100)) : 1500) - Date.now());
               const affordable = Math.floor(gold) >= cost && cdLeft <= 0;
               return (
                  <button
                    key={troop.id}
                    onClick={() => {
                      if (!isCharUnlocked(troop.id)) {
                        if (unlockCharacterToday(troop.id)) {
                          sfx.correct();
                        } else {
                          setTriggerMessage('⚡ エナジーが15たりない！まず「といて⚡」で問題をとこう！');
                          setTimeout(() => setTriggerMessage(null), 2000);
                        }
                        return;
                      }
                      setSelectedTroopId(troop.id);
                      setSelectedSpell(null);
                    }}
                    className={`flex-shrink-0 relative w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center bg-slate-900 transition-all ${
                      selectedTroopId === troop.id ? 'border-yellow-400 bg-slate-800' : 'border-gray-800 hover:bg-slate-800'
                    } ${!affordable ? 'opacity-50' : ''}`}
                  >
                     <img src={sprite} alt={troop.id}
                       style={{ width: 28, height: 28, objectFit: 'contain', imageRendering: 'crisp-edges' }}
                       draggable={false} />
                     <span className="text-[8px] font-bold text-gray-300 leading-none truncate w-full text-center px-0.5">{formName}</span>
                     <span className="text-[9px] font-black text-[#facc15] leading-none mt-0.5" style={{ fontFamily: 'Orbitron, monospace' }}>{cost}⚡</span>
                     {tr > 0 && (
                       <span className="absolute -top-1.5 -left-1.5 bg-[#ef4444] text-white text-[8px] font-black px-1 rounded-full border border-white">+{tr}</span>
                     )}
                     {(baseStage > 1) && (
                       <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-black px-1 rounded-full"
                         style={{ background: fam?.accent ?? '#facc15', color: '#0a0e1a' }}>
                         進化{baseStage}
                       </span>
                     )}
                     {cdLeft > 0 && (
                       <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                         <span className="text-white text-xs font-bold">{(cdLeft/1000).toFixed(1)}</span>
                       </div>
                     )}
                     {!isCharUnlocked(troop.id) && (
                       <div className="absolute inset-0 rounded-xl bg-black/70 flex flex-col items-center justify-center gap-0.5">
                         <span className="text-base">🔒</span>
                         <span className="text-[8px] text-[#facc15] font-bold">15⚡</span>
                       </div>
                     )}
                  </button>
               );
            })}

            {/* 一時ランクアップ（選択中の兵種をゴールドで強化） */}
            {selectedTroopId && (() => {
              const fam = CHARACTER_BY_ID[selectedTroopId];
              if (!fam) return null;
              const rankCost = Math.round(fam.cost.gold * 3);
              const can = Math.floor(gold) >= rankCost;
              return (
                <button
                  onClick={() => {
                    if (Math.floor(gold) < rankCost) return;
                    setGold(g => g - rankCost);
                    setTempRank(r => ({ ...r, [selectedTroopId]: (r[selectedTroopId] ?? 0) + 1 }));
                    sfx.correct();
                  }}
                  disabled={!can}
                  className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 transition-all ${
                    can ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#f87171]' : 'border-gray-700 bg-slate-900 opacity-40'
                  }`}
                  style={{ fontFamily: 'Orbitron, monospace' }}
                >
                  <span className="text-lg">⬆️</span>
                  <span className="text-[8px] font-bold leading-none">強化</span>
                  <span className="text-[9px] font-black text-[#facc15] mt-0.5">{rankCost}⚡</span>
                </button>
              );
            })()}
         </div>

       </div>

       {/* 戦闘中クイズ（出撃前に選んだ範囲からランダム出題 → ⚡エナジー獲得）
           ③ 報酬は問題の難易度・所要工程に応じて傾斜配分される（InBattleQuiz 側で算出）。 */}
       {quizOpen && (
         <InBattleQuiz
           subtopics={quizSubtopics}
           baseReward={34}
           onReward={(en) => setGold(g => Math.min(9999, g + en))}
           onClose={() => { setQuizOpen(false); setBattlePaused(false); }}
         />
       )}

       {/* 開戦ブリーフィング（②: 戦いのタイトル・敵の背景・作戦の一言） */}
       {briefingOpen && (
         <div className="absolute inset-0 z-[130] flex items-center justify-center p-4"
           style={{ background: 'rgba(3,6,16,0.93)', backdropFilter: 'blur(6px)' }}>
           <div className="w-full max-w-sm rounded-2xl border p-5 max-h-[90dvh] overflow-y-auto"
             style={{
               borderColor: 'rgba(239,68,68,0.4)',
               background: 'linear-gradient(160deg, rgba(37,99,235,0.16), rgba(239,68,68,0.14)), rgba(6,10,24,0.9)',
               fontFamily: '"M PLUS Rounded 1c", sans-serif',
             }}>
             <div className="text-[10px] tracking-[0.3em] text-[#38bdf8]/80" style={{ fontFamily: 'Orbitron, monospace' }}>
               CHAPTER {chapter.no}
             </div>
             <h2 className="text-white font-black text-xl mt-1 mb-3 leading-tight">{chapter.title}</h2>

             <div className="flex items-start gap-3 p-3 rounded-xl mb-3"
               style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)' }}>
               <span className="text-2xl leading-none">😼</span>
               <div className="min-w-0">
                 <div className="text-[#f87171] font-bold text-sm">{chapter.enemyName}</div>
                 <div className="text-white/45 text-[10px] mb-1">{chapter.enemyTitle}</div>
                 <p className="text-white/75 text-[11px] leading-relaxed">{chapter.background}</p>
               </div>
             </div>

             <p className="text-white/85 text-xs leading-relaxed mb-2">▸ {chapter.briefing}</p>
             <p className="text-[#facc15]/90 text-[11px] leading-relaxed mb-4">💡 {chapter.hint}</p>

             {assistLevel > 0 && (
               <div className="p-2.5 rounded-xl mb-4 text-[11px] leading-relaxed"
                 style={{ background: 'rgba(163,230,53,0.10)', border: '1px solid rgba(163,230,53,0.35)', color: '#a3e635' }}>
                 🛟 <strong>{ASSIST_LEVELS[assistLevel].label}</strong>：{ASSIST_LEVELS[assistLevel].description}
               </div>
             )}

             <button
               onClick={() => { sfx.select(); setBriefingOpen(false); }}
               className="w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-95"
               style={{
                 fontFamily: 'Orbitron, monospace',
                 background: 'rgba(239,68,68,0.2)', border: '2px solid #ef4444', color: '#f87171',
                 boxShadow: '0 0 14px rgba(239,68,68,0.5)',
               }}>
               ⚔️ 作戦かいし！
             </button>
           </div>
         </div>
       )}

    </div>
  );
};

// 戦闘リザルトのレベルアップ/進化サマリー
const LevelUpSummary: React.FC<{ events: import('../../store/useArmyStore').LevelUpEvent[] }> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-xs text-cyan-300/80 mb-2">出撃したネコに経験値が入りました！</div>
    );
  }
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {events.map(ev => {
        const fam = CHARACTER_BY_ID[ev.familyId];
        if (!fam) return null;
        const newForm = fam.forms[ev.newStage - 1];
        return (
          <div key={ev.familyId}
            className="flex items-center gap-2 p-2 rounded-xl"
            style={{ background: `${fam.accent}1a`, border: `1px solid ${fam.accent}55` }}>
            <img src={getCharacterSprite(fam.spriteFamily, ev.newStage)} alt={fam.id}
              style={{ width: 36, height: 36, objectFit: 'contain' }} draggable={false} />
            <div className="flex-1 text-left">
              <div className="text-white font-bold text-xs">
                {ev.evolved ? `✨ 進化！ ${newForm.name}` : `${newForm.name}`}
              </div>
              <div className="text-[10px]" style={{ color: fam.accent }}>
                Lv{ev.fromLevel} → Lv{ev.toLevel}{ev.evolved && ' ・ あたらしいすがた！'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
