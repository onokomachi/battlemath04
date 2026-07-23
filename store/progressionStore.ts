/**
 * store/progressionStore.ts
 *
 * プレイヤーの進捗・ゲーミフィケーション状態 (Zustand)
 * App.tsx から移動。localStorage キー・JSON 形状は完全互換
 * （既存ユーザーのデータを維持）。
 */
import { create } from 'zustand';
import { doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import type { ProblemCard, BadgeDef, ActiveBooster, ShopItemDef } from '../types';
import {
  CARD_DEFINITIONS, BADGE_DEFS, DAILY_QUEST_DEFS, WEEKLY_QUEST_DEFS,
  TITLE_DEFS, getTodayStr, getWeekStart, MATH_CATEGORIES, UNIT_KEYS,
} from '../constants';
import { shuffleDeck } from '../utils/shuffle';
import { getCategoryStats } from '../services/weaknessAnalysisService';
import { getAllMastery, flushDailySummary } from '../services/learningLogService';
import { getLoginReward } from '../components/LoginBonusModal';

// ============================
// Helpers
// ============================
export const expForNextLevel = (level: number): number => 100 + (level - 1) * 50;

// セッション蓄積カウンター (書き込み最小化・非リアクティブ)
export const sessionCounters = { correct: 0, answered: 0 };

export interface LevelUpInfo {
  oldLevel: number;
  newLevel: number;
  mpReward: number;
  newCard: ProblemCard | null;
}

// ============================
// localStorage 初期化 (App.tsx の useState 初期化子と同一)
// ============================
const initMathPoints = (): number => {
  try { return JSON.parse(localStorage.getItem('battleMathPoints') || '1000'); }
  catch { return 1000; }
};
const initOwnedCardIds = (): Set<number> => {
  try {
    const s = localStorage.getItem('battleMathOwnedCardIds');
    if (s) return new Set(JSON.parse(s));
  } catch {}
  return new Set(CARD_DEFINITIONS.slice(0, 20).map(c => c.id));
};
const initPlayerLevel = (): number => {
  try { return JSON.parse(localStorage.getItem('battleMathPlayerLevel') || '1'); }
  catch { return 1; }
};
const initPlayerExp = (): number => {
  try { return JSON.parse(localStorage.getItem('battleMathPlayerExp') || '0'); }
  catch { return 0; }
};
const initUserLevelStats = (): Record<number, { avgTime: number; count: number }> => {
  try {
    const s = localStorage.getItem('battleMathUserLevelStats');
    return s ? JSON.parse(s) : {
      1: { avgTime: 5000, count: 0 }, 2: { avgTime: 10000, count: 0 },
      3: { avgTime: 20000, count: 0 }, 4: { avgTime: 40000, count: 0 },
      5: { avgTime: 60000, count: 0 }
    };
  } catch { return { 1: { avgTime: 5000, count: 0 }, 2: { avgTime: 10000, count: 0 }, 3: { avgTime: 20000, count: 0 }, 4: { avgTime: 40000, count: 0 }, 5: { avgTime: 60000, count: 0 } }; }
};
const initOwnedShopItems = (): Set<string> => {
  try {
    const s = localStorage.getItem('bm_owned_shop_items');
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
};
const initEquippedTitle = (): string | null => {
  try { return localStorage.getItem('bm_equipped_title') || null; }
  catch { return null; }
};
const initEarnedTitleIds = (): Set<string> => {
  try {
    const s = localStorage.getItem('bm_earned_titles');
    return s ? new Set(JSON.parse(s)) : new Set(['title_newcomer']);
  } catch { return new Set(['title_newcomer']); }
};
const initEquippedTheme = (): string | null => {
  try { return localStorage.getItem('bm_equipped_theme') || null; }
  catch { return null; }
};
const initActiveBooster = (): ActiveBooster | null => {
  try {
    const s = localStorage.getItem('bm_active_booster');
    if (!s) return null;
    const b = JSON.parse(s) as ActiveBooster;
    return Date.now() < b.expiresAt ? b : null;
  } catch { return null; }
};
const initHintTokens = (): number => {
  try { return parseInt(localStorage.getItem('bm_hint_tokens') || '0', 10); }
  catch { return 0; }
};

// ============================
// State / Actions
// ============================
interface ProgressionState {
  // 認証 (Firestore 書き込みに必要)
  uid: string | null;
  // 進捗 (localStorage + Firestore 同期)
  mathPoints: number;
  ownedCardIds: Set<number>;
  playerLevel: number;
  playerExp: number;
  userLevelStats: Record<number, { avgTime: number; count: number }>;
  // ショップ・称号・テーマ・消耗品
  ownedShopItems: Set<string>;
  equippedTitle: string | null;
  equippedTheme: string | null;
  earnedTitleIds: Set<string>;
  activeBooster: ActiveBooster | null;
  hintTokens: number;
  expBoosterActive: boolean;
  tutorialDone: boolean;
  // メモリのみ (Firestore からハイドレート)
  loginStreak: number;
  totalWins: number;
  totalCorrectAnswers: number;
  chainCount: number;
  earnedBadgeIds: Set<string>;
  // クエスト進捗 (日付キー付き localStorage)
  dailyQuestProgress: Record<string, number>;
  dailyQuestDone: Set<string>;
  weeklyQuestProgress: Record<string, number>;
  weeklyQuestDone: Set<string>;
  // 一時的 UI 状態
  levelUpInfo: LevelUpInfo | null;
  pendingBadge: BadgeDef | null;

  // --- セッター (ハイドレート / UI 用) ---
  setUid: (uid: string | null) => void;
  setMathPoints: (n: number) => void;
  addMathPoints: (n: number) => void;
  setPlayerLevel: (n: number) => void;
  setPlayerExp: (n: number) => void;
  setOwnedCardIds: (ids: Set<number>) => void;
  setEarnedBadgeIds: (ids: Set<string>) => void;
  setTotalCorrectAnswers: (n: number) => void;
  setTotalWins: (n: number) => void;
  mergeEarnedTitleIds: (ids: string[]) => void;
  setLoginStreak: (n: number) => void;
  setChainCount: (n: number) => void;
  consumeStreakShield: () => void;
  hydrateQuests: () => void;
  setEquippedTitle: (titleId: string | null) => void;
  setEquippedTheme: (themeId: string | null) => void;
  setTutorialDone: (done: boolean) => void;
  setLevelUpInfo: (info: LevelUpInfo | null) => void;
  setPendingBadge: (badge: BadgeDef | null) => void;
  recordSolveTime: (difficulty: number, solveTime: number) => void;
  incrementTotalWins: () => number;

  // --- ゲーミフィケーションアクション ---
  earnBadge: (badgeId: string) => void;
  handleQuestProgress: (type: 'correct' | 'pvp_match') => void;
  earnTitle: (titleId: string) => void;
  checkTitleConditions: () => void;
  checkMonthlyChampion: () => Promise<void>;
  onCorrectAnswerEvent: (isCorrect: boolean) => void;
  flushSessionData: () => Promise<void>;
  addBoostedMp: (amount: number) => void;
  /** CPU戦の報酬(1日の獲得上限あり・荒稼ぎ防止)。実際に付与された額を返す */
  addCpuBattleMp: (baseAmount: number) => number;
  addExp: (amount: number) => void;
  claimLoginBonus: () => void;
  handleShopPurchase: (item: ShopItemDef) => void;
  checkCategoryMasterBadges: () => void;
  buyCardPack: (mainCategory: string, cost: number) => ProblemCard[] | null;
}

export const useProgressionStore = create<ProgressionState>((set, get) => {
  // Firestore 書き込みヘルパー (旧 saveUserToFirestore 相当)
  const saveUser = (updates: Record<string, any>) => {
    const { uid } = get();
    if (!uid || !db) return;
    updateDoc(doc(db, 'users', uid), updates)
      .catch((e) => console.error('Firestore update error:', e));
  };

  return {
    uid: null,
    mathPoints: initMathPoints(),
    ownedCardIds: initOwnedCardIds(),
    playerLevel: initPlayerLevel(),
    playerExp: initPlayerExp(),
    userLevelStats: initUserLevelStats(),
    ownedShopItems: initOwnedShopItems(),
    equippedTitle: initEquippedTitle(),
    equippedTheme: initEquippedTheme(),
    earnedTitleIds: initEarnedTitleIds(),
    activeBooster: initActiveBooster(),
    hintTokens: initHintTokens(),
    expBoosterActive: localStorage.getItem('bm_exp_booster') === '1',
    tutorialDone: localStorage.getItem('bm_tutorial_done') === '1',
    loginStreak: 0,
    totalWins: 0,
    totalCorrectAnswers: 0,
    chainCount: 0,
    earnedBadgeIds: new Set<string>(),
    dailyQuestProgress: {},
    dailyQuestDone: new Set<string>(),
    weeklyQuestProgress: {},
    weeklyQuestDone: new Set<string>(),
    levelUpInfo: null,
    pendingBadge: null,

    // --- セッター ---
    setUid: (uid) => set({ uid }),
    setMathPoints: (n) => set({ mathPoints: n }),
    addMathPoints: (n) => set(s => ({ mathPoints: s.mathPoints + n })),
    setPlayerLevel: (n) => set({ playerLevel: n }),
    setPlayerExp: (n) => set({ playerExp: n }),
    setOwnedCardIds: (ids) => set({ ownedCardIds: ids }),
    setEarnedBadgeIds: (ids) => set({ earnedBadgeIds: ids }),
    setTotalCorrectAnswers: (n) => set({ totalCorrectAnswers: n }),
    setTotalWins: (n) => set({ totalWins: n }),
    mergeEarnedTitleIds: (ids) => set(s => ({ earnedTitleIds: new Set([...s.earnedTitleIds, ...ids]) })),
    setLoginStreak: (n) => set({ loginStreak: n }),
    setChainCount: (n) => set({ chainCount: n }),
    consumeStreakShield: () => set(s => {
      const n = new Set(s.ownedShopItems);
      n.delete('streak_shield');
      return { ownedShopItems: n };
    }),
    // クエスト進捗を localStorage から復元 (ログイン時)
    hydrateQuests: () => {
      const dqKey = `bm_dq_${getTodayStr()}`;
      const wqKey = `bm_wq_${getWeekStart()}`;
      try {
        set({ dailyQuestProgress: JSON.parse(localStorage.getItem(dqKey) || '{}') });
        set({ weeklyQuestProgress: JSON.parse(localStorage.getItem(wqKey) || '{}') });
        set({ dailyQuestDone: new Set(JSON.parse(localStorage.getItem(`${dqKey}_done`) || '[]')) });
        set({ weeklyQuestDone: new Set(JSON.parse(localStorage.getItem(`${wqKey}_done`) || '[]')) });
      } catch {}
    },
    setEquippedTitle: (titleId) => set({ equippedTitle: titleId }),
    setEquippedTheme: (themeId) => set({ equippedTheme: themeId }),
    setTutorialDone: (done) => {
      if (done) localStorage.setItem('bm_tutorial_done', '1');
      else localStorage.removeItem('bm_tutorial_done');
      set({ tutorialDone: done });
    },
    setLevelUpInfo: (info) => set({ levelUpInfo: info }),
    setPendingBadge: (badge) => set({ pendingBadge: badge }),
    // DDA 統計更新 (カードバトル正解時)
    recordSolveTime: (difficulty, solveTime) => set(st => {
      const s = st.userLevelStats[difficulty] || { avgTime: 20000, count: 0 };
      return {
        userLevelStats: {
          ...st.userLevelStats,
          [difficulty]: { avgTime: (s.avgTime * s.count + solveTime) / (s.count + 1), count: s.count + 1 },
        },
      };
    }),
    incrementTotalWins: () => {
      const next = get().totalWins + 1;
      set({ totalWins: next });
      return next;
    },

    // ============================
    // バッジ獲得
    // エビデンスB: 自己決定理論 × 有能感フィードバック（Deci & Ryan 1985）
    // ============================
    earnBadge: (badgeId) => {
      const s = get();
      if (s.earnedBadgeIds.has(badgeId)) return;
      const badge = BADGE_DEFS.find(b => b.id === badgeId);
      if (!badge) return;
      // Firestore にバッジ追加 (arrayUnion で冪等性確保)
      if (s.uid && db) {
        updateDoc(doc(db, 'users', s.uid), {
          earnedBadgeIds: arrayUnion(badgeId),
          mathPoints: increment(100),
        }).catch(() => {});
      }
      set(st => ({
        pendingBadge: badge,
        mathPoints: st.mathPoints + 100,
        earnedBadgeIds: new Set(st.earnedBadgeIds).add(badgeId),
      }));
    },

    // ============================
    // クエスト進捗更新
    // エビデンスA: 目標設定理論（Locke & Latham 1990）
    // ============================
    handleQuestProgress: (type) => {
      const dqKey = `bm_dq_${getTodayStr()}`;
      const wqKey = `bm_wq_${getWeekStart()}`;
      const s = get();
      let mpGain = 0;

      // デイリー
      const dNext = { ...s.dailyQuestProgress };
      if (type === 'correct') {
        dNext['dq_5'] = (dNext['dq_5'] || 0) + 1;
        dNext['dq_15'] = (dNext['dq_15'] || 0) + 1;
        dNext['dq_30'] = (dNext['dq_30'] || 0) + 1;
      } else if (type === 'pvp_match') {
        dNext['dq_pvp'] = (dNext['dq_pvp'] || 0) + 1;
      }
      localStorage.setItem(dqKey, JSON.stringify(dNext));
      // クエスト達成チェック
      const dDone = new Set(s.dailyQuestDone);
      DAILY_QUEST_DEFS.forEach(q => {
        if (!dDone.has(q.id) && (dNext[q.id] || 0) >= q.target) {
          dDone.add(q.id);
          mpGain += q.reward.mp;
          if (s.uid && db) {
            updateDoc(doc(db, 'users', s.uid), { mathPoints: increment(q.reward.mp) }).catch(() => {});
          }
        }
      });
      localStorage.setItem(`${dqKey}_done`, JSON.stringify([...dDone]));

      // ウィークリー
      const wNext = { ...s.weeklyQuestProgress };
      if (type === 'correct') {
        wNext['wq_50'] = (wNext['wq_50'] || 0) + 1;
        wNext['wq_100'] = (wNext['wq_100'] || 0) + 1;
      } else if (type === 'pvp_match') {
        wNext['wq_pvp3'] = (wNext['wq_pvp3'] || 0) + 1;
      }
      localStorage.setItem(wqKey, JSON.stringify(wNext));
      const wDone = new Set(s.weeklyQuestDone);
      WEEKLY_QUEST_DEFS.forEach(q => {
        if (!wDone.has(q.id) && (wNext[q.id] || 0) >= q.target) {
          wDone.add(q.id);
          mpGain += q.reward.mp;
          if (s.uid && db) {
            updateDoc(doc(db, 'users', s.uid), { mathPoints: increment(q.reward.mp) }).catch(() => {});
          }
        }
      });
      localStorage.setItem(`${wqKey}_done`, JSON.stringify([...wDone]));

      set(st => ({
        dailyQuestProgress: dNext,
        dailyQuestDone: dDone,
        weeklyQuestProgress: wNext,
        weeklyQuestDone: wDone,
        mathPoints: st.mathPoints + mpGain,
      }));
    },

    // ============================
    // 称号システム
    // ============================
    earnTitle: (titleId) => {
      const s = get();
      if (s.earnedTitleIds.has(titleId)) return;
      if (!TITLE_DEFS.find(t => t.id === titleId)) return;
      if (s.uid && db) {
        updateDoc(doc(db, 'users', s.uid), {
          earnedTitleIds: arrayUnion(titleId),
        }).catch(() => {});
      }
      set(st => ({ earnedTitleIds: new Set(st.earnedTitleIds).add(titleId) }));
    },

    checkTitleConditions: () => {
      const s = get();
      TITLE_DEFS.filter(t => !t.isMonthly).forEach(title => {
        const { type, value = 0, badgeId } = title.condition;
        let satisfied = false;
        switch (type) {
          case 'any': satisfied = true; break;
          case 'total_correct': satisfied = s.totalCorrectAnswers >= value; break;
          case 'total_wins': satisfied = s.totalWins >= value; break;
          case 'login_streak': satisfied = s.loginStreak >= value; break;
          case 'level': satisfied = s.playerLevel >= value; break;
          case 'badge_owned': satisfied = !!badgeId && s.earnedBadgeIds.has(badgeId); break;
        }
        if (satisfied) get().earnTitle(title.id);
      });
    },

    checkMonthlyChampion: async () => {
      const { uid } = get();
      if (!db || !uid) return;
      try {
        const monthKey = new Date().toISOString().slice(0, 7);
        const snap = await getDoc(doc(db, 'config', `monthly_champion_${monthKey}`));
        const isChampion = snap.exists() && snap.data()?.winnerUid === uid;
        if (isChampion) {
          get().earnTitle('title_monthly_champion');
        } else {
          set(st => {
            const next = new Set(st.earnedTitleIds);
            next.delete('title_monthly_champion');
            return {
              earnedTitleIds: next,
              equippedTitle: st.equippedTitle === 'title_monthly_champion' ? null : st.equippedTitle,
            };
          });
        }
      } catch {}
    },

    // ============================
    // 正解イベント統合処理
    // チェイン・バッジ・クエスト・クラス蓄積
    // ============================
    onCorrectAnswerEvent: (isCorrect) => {
      // 全回答数をトラック（正答率計算用）
      sessionCounters.answered += 1;
      if (isCorrect) {
        // チェインカウンター更新
        const nextChain = get().chainCount + 1;
        set({ chainCount: nextChain });
        if (nextChain === 5) get().earnBadge('chain_5');
        if (nextChain === 10) get().earnBadge('chain_10');
        if (nextChain === 20) get().earnBadge('chain_20');
        // 累積カウンター
        sessionCounters.correct += 1;
        const nextCorrect = get().totalCorrectAnswers + 1;
        set({ totalCorrectAnswers: nextCorrect });
        if (nextCorrect === 1) get().earnBadge('first_correct');
        if (nextCorrect === 50) get().earnBadge('correct_50');
        if (nextCorrect === 100) get().earnBadge('correct_100');
        if (nextCorrect === 500) get().earnBadge('correct_500');
        if (nextCorrect === 1000) get().earnBadge('correct_1000');
        // クエスト進捗
        get().handleQuestProgress('correct');
      } else {
        // 不正解: チェインリセット
        set({ chainCount: 0 });
      }
    },

    // ============================
    // セッションデータ書き込み (Firestore quota最小化)
    // ============================
    flushSessionData: async () => {
      const { uid } = get();
      if (!uid || !db) return;
      const updates: Record<string, any> = {};
      if (sessionCounters.correct > 0) {
        updates.totalCorrectAnswers = increment(sessionCounters.correct);
        sessionCounters.correct = 0;
      }
      if (sessionCounters.answered > 0) {
        updates.totalAnswered = increment(sessionCounters.answered);
        sessionCounters.answered = 0;
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', uid), updates).catch(() => {});
      }
      // 先生向け学習分析: 端末に集計した日次サマリを1回のsetDoc(merge)で送信
      await flushDailySummary(db, uid).catch(() => {});
    },

    /** MPブースターが有効な場合、MP報酬を倍増して加算 */
    addBoostedMp: (amount) => {
      const s = get();
      const boosted = s.activeBooster?.type === 'mp_booster' && Date.now() < (s.activeBooster?.expiresAt || 0)
        ? Math.round(amount * s.activeBooster.multiplier)
        : amount;
      set(st => ({ mathPoints: st.mathPoints + boosted }));
      if (s.uid && db) {
        updateDoc(doc(db, 'users', s.uid), { mathPoints: increment(boosted) }).catch(() => {});
      }
    },

    // ============================
    // CPU戦の報酬に1日の上限を設ける(かんたんな相手に連戦して荒稼ぎするのを防ぐ)
    // ============================
    addCpuBattleMp: (baseAmount) => {
      const s = get();
      const boosted = s.activeBooster?.type === 'mp_booster' && Date.now() < (s.activeBooster?.expiresAt || 0)
        ? Math.round(baseAmount * s.activeBooster.multiplier)
        : baseAmount;
      const CPU_DAILY_MP_CAP = 500;
      const capKey = `battleMathCpuMpEarned_${getTodayStr()}`;
      let earnedToday = 0;
      try { earnedToday = JSON.parse(localStorage.getItem(capKey) || '0'); } catch { earnedToday = 0; }
      const granted = Math.max(0, Math.min(boosted, CPU_DAILY_MP_CAP - earnedToday));
      if (granted > 0) {
        localStorage.setItem(capKey, JSON.stringify(earnedToday + granted));
        set(st => ({ mathPoints: st.mathPoints + granted }));
        if (s.uid && db) {
          updateDoc(doc(db, 'users', s.uid), { mathPoints: increment(granted) }).catch(() => {});
        }
      }
      return granted;
    },

    // ============================
    // Progression (EXP / レベルアップ)
    // ============================
    addExp: (amount) => {
      const s = get();
      const boostedAmount = s.expBoosterActive ? amount * 2 : amount;
      if (s.expBoosterActive) {
        set({ expBoosterActive: false });
      }
      let currentExp = s.playerExp + boostedAmount;
      let currentLevel = s.playerLevel;
      const oldLevel = currentLevel;
      let totalMpReward = 0;
      while (currentExp >= expForNextLevel(currentLevel)) {
        currentExp -= expForNextLevel(currentLevel);
        currentLevel++;
        totalMpReward += currentLevel * 100;
      }
      if (currentLevel > oldLevel) {
        let newCard: ProblemCard | null = null;
        const unowned = CARD_DEFINITIONS.filter(c => !s.ownedCardIds.has(c.id));
        if (unowned.length > 0) {
          newCard = shuffleDeck(unowned)[0];
          set(st => ({ ownedCardIds: new Set(st.ownedCardIds).add(newCard!.id) }));
        } else {
          totalMpReward += 500;
        }
        set(st => ({
          mathPoints: st.mathPoints + totalMpReward,
          levelUpInfo: { oldLevel, newLevel: currentLevel, mpReward: totalMpReward, newCard },
          playerLevel: currentLevel,
        }));
        // increment で加算し、残高巻き戻しを防ぐ
        saveUser({ playerLevel: currentLevel, mathPoints: increment(totalMpReward) });
      }
      set({ playerExp: currentExp });
      saveUser({ playerExp: currentExp });
    },

    // ============================
    // ログインボーナス受け取り
    // ============================
    claimLoginBonus: () => {
      const s = get();
      const reward = getLoginReward(s.loginStreak);
      set(st => ({ mathPoints: st.mathPoints + reward }));
      if (s.uid && db) {
        updateDoc(doc(db, 'users', s.uid), {
          mathPoints: increment(reward),
          loginBonusClaimedDate: getTodayStr(),
        }).catch(() => {});
      }
    },

    // ============================
    // アイテムショップ購入
    // ============================
    handleShopPurchase: (item) => {
      const s = get();
      if (s.mathPoints < item.cost) return;
      // 消耗品は重複購入可
      if (item.type !== 'hint_token' && item.type !== 'mp_booster' && item.type !== 'exp_booster') {
        if (s.ownedShopItems.has(item.id)) return;
      }
      set(st => ({ mathPoints: st.mathPoints - item.cost }));
      if (s.uid && db) {
        updateDoc(doc(db, 'users', s.uid), { mathPoints: increment(-item.cost) }).catch(() => {});
      }
      // 消耗品処理
      if (item.type === 'hint_token') {
        set(st => ({ hintTokens: st.hintTokens + 1 }));
        return;
      }
      if (item.type === 'mp_booster') {
        const booster: ActiveBooster = { type: 'mp_booster', expiresAt: Date.now() + (item.durationMs || 3600000), multiplier: 2 };
        set({ activeBooster: booster });
        return;
      }
      if (item.type === 'exp_booster') {
        set({ expBoosterActive: true });
        return;
      }
      // 通常アイテム（シールド・テーマ）
      set(st => ({ ownedShopItems: new Set([...st.ownedShopItems, item.id]) }));
      if (item.type === 'streak_shield' && s.uid && db) {
        updateDoc(doc(db, 'users', s.uid), { hasStreakShield: true }).catch(() => {});
      }
    },

    // 単元マスターバッジチェック
    // (統計はサブトピック単位で記録されるため、MATH_CATEGORIES で単元ごとに集計する)
    checkCategoryMasterBadges: () => {
      const stats = getCategoryStats();
      const skillMastery = getAllMastery();
      let masteredCount = 0;
      MATH_CATEGORIES.forEach(unit => {
        const key = UNIT_KEYS[unit.name];
        if (!key) return;
        const subtopics = unit.groups.flatMap(g => g.subtopics);
        // ワールドクリア: 全サブトピックで1問以上 正解した
        const cleared = subtopics.every(st => (skillMastery[st]?.corrects ?? 0) > 0);
        if (cleared) get().earnBadge(`world_${key}`);
        // 単元マスター: 単元合計10問以上・正答率85%以上
        let correct = 0;
        let total = 0;
        subtopics.forEach(st => {
          const s = stats[st];
          if (s) { correct += s.correct; total += s.total; }
        });
        if (total >= 10 && correct / total >= 0.85) {
          get().earnBadge(`master_${key}`);
          masteredCount++;
        }
      });
      if (masteredCount >= MATH_CATEGORIES.length) {
        get().earnBadge('all_master');
      }
    },

    // ============================
    // カードパック購入 (CardShop)
    // エビデンスA: 可変報酬スケジュール — 3〜6枚ランダム + 20%でCRITICAL!（Skinner 1938）
    // ============================
    buyCardPack: (mainCategory, cost) => {
      const s = get();
      const cards = CARD_DEFINITIONS.filter(c => !s.ownedCardIds.has(c.id) && c.mainCategory === mainCategory);
      if (s.mathPoints < cost || cards.length === 0) return cards.length === 0 ? [] : null;
      const isCritical = Math.random() < 0.2;
      const baseCount = 3 + Math.floor(Math.random() * 2); // 3 or 4
      const packCount = Math.min(cards.length, isCritical ? baseCount + 2 : baseCount);
      const newCards = shuffleDeck(cards).slice(0, packCount);
      set(st => {
        const next = new Set(st.ownedCardIds);
        newCards.forEach(c => next.add(c.id));
        return { mathPoints: st.mathPoints - cost, ownedCardIds: next };
      });
      // increment を使い、並行更新(クエスト報酬等)との残高ずれを防ぐ
      saveUser({
        mathPoints: increment(-cost),
        ownedCardIds: arrayUnion(...newCards.map(c => c.id)),
      });
      return newCards;
    },
  };
});

// ============================
// localStorage 永続化 (旧 App.tsx の useEffect と同一キー・形状)
// ============================
type PersistedKey =
  | 'mathPoints' | 'ownedCardIds' | 'playerLevel' | 'playerExp' | 'userLevelStats'
  | 'ownedShopItems' | 'equippedTitle' | 'equippedTheme' | 'earnedTitleIds'
  | 'hintTokens' | 'expBoosterActive' | 'activeBooster';

const PERSISTED_KEYS: PersistedKey[] = [
  'mathPoints', 'ownedCardIds', 'playerLevel', 'playerExp', 'userLevelStats',
  'ownedShopItems', 'equippedTitle', 'equippedTheme', 'earnedTitleIds',
  'hintTokens', 'expBoosterActive', 'activeBooster',
];

const persistToLocalStorage = (s: ProgressionState) => {
  localStorage.setItem('battleMathPoints', JSON.stringify(s.mathPoints));
  localStorage.setItem('battleMathOwnedCardIds', JSON.stringify(Array.from(s.ownedCardIds)));
  localStorage.setItem('battleMathPlayerLevel', JSON.stringify(s.playerLevel));
  localStorage.setItem('battleMathPlayerExp', JSON.stringify(s.playerExp));
  localStorage.setItem('battleMathUserLevelStats', JSON.stringify(s.userLevelStats));
  localStorage.setItem('bm_owned_shop_items', JSON.stringify(Array.from(s.ownedShopItems)));
  if (s.equippedTitle) localStorage.setItem('bm_equipped_title', s.equippedTitle);
  else localStorage.removeItem('bm_equipped_title');
  if (s.equippedTheme) localStorage.setItem('bm_equipped_theme', s.equippedTheme);
  else localStorage.removeItem('bm_equipped_theme');
  localStorage.setItem('bm_earned_titles', JSON.stringify(Array.from(s.earnedTitleIds)));
  localStorage.setItem('bm_hint_tokens', String(s.hintTokens));
  if (s.expBoosterActive) localStorage.setItem('bm_exp_booster', '1');
  else localStorage.removeItem('bm_exp_booster');
  if (s.activeBooster && Date.now() < s.activeBooster.expiresAt) {
    localStorage.setItem('bm_active_booster', JSON.stringify(s.activeBooster));
  } else {
    localStorage.removeItem('bm_active_booster');
  }
};

useProgressionStore.subscribe((state, prevState) => {
  if (PERSISTED_KEYS.some(k => state[k] !== prevState[k])) {
    persistToLocalStorage(state);
  }
});
// 初回書き込み (旧 useEffect のマウント時実行に相当: デフォルト値の確定・期限切れブースターの除去)
persistToLocalStorage(useProgressionStore.getState());
