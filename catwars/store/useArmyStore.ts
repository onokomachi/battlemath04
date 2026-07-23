import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncProgressState } from '../utils/syncToSupabase';
import { CHARACTERS, stageForLevel, xpToNext, MAX_LEVEL } from '../data/characters';

export interface ArmyEntry {
  level: number;
  xp: number;        // 現在レベル内の累積XP
  totalBattles: number;
}

export interface LevelUpEvent {
  familyId: string;
  fromLevel: number;
  toLevel: number;
  evolved: boolean;     // 進化段階が上がったか
  newStage: 1 | 2 | 3;
}

interface ArmyStore {
  army: Record<string, ArmyEntry>;
  getEntry: (familyId: string) => ArmyEntry;
  getLevel: (familyId: string) => number;
  getStage: (familyId: string) => 1 | 2 | 3;
  addXp: (familyId: string, amount: number) => LevelUpEvent | null;
  grantBattleXp: (familyIds: string[], won: boolean) => LevelUpEvent[];
  loadFromCloud: (army: Record<string, ArmyEntry>) => void;
  reset: () => void;
}

function defaultArmy(): Record<string, ArmyEntry> {
  const a: Record<string, ArmyEntry> = {};
  for (const c of CHARACTERS) a[c.id] = { level: 1, xp: 0, totalBattles: 0 };
  return a;
}

export const useArmyStore = create<ArmyStore>()(
  persist(
    (set, get) => ({
      army: defaultArmy(),

      getEntry: (familyId) => get().army[familyId] ?? { level: 1, xp: 0, totalBattles: 0 },
      getLevel: (familyId) => (get().army[familyId]?.level ?? 1),
      getStage: (familyId) => stageForLevel(get().army[familyId]?.level ?? 1),

      addXp: (familyId, amount) => {
        const entry = get().army[familyId] ?? { level: 1, xp: 0, totalBattles: 0 };
        const fromLevel = entry.level;
        let level = entry.level;
        let xp = entry.xp + amount;
        while (level < MAX_LEVEL && xp >= xpToNext(level)) {
          xp -= xpToNext(level);
          level += 1;
        }
        if (level >= MAX_LEVEL) xp = 0;
        const updated: ArmyEntry = { level, xp, totalBattles: entry.totalBattles };
        set((s) => {
          const army = { ...s.army, [familyId]: updated };
          syncProgressState({ army });
          return { army };
        });
        if (level > fromLevel) {
          return {
            familyId, fromLevel, toLevel: level,
            evolved: stageForLevel(level) > stageForLevel(fromLevel),
            newStage: stageForLevel(level),
          };
        }
        return null;
      },

      grantBattleXp: (familyIds, won) => {
        const events: LevelUpEvent[] = [];
        const base = won ? 35 : 15;
        // 重複系統はまとめる
        const unique = Array.from(new Set(familyIds));
        set((s) => {
          const army = { ...s.army };
          for (const id of unique) {
            const entry = army[id] ?? { level: 1, xp: 0, totalBattles: 0 };
            const fromLevel = entry.level;
            let level = entry.level;
            let xp = entry.xp + base;
            while (level < MAX_LEVEL && xp >= xpToNext(level)) {
              xp -= xpToNext(level);
              level += 1;
            }
            if (level >= MAX_LEVEL) xp = 0;
            army[id] = { level, xp, totalBattles: entry.totalBattles + 1 };
            if (level > fromLevel) {
              events.push({
                familyId: id, fromLevel, toLevel: level,
                evolved: stageForLevel(level) > stageForLevel(fromLevel),
                newStage: stageForLevel(level),
              });
            }
          }
          syncProgressState({ army });
          return { army };
        });
        return events;
      },

      loadFromCloud: (army) =>
        set((s) => {
          if (!army || Object.keys(army).length === 0) return {};
          // 既存のデフォルトとマージ（新キャラ追加時の欠損を防ぐ）
          const merged = { ...defaultArmy(), ...s.army, ...army };
          return { army: merged };
        }),

      reset: () => {
        const army = defaultArmy();
        syncProgressState({ army });
        return set({ army });
      },
    }),
    { name: 'neo-academia-army' }
  )
);
