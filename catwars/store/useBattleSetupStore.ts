import { create } from 'zustand';
import { DeployedBuilding } from '../types';

interface BattleSetupStore {
  selectedMapId: string;
  playerDeployments: DeployedBuilding[];
  battleTokens: number;
  consecutiveCorrect: number;

  setSelectedMap: (id: string) => void;
  commitPlan: (mapId: string, deployments: DeployedBuilding[]) => void;
  addDeployedBuilding: (b: DeployedBuilding) => void;
  removeDeployedBuilding: (x: number, y: number) => void;
  clearDeployments: () => void;
  addTokens: (n: number) => void;
  spendTokens: (n: number) => boolean;
  recordBattleQuizAnswer: (correct: boolean) => void;
  resetBattleSession: () => void;
}

export const useBattleSetupStore = create<BattleSetupStore>()((set, get) => ({
  selectedMapId: 'map-grassland',
  playerDeployments: [],
  battleTokens: 0,
  consecutiveCorrect: 0,

  setSelectedMap: (id) => set({ selectedMapId: id, playerDeployments: [] }),
  // 戦闘前配置を確定して戦闘へ渡す（配置施設が戦場に出るバグの修正）
  commitPlan: (mapId, deployments) => set({ selectedMapId: mapId, playerDeployments: deployments }),
  addDeployedBuilding: (b) => set(s => ({ playerDeployments: [...s.playerDeployments, b] })),
  removeDeployedBuilding: (x, y) =>
    set(s => ({
      playerDeployments: s.playerDeployments.filter(b => !(b.x === x && b.y === y)),
    })),
  clearDeployments: () => set({ playerDeployments: [] }),
  addTokens: (n) => set(s => ({ battleTokens: s.battleTokens + n })),
  spendTokens: (n) => {
    const { battleTokens } = get();
    if (battleTokens < n) return false;
    set(s => ({ battleTokens: s.battleTokens - n }));
    return true;
  },
  recordBattleQuizAnswer: (correct) => {
    if (correct) {
      const { consecutiveCorrect, addTokens } = get();
      const newStreak = consecutiveCorrect + 1;
      if (newStreak >= 3) {
        addTokens(20); // bonus
        set({ consecutiveCorrect: 0 });
      } else {
        addTokens(10);
        set({ consecutiveCorrect: newStreak });
      }
    } else {
      set({ consecutiveCorrect: 0 });
    }
  },
  resetBattleSession: () =>
    set({
      playerDeployments: [],
      battleTokens: 0,
      consecutiveCorrect: 0,
    }),
}));
