/**
 * App.tsx - BattleMath Online v3.0
 *
 * 統合機能:
 *  - Firebase Authentication (Google OAuth + Guest)  [エビデンスA: Firebase公式パターン]
 *  - HP制カードバトル (aicardbattle2より移植)        [エビデンスB: 標準カードゲーム設計]
 *  - PvP マルチプレイヤー (Firestore リアルタイム)   [エビデンスA: Firebase onSnapshot]
 *  - ランキングボード                               [エビデンスA: Firestore query/orderBy]
 *  - 管理画面 (GameMaster)                          [エビデンスB: RBAC管理UI設計]
 *  - DDA (Dynamic Difficulty Adjustment)            [エビデンスB: ゲームAI適応設計]
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut,
  type User
} from 'firebase/auth';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, increment,
  collection, onSnapshot, query, serverTimestamp,
  runTransaction, where,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import type { ProblemCard, TurnPhase, GameState, TurnInitiative, Room, BattleMode, BattleFormat, StudentProfile } from './types';
import {
  CARD_DEFINITIONS, HAND_SIZE, DECK_SIZE,
  INITIAL_HP, calcDamage, ADMIN_EMAILS,
  DAILY_QUEST_DEFS, getTodayStr,
  SHOP_ITEMS, TITLE_DEFS, THEME_CONFIGS, DEFAULT_SCHOOL_YEAR, getCurrentSchoolYear,
  SCHOOL_NAME, TARGET_GRADE,
} from './constants';
import GameBoard from './components/GameBoard';
import DeckBuilder from './components/DeckBuilder';
import MainMenu from './components/MainMenu';
import PracticeMode from './components/PracticeMode';
import CardShop from './components/CardShop';
import LevelUpModal from './components/LevelUpModal';
import AdminPasswordModal from './components/AdminPasswordModal';
import GravityBackground from './components/GravityBackground';
import LoginScreen from './components/LoginScreen';
import Matchmaking from './components/Matchmaking';
import GameMaster from './components/GameMaster';
import QuestPanel from './components/QuestPanel';
import BadgeNotification from './components/BadgeNotification';
import LoginBonusModal, { getLoginReward } from './components/LoginBonusModal';
import ClassBattleBoard from './components/ClassBattleBoard';
import { checkAnswer } from './utils/answerChecker';
import { recordProblemLog, type TestBests } from './services/learningLogService';
import { fetchLockedUnits } from './services/unitLockService';
import { fetchAdminEmails } from './services/adminAccessService';
import { getEquippedBackground, setEquippedBackground, badgeRatio, isBackgroundUnlocked, type BackgroundId } from './utils/backgroundUnlock';
import BackgroundFX from './components/BackgroundFX';
import MockTestMode from './components/MockTestMode';
import LearningLogScreen from './components/LearningLogScreen';
import {
  SPEED_DUEL_TIME_LIMIT_SEC, SPEED_DUEL_COUNTDOWN_MS, SPEED_CPU,
  speedCpuAccuracy, SPEED_DUEL_REWARDS,
} from './constants/gameBalance';
import { addIncorrectToSrs, getDueCount } from './services/spacedRepetitionService';
import { recordAttempt, getCategoryWeights } from './services/weaknessAnalysisService';
import WeaknessPanel from './components/WeaknessPanel';
import ItemShop from './components/ItemShop';
import TutorialBattle from './components/TutorialBattle';
import SpeedDuelSetup from './components/SpeedDuelSetup';
import SpeedDuelBoard from './components/SpeedDuelBoard';
import NewYearPrompt from './components/NewYearPrompt';
import ReviewMode from './components/ReviewMode';
import type { BattleType, Problem, SpeedProblem } from './types';
import { shuffleDeck } from './utils/shuffle';
import { useProgressionStore, expForNextLevel, sessionCounters } from './store/progressionStore';
import {
  usePvpConnection, type SavedPvpSession,
  saveActivePvpSession, loadActivePvpSession, clearActivePvpSession, PVP_RESUME_MAX_AGE_MS,
} from './hooks/usePvpConnection';

// 採点は utils/answerChecker.ts に一本化（カードバトル・スピード対戦・練習モード共通）

// シャッフルは utils/shuffle.ts (Fisher-Yates)、進捗・ゲーミフィケーション状態は
// store/progressionStore.ts (Zustand) に一本化

// ============================
// App Component
// ============================
const App: React.FC = () => {
  // --- Auth ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  // --- Student Profile (学年・組・番号) ---
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(() => {
    try {
      const s = localStorage.getItem('battleMathStudentProfile');
      if (!s) return null;
      const sp = JSON.parse(s);
      // 自校のみの簡易プロファイル: 学校名と学年を固定値にそろえる
      if (sp && (!sp.school || sp.grade !== TARGET_GRADE)) {
        sp.school = SCHOOL_NAME;
        sp.grade = TARGET_GRADE;
        sp.displayLabel = `${TARGET_GRADE}年${sp.classNum}組${sp.number}番`;
      }
      // 既存プロフィールに schoolYear がない場合はデフォルト設定
      if (sp && !sp.schoolYear) {
        sp.schoolYear = DEFAULT_SCHOOL_YEAR;
      }
      localStorage.setItem('battleMathStudentProfile', JSON.stringify(sp));
      return sp;
    } catch { return null; }
  });

  // --- New Year Prompt ---
  const [showNewYearPrompt, setShowNewYearPrompt] = useState(false);
  const newYearCheckedRef = useRef(false);

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>('login_screen');
  const [gameMode, setGameMode] = useState<BattleMode>('cpu');
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('selecting_card');
  const [initiative, setInitiative] = useState<TurnInitiative>('player');

  // --- Player Progression & ゲーミフィケーション (Zustand store) ---
  // localStorage 永続化・Firestore 書き込みはストア内で行う
  const {
    mathPoints, ownedCardIds, playerLevel, playerExp, userLevelStats,
    levelUpInfo, setLevelUpInfo, pendingBadge, setPendingBadge,
    loginStreak, totalWins, totalCorrectAnswers, chainCount, setChainCount,
    earnedBadgeIds, ownedShopItems, equippedTitle, setEquippedTitle,
    equippedTheme, setEquippedTheme, earnedTitleIds, hintTokens,
    tutorialDone, setTutorialDone,
    dailyQuestProgress, dailyQuestDone, weeklyQuestProgress, weeklyQuestDone,
    setUid, earnBadge, handleQuestProgress, checkTitleConditions,
    onCorrectAnswerEvent: recordAnswerOutcome, flushSessionData,
    addBoostedMp, addCpuBattleMp, addExp, claimLoginBonus, handleShopPurchase,
    checkCategoryMasterBadges, buyCardPack, recordSolveTime,
    addMathPoints, incrementTotalWins,
  } = useProgressionStore();

  // --- Battle State ---
  const [playerDeck, setPlayerDeck] = useState<ProblemCard[]>([]);
  const [pcDeck, setPcDeck] = useState<ProblemCard[]>([]);
  const [playerHand, setPlayerHand] = useState<ProblemCard[]>([]);
  const [pcHand, setPcHand] = useState<ProblemCard[]>([]);
  const [playerHP, setPlayerHP] = useState(INITIAL_HP);
  const [pcHP, setPcHP] = useState(INITIAL_HP);
  const [playerScore, setPlayerScore] = useState(0);
  const [pcScore, setPcScore] = useState(0);
  const [playerPlayedCard, setPlayerPlayedCard] = useState<ProblemCard | null>(null);
  const [pcPlayedCard, setPcPlayedCard] = useState<ProblemCard | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [playerAnswered, setPlayerAnswered] = useState(false);
  const [pcAnswered, setPcAnswered] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [mismatchRound, setMismatchRound] = useState(false);
  const [battleFormat, setBattleFormat] = useState<BattleFormat>('master_duel');
  const [playerRoundWins, setPlayerRoundWins] = useState(0);
  const [pcRoundWins, setPcRoundWins] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);

  // --- Speed Duel State ---
  const [battleType, setBattleType] = useState<BattleType>('card_battle');
  const [speedCategories, setSpeedCategories] = useState<string[]>([]);
  const [speedProblems, setSpeedProblems] = useState<SpeedProblem[]>([]);
  const [speedRound, setSpeedRound] = useState(1);
  const [speedTotalRounds, setSpeedTotalRounds] = useState(5);
  const [speedPlayerScore, setSpeedPlayerScore] = useState(0);
  const [speedOpponentScore, setSpeedOpponentScore] = useState(0);
  const [speedPhase, setSpeedPhase] = useState<'countdown' | 'answering' | 'round_result' | 'match_over'>('countdown');
  const [speedRoundWinner, setSpeedRoundWinner] = useState<'player' | 'opponent' | 'draw' | null>(null);
  const [speedPlayerAnswered, setSpeedPlayerAnswered] = useState(false);
  const [speedOpponentAnswered, setSpeedOpponentAnswered] = useState(false);
  const [speedTimeLeft, setSpeedTimeLeft] = useState(30);
  const [speedGameResult, setSpeedGameResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const speedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speedCpuTimerRef = useRef<NodeJS.Timeout | null>(null);


  // --- PvP State ---
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);
  const isHostRef = useRef(isHost);
  const processedMatchIdRef = useRef<string | null>(null);
  const pvpDeckRef = useRef<ProblemCard[]>([]);
  const currentRoomIdRef = useRef<string | null>(null);
  const gameModeRef = useRef<BattleMode>('cpu');
  const gameStateRef = useRef<GameState>(gameState);
  const speedPhaseRef = useRef(speedPhase);
  const battleTypeRef = useRef<BattleType>(battleType);

  // PvP接続レイヤー（ルーム一覧監視・leaveRoom・ハートビート）は hooks/usePvpConnection.ts に分離
  const { rooms, firestoreError, leaveRoom } = usePvpConnection({
    gameState, currentRoomId, user, isHostRef, currentRoomIdRef,
  });

  // --- 単元ロック(先生が管理画面から設定。未学習単元のカードを使えなくする) ---
  const [lockedUnits, setLockedUnits] = useState<Set<string>>(new Set());
  useEffect(() => {
    // 起動時に1回だけ読む(オフライン時はキャッシュ→全開放)
    fetchLockedUnits(db).then(setLockedUnits).catch(() => {});
  }, []);

  // --- 追加された管理者(先生が管理画面から追加・削除。固定のADMIN_EMAILSに加算) ---
  const [firestoreAdminEmails, setFirestoreAdminEmails] = useState<string[]>([]);
  useEffect(() => {
    fetchAdminEmails(db).then(setFirestoreAdminEmails).catch(() => {});
  }, []);

  // --- 特別な背景(バッジ獲得率で解放。wari-hissann3 から移植) ---
  const [equippedBackground, setEquippedBackgroundState] = useState<BackgroundId>(() => getEquippedBackground());
  const handleEquipBackground = useCallback((id: BackgroundId) => {
    setEquippedBackground(id);
    setEquippedBackgroundState(id);
  }, []);
  // バッジが減る運用はないが、獲得率を下回る背景を装備していたら外す(整合性ガード)
  useEffect(() => {
    const ratio = badgeRatio(earnedBadgeIds);
    if (!isBackgroundUnlocked(equippedBackground, ratio)) {
      handleEquipBackground('default');
    }
  }, [earnedBadgeIds, equippedBackground, handleEquipBackground]);

  // --- 本番テスト完了時: バッジ判定 + Firestore 同期 ---
  const handleTestFinished = useCallback((bests: TestBests, detail: { omoteScore: number; uraScore: number; total: number }) => {
    void detail;
    if (bests.bestOmote >= 50) earnBadge('test_omote_50');
    if (bests.bestOmote >= 75) earnBadge('test_omote_75');
    if (bests.bestOmote >= 90) earnBadge('test_omote_90');
    if (bests.bestOmote >= 100) earnBadge('test_omote_100');
    if (bests.bestUra >= 25) earnBadge('test_ura_25');
    if (bests.bestUra >= 40) earnBadge('test_ura_40');
    if (bests.bestUra >= 50) earnBadge('test_ura_50');
    if (bests.bestTotal >= 100) earnBadge('test_total_100');
    if (bests.bestTotal >= 140) earnBadge('test_total_140');
    if (bests.bestTotal >= 150) earnBadge('test_total_150');
    if (bests.perfectCounts.omote >= 3) earnBadge('test_omote_perfect_3');
    if (bests.perfectCounts.ura >= 3) earnBadge('test_ura_perfect_3');
    if (bests.perfectCounts.total >= 3) earnBadge('test_total_perfect_3');
    checkTitleConditions();
    // 自己ベストを Firestore の users ドキュメントへ要約同期(端末をまたぐ閲覧用)
    if (user && db) {
      updateDoc(doc(db, 'users', user.uid), {
        bestTestOmote: bests.bestOmote,
        bestTestUra: bests.bestUra,
        bestTestTotal: bests.bestTotal,
        testPerfectCounts: bests.perfectCounts,
      }).catch(() => {});
    }
  }, [earnBadge, checkTitleConditions, user]);

  // --- バトル中の一時 UI State (ストア外) ---
  const [wrongAnswerText, setWrongAnswerText] = useState<string | null>(null);
  const [playerWrongAnswer, setPlayerWrongAnswer] = useState<string | null>(null);
  const [wrongCategory, setWrongCategory] = useState<string | null>(null);
  // パネル表示
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [showLoginBonus, setShowLoginBonus] = useState(false);
  const [loginBonusClaimed, setLoginBonusClaimed] = useState(false);
  const [showClassBattle, setShowClassBattle] = useState(false);
  const [showWeaknessPanel, setShowWeaknessPanel] = useState(false);
  const [showItemShop, setShowItemShop] = useState(false);

  // Sync refs
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { speedPhaseRef.current = speedPhase; }, [speedPhase]);
  useEffect(() => { battleTypeRef.current = battleType; }, [battleType]);

  // localStorage 永続化は store/progressionStore.ts の subscribe で実施
  // (studentProfile は各セット箇所で直接書き込み)

  // ロックされた単元のカードはデッキ・バトルで使用不可(所持はしたまま非表示)
  const ownedCards = useMemo(
    () => CARD_DEFINITIONS.filter(c => ownedCardIds.has(c.id) && !lockedUnits.has(c.mainCategory)),
    [ownedCardIds, lockedUnits],
  );

  // Splash screen timer (minimum 2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ============================
  // Firebase Auth
  // ============================
  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }

    // Handle redirect result (for mobile/popup-blocked environments)
    getRedirectResult(auth).catch((e) => {
      console.warn('Redirect result check:', e);
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setUid(u ? u.uid : null);
      setAuthLoading(false);
      if (u && db) {
        // Sync user data from Firestore → ストアにハイドレート
        const store = useProgressionStore.getState;
        const ref = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d = snap.data();
            if (d.mathPoints !== undefined) store().setMathPoints(d.mathPoints);
            if (d.playerLevel !== undefined) store().setPlayerLevel(d.playerLevel);
            if (d.playerExp !== undefined) store().setPlayerExp(d.playerExp);
            if (d.ownedCardIds) store().setOwnedCardIds(new Set(d.ownedCardIds));
            // ゲーミフィケーションデータ読み込み
            if (d.earnedBadgeIds) store().setEarnedBadgeIds(new Set(d.earnedBadgeIds));
            if (d.totalCorrectAnswers !== undefined) store().setTotalCorrectAnswers(d.totalCorrectAnswers);
            if (d.totalWins !== undefined) store().setTotalWins(d.totalWins);
            if (d.earnedTitleIds) store().mergeEarnedTitleIds(d.earnedTitleIds);
            // 組・番号情報をFirestoreから復元(自校のみの簡易プロファイル)
            if (d.studentProfile) {
              const sp = d.studentProfile;
              let needsSync = false;
              if (!sp.school || sp.grade !== TARGET_GRADE) {
                sp.school = SCHOOL_NAME;
                sp.grade = TARGET_GRADE;
                sp.displayLabel = `${TARGET_GRADE}年${sp.classNum}組${sp.number}番`;
                needsSync = true;
              }
              if (!sp.schoolYear) {
                sp.schoolYear = DEFAULT_SCHOOL_YEAR;
                needsSync = true;
              }
              if (needsSync) {
                updateDoc(ref, { studentProfile: sp }).catch(() => {});
              }
              setStudentProfile(sp);
              localStorage.setItem('battleMathStudentProfile', JSON.stringify(sp));
            }
            // ログインストリーク計算
            const today = getTodayStr();
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);
            const lastLogin: string = d.lastLoginDate || '';
            let newStreak: number = d.loginStreak || 0;
            if (lastLogin !== today) {
              if (lastLogin === yesterdayStr) {
                // 連続ログイン
                newStreak = newStreak + 1;
              } else if (d.hasStreakShield && lastLogin) {
                // ストリークシールド発動
                // streak維持、シールドを消費
                await updateDoc(ref, { loginStreak: newStreak, lastLoginDate: today, hasStreakShield: false }).catch(() => {});
                store().consumeStreakShield();
                store().setLoginStreak(newStreak);
                setLoginBonusClaimed(false);
                setTimeout(() => setShowLoginBonus(true), 800);
                setTimeout(() => store().checkMonthlyChampion(), 2000);
                // シールド使用通知はloginBonusModal側で表示（shieldUsedフラグ不要）
                return;
              } else {
                newStreak = 1;
              }
              await updateDoc(ref, { loginStreak: newStreak, lastLoginDate: today }).catch(() => {});
              // Show login bonus modal automatically on new day
              setLoginBonusClaimed(false);
              setTimeout(() => setShowLoginBonus(true), 800);
            } else {
              // Already logged in today - check if bonus was claimed
              setLoginBonusClaimed(!!d.loginBonusClaimedDate && d.loginBonusClaimedDate === today);
            }
            store().setLoginStreak(newStreak);
            // 月次チャンピオン称号チェック（ログイン時1回のみ）
            setTimeout(() => store().checkMonthlyChampion(), 2000);
          } else {
            // First login: initialize user doc
            await setDoc(ref, {
              uid: u.uid,
              displayName: u.displayName,
              email: u.email,
              photoURL: u.photoURL,
              mathPoints: store().mathPoints,
              playerLevel: store().playerLevel,
              playerExp: store().playerExp,
              totalWins: 0,
              totalMatches: 0,
              ownedCardIds: Array.from(store().ownedCardIds),
              earnedBadgeIds: [],
              totalCorrectAnswers: 0,
              totalAnswered: 0,
              loginStreak: 1,
              lastLoginDate: getTodayStr(),
              loginBonusClaimedDate: '',
              studentProfile: studentProfile || null,
              createdAt: serverTimestamp(),
            });
            store().setLoginStreak(1);
            setLoginBonusClaimed(false);
            setTimeout(() => setShowLoginBonus(true), 800);
          }
          // クエスト進捗をlocalStorageから復元
          store().hydrateQuests();
        } catch (e) { console.error('User sync error:', e); }
      }
    });
    return () => unsub();
  }, []);

  const saveUserToFirestore = useCallback(async (updates: Record<string, any>) => {
    if (!user || !db) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (e) { console.error('Firestore update error:', e); }
  }, [user]);

  // ============================
  // 正解イベント統合処理 (バッジ・クエスト等はストア側で実施)
  // ここでは正解ヒント表示のみ App 側で扱う
  // ============================
  const onCorrectAnswerEvent = useCallback((isCorrect: boolean, correctAnswer: string) => {
    recordAnswerOutcome(isCorrect);
    if (isCorrect) {
      setWrongAnswerText(null);
    } else {
      // 不正解: 正解ヒント表示
      setWrongAnswerText(correctAnswer);
    }
  }, [recordAnswerOutcome]);

  // ログインストリークバッジ
  useEffect(() => {
    if (loginStreak >= 3) earnBadge('streak_3');
    if (loginStreak >= 7) earnBadge('streak_7');
    if (loginStreak >= 14) earnBadge('streak_14');
    if (loginStreak >= 30) earnBadge('streak_30');
    // ログインストリーク称号チェック
    checkTitleConditions();
  }, [loginStreak, earnBadge, checkTitleConditions, totalCorrectAnswers, totalWins, playerLevel, earnedBadgeIds]);

  // 正解ヒント自動クリア（3秒後）
  useEffect(() => {
    if (!wrongAnswerText) return;
    const t = setTimeout(() => setWrongAnswerText(null), 3000);
    return () => clearTimeout(t);
  }, [wrongAnswerText]);

  // セッションデータ書き込み (flushSessionData) はストア側に移動

  // ============================
  // Auth Handlers
  // ============================
  const handleLogin = async () => {
    if (!auth || !googleProvider) {
      console.error('Firebase auth not initialized. auth:', !!auth, 'provider:', !!googleProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.warn('Popup login failed, trying redirect:', e?.code || e);
      // Fallback to redirect for mobile/popup-blocked environments
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error('Redirect login also failed:', redirectError);
        }
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await leaveRoom(currentRoomId, isHost);
      await flushSessionData();
      await signOut(auth);
      setGameState('login_screen');
      cleanupGameSession();
    } catch (e) { console.error('Logout failed:', e); }
  };

  const handleStudentProfileSet = useCallback(async (profile: StudentProfile) => {
    setStudentProfile(profile);
    localStorage.setItem('battleMathStudentProfile', JSON.stringify(profile));
    if (user && db) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          studentProfile: profile,
        });
      } catch (e) { console.error('Student profile sync error:', e); }
    }
  }, [user]);

  // 新年度チェック（studentProfile が初めてセットされた時に1回のみ）
  useEffect(() => {
    if (!studentProfile || newYearCheckedRef.current) return;
    newYearCheckedRef.current = true;

    const currentSchoolYear = getCurrentSchoolYear();
    if ((studentProfile.schoolYear ?? DEFAULT_SCHOOL_YEAR) < currentSchoolYear) {
      const lastSkipped = parseInt(localStorage.getItem('beng_newYearSkippedAt') || '0', 10);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (!lastSkipped || Date.now() - lastSkipped > threeDaysMs) {
        setShowNewYearPrompt(true);
      }
    }
  }, [studentProfile]);

  // 新年度更新確定ハンドラー
  const handleNewYearConfirm = async (updated: StudentProfile) => {
    setShowNewYearPrompt(false);
    localStorage.removeItem('beng_newYearSkippedAt');
    await handleStudentProfileSet(updated);
  };

  // 新年度スキップハンドラー（3日後に再表示）
  const handleNewYearSkip = () => {
    localStorage.setItem('beng_newYearSkippedAt', String(Date.now()));
    setShowNewYearPrompt(false);
  };

  const handleGuestPlay = () => {
    setGameState(tutorialDone ? 'main_menu' : 'tutorial');
  };

  // ログインボーナス: MP加算・Firestore書き込みはストア、受取済みフラグはApp側UI状態
  const handleClaimLoginBonus = useCallback(() => {
    claimLoginBonus();
    setLoginBonusClaimed(true);
  }, [claimLoginBonus]);

  // 管理画面はADMIN_EMAILS(固定)+管理画面から追加されたメールのGoogleアカウントのみ。
  // 実効的な保護は firestore.rules の isAdmin()（サーバー側）で行われ、ここはUI表示の制御。
  const canAccessGameMaster = !!user?.email
    && (ADMIN_EMAILS.includes(user.email) || firestoreAdminEmails.includes(user.email));
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);

  const handleOpenGameMaster = () => {
    if (canAccessGameMaster) setShowAdminPasswordModal(true);
  };

  // Progression (addExp / addBoostedMp / expForNextLevel) はストア側に移動



  const cleanupGameSession = useCallback((keepConn = false) => {
    if (!keepConn) {
      if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
      setCurrentRoomId(null);
      setIsHost(false);
      setOpponentDisconnected(false);
      clearActivePvpSession();
    }
    processedMatchIdRef.current = null;
    setWinner(null);
    setPlayerPlayedCard(null);
    setPcPlayedCard(null);
    setMismatchRound(false);
    setPlayerRoundWins(0);
    setPcRoundWins(0);
    setCurrentRound(1);
    setTurnPhase('selecting_card');
  }, []);


  const listenToRoom = (roomId: string) => {
    if (!db) return;
    if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
    unsubscribeRoomRef.current = onSnapshot(doc(db, 'rooms', roomId), snap => {
      if (!snap.exists()) {
        // ルームが削除された場合
        setOpponentDisconnected(true);
        return;
      }
      const data = snap.data() as Room;
      const isHostVal = isHostRef.current;

      // 相手の切断検知（lastActiveが60秒以上古い場合）
      // ハートビート30秒に合わせてしきい値を60秒に短縮
      if (data.status === 'playing') {
        const opponentLastActive = isHostVal ? data.guestLastActive : data.hostLastActive;
        if (opponentLastActive) {
          const lastActiveMs = opponentLastActive.toDate ? opponentLastActive.toDate().getTime() : 0;
          const staleThreshold = 60000; // 60秒（ハートビート30秒 × 2回分）
          const autoEndThreshold = 120000; // 120秒で自動終了
          if (lastActiveMs > 0 && Date.now() - lastActiveMs > staleThreshold) {
            setOpponentDisconnected(true);
            // 120秒以上応答がなければ自動的にルームを終了（勝利宣言不要）
            if (Date.now() - lastActiveMs > autoEndThreshold) {
              const roomRef = doc(db!, 'rooms', roomId);
              updateDoc(roomRef, {
                status: 'finished',
                winnerId: isHostVal ? 'host' : 'guest',
              }).catch(() => {});
            }
          } else {
            setOpponentDisconnected(false);
          }
        }
      }

      // ルームが外部要因で finished になった場合（相手離脱・管理者終了等）
      if (data.status === 'finished' && (data.winnerId === 'abandoned' || data.winnerId === 'admin_terminated')) {
        cleanupGameSession();
        setGameState(battleTypeRef.current === 'speed_duel' ? 'speed_duel_setup' : 'deck_building');
        return;
      }

      if (data.status === 'playing' && gameStateRef.current === 'matchmaking') {
        setCurrentRound(1);
        processedMatchIdRef.current = null;

        if (data.battleType === 'speed_duel' && data.speedProblems) {
          // Speed Duel PvP: load problems from room and start
          setBattleType('speed_duel');
          setSpeedProblems(data.speedProblems as SpeedProblem[]);
          setSpeedTotalRounds(data.speedTotalRounds || 5);
          setBattleFormat((data.speedFormat as BattleFormat) || 'best_of_5');
          setSpeedRound(1);
          setSpeedPlayerScore(0);
          setSpeedOpponentScore(0);
          setSpeedPlayerAnswered(false);
          setSpeedOpponentAnswered(false);
          setSpeedRoundWinner(null);
          setSpeedGameResult(null);
          speedRewardGrantedRef.current = false;
          setSpeedPhase('countdown');
          setGameState('speed_duel');
          setTimeout(() => {
            setSpeedPhase('answering');
            setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
          }, 2000);
        } else {
          setTimeout(() => {
            const deckToUse = pvpDeckRef.current.length > 0 ? pvpDeckRef.current : playerDeck;
            startGame(deckToUse, false, data);
            setGameState('in_game');
          }, 500);
        }
      }

      // Speed Duel PvP: sync round results from Firestore
      if (gameStateRef.current === 'speed_duel' && data.battleType === 'speed_duel') {
        const myScore = isHostVal ? (data.speedP1Score || 0) : (data.speedP2Score || 0);
        const oppScore = isHostVal ? (data.speedP2Score || 0) : (data.speedP1Score || 0);
        setSpeedPlayerScore(myScore);
        setSpeedOpponentScore(oppScore);

        const oppAnswer = isHostVal ? data.speedP2Answer : data.speedP1Answer;
        if (oppAnswer) setSpeedOpponentAnswered(true);

        // Round resolved by opponent's correct answer
        if (data.speedRoundWinner && speedPhaseRef.current === 'answering') {
          if (speedTimerRef.current) clearInterval(speedTimerRef.current);
          const winner = data.speedRoundWinner;
          if ((winner === 'host' && isHostVal) || (winner === 'guest' && !isHostVal)) {
            setSpeedRoundWinner('player');
          } else {
            setSpeedRoundWinner('opponent');
          }
          setSpeedPhase('round_result');
        }

        // Match finished
        if (data.winnerId && processedMatchIdRef.current !== roomId) {
          processedMatchIdRef.current = roomId;
          const isWinner = (data.winnerId === 'host' && isHostVal) || (data.winnerId === 'guest' && !isHostVal);
          setSpeedGameResult(data.winnerId === 'draw' ? 'draw' : isWinner ? 'win' : 'lose');
          setSpeedPhase('match_over');
          flushSessionData().catch(() => {});
        }
      }

      if (gameStateRef.current === 'in_game') {
        setPlayerHP(isHostVal ? data.p1Hp : data.p2Hp);
        setPcHP(isHostVal ? data.p2Hp : data.p1Hp);

        if (data.winnerId && processedMatchIdRef.current !== roomId) {
          processedMatchIdRef.current = roomId;
          const isWinner = (data.winnerId === 'host' && isHostVal) || (data.winnerId === 'guest' && !isHostVal);
          const isAbandoned = data.winnerId === 'abandoned' || data.winnerId === 'admin_terminated';
          if (isAbandoned) {
            setWinner('中断されました');
          } else {
            setWinner(data.winnerId === 'draw' ? '引き分け' : isWinner ? '勝利！' : '敗北...');
          }
          if (isWinner && !isAbandoned) {
            addExp(500);
            addBoostedMp(300);
            saveUserToFirestore({ totalWins: increment(1), totalMatches: increment(1) });
            earnBadge('first_pvp_win');
            // PvP10勝バッジチェックはサーバー側totalWinsで判断できないので省略
          } else if (!isAbandoned) {
            addExp(100);
            saveUserToFirestore({ totalMatches: increment(1) });
          }
          if (!isAbandoned) handleQuestProgress('pvp_match');
          flushSessionData().catch(() => {}); // fire-and-forget
          setChainCount(0);
          setGameState('end');
        }
      }
    }, (error) => {
      const msg = error?.message || '';
      if (msg.includes('not found') || msg.includes('404') || error?.code === 'not-found') {
        console.error('[BattleMath] Firestoreデータベースが未作成です');
      } else {
        console.error('[BattleMath] Room listener error:', msg);
      }
    });
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user || !db) {
      alert('PvP対戦にはログインが必要です');
      return;
    }
    cleanupGameSession(false);
    const uid = user.uid.trim();

    try {
      // ゾンビ部屋防止: 自分がホストの未終了ルームを自動クリーンアップ
      const myHostRoomsSnap = await getDocs(
        query(
          collection(db, 'rooms'),
          where('hostId', '==', uid),
          where('status', 'in', ['waiting', 'playing']),
        )
      );
      const cleanupPromises: Promise<void>[] = [];
      myHostRoomsSnap.forEach(d => {
        if (d.id !== roomId) {
          cleanupPromises.push(
            updateDoc(doc(db, 'rooms', d.id), {
              status: 'finished',
              winnerId: 'abandoned',
            }).catch(() => {})
          );
        }
      });
      // 自分がゲストの未終了ルームも同様にクリーンアップ
      const myGuestRoomsSnap = await getDocs(
        query(
          collection(db, 'rooms'),
          where('guestId', '==', uid),
          where('status', 'in', ['waiting', 'playing']),
        )
      );
      myGuestRoomsSnap.forEach(d => {
        if (d.id !== roomId) {
          cleanupPromises.push(
            updateDoc(doc(db, 'rooms', d.id), {
              status: 'finished',
              winnerId: 'abandoned',
            }).catch(() => {})
          );
        }
      });
      if (cleanupPromises.length > 0) {
        await Promise.all(cleanupPromises);
        console.log(`Cleaned up ${cleanupPromises.length} zombie room(s) for user ${uid}`);
      }
    } catch (cleanupErr) {
      console.warn('Zombie room cleanup failed (non-blocking):', cleanupErr);
    }

    try {
      const roomRef = doc(db, 'rooms', roomId);
      const result = await runTransaction(db, async (tx) => {
        const roomDoc = await tx.get(roomRef);
        const base: Record<string, any> = {
          roomId, status: 'waiting', hostId: uid,
          hostName: user.displayName || 'Player',
          guestId: null, guestName: null,
          createdAt: serverTimestamp(), hostLastActive: serverTimestamp(),
          guestLastActive: null, hostReady: true, guestReady: false,
          round: 1, p1Move: null, p2Move: null,
          p1Hp: INITIAL_HP, p2Hp: INITIAL_HP, winnerId: null,
          battleType: battleType || 'card_battle',
        };
        // Speed duel: add categories and problems to room
        if (battleType === 'speed_duel') {
          const total = getSpeedTotalRounds(battleFormat);
          const problems = generateSpeedProblems(speedCategories, total);
          base.speedCategories = speedCategories;
          base.speedFormat = battleFormat;
          base.speedRound = 1;
          base.speedTotalRounds = total;
          base.speedP1Score = 0;
          base.speedP2Score = 0;
          // category/difficulty も保存（undefined不可のためnullに変換）— 相手側の学習記録・DDAに使う
          base.speedProblems = problems.map(p => ({ type: p.type, data: p.data, answer: p.answer, category: p.category ?? null, difficulty: p.difficulty ?? null }));
          base.speedP1Answer = null;
          base.speedP2Answer = null;
          base.speedRoundWinner = null;
          base.speedRoundActive = false;
        }
        if (!roomDoc.exists() || (roomDoc.data() as Room).status === 'finished') {
          tx.set(roomRef, base);
          return 'host';
        }
        const d = roomDoc.data() as Room;
        if ((d.hostId || '').trim() === uid) return 'host';
        if ((d.guestId || '').trim() === uid) return 'guest';
        if (d.status === 'waiting') {
          tx.update(roomRef, {
            status: 'playing', guestId: uid,
            guestName: user.displayName || 'Player',
            guestReady: true, guestLastActive: serverTimestamp()
          });
          return 'guest';
        }
        throw new Error('ROOM_FULL');
      });
      setIsHost(result === 'host');
      setCurrentRoomId(roomId);
      // 再接続用に対戦情報を保存（誤リロード対策）
      saveActivePvpSession({
        roomId,
        isHost: result === 'host',
        battleType: battleType || 'card_battle',
        deckIds: pvpDeckRef.current.map(c => c.id),
        savedAt: Date.now(),
      });
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg === 'ROOM_FULL') {
        alert('この部屋は満員です。');
      } else if (msg.includes('not found') || msg.includes('404') || e?.code === 'not-found') {
        alert('Firestoreデータベースが未作成です。\nFirebase Console → Firestore Database → 「データベースを作成」を実行してください。');
      } else if (msg.includes('offline') || msg.includes('unavailable')) {
        alert('サーバーに接続できません。インターネット接続を確認してください。');
      } else {
        console.error('Room join error:', e);
        alert(`入室エラー: ${msg || '不明なエラーが発生しました'}`);
      }
    }
  };

  useEffect(() => { if (currentRoomId) listenToRoom(currentRoomId); }, [currentRoomId]);



  // ============================
  // Game Start
  // ============================
  // ZPD重み付きデッキ構築（エビデンスA: Vygotsky 1978）
  const buildAdaptiveCpuDeck = useCallback((): ProblemCard[] => {
    const weights = getCategoryWeights();
    const cards = CARD_DEFINITIONS.filter(c => !lockedUnits.has(c.mainCategory));
    // 各カードに重みを割り当て（未記録カテゴリはデフォルト2）
    const weighted = cards.map(c => ({ card: c, weight: weights[c.category] || 2 }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

    // 重み付きサンプリング（復元なし）
    const selected: ProblemCard[] = [];
    const pool = [...weighted];
    while (selected.length < DECK_SIZE && pool.length > 0) {
      let roll = Math.random() * pool.reduce((s, w) => s + w.weight, 0);
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        roll -= pool[idx].weight;
        if (roll <= 0) break;
      }
      selected.push(pool[idx].card);
      pool.splice(idx, 1);
    }
    return selected;
  }, []);

  const startGame = useCallback((playerDeckSetup: ProblemCard[], isCpu: boolean, roomData?: Room, format?: BattleFormat) => {
    cleanupGameSession(true);
    const pcDeckSetup = isCpu ? buildAdaptiveCpuDeck() : shuffleDeck(CARD_DEFINITIONS.filter(c => !lockedUnits.has(c.mainCategory))).slice(0, DECK_SIZE);
    const shuffledP = shuffleDeck(playerDeckSetup);
    const shuffledC = shuffleDeck(pcDeckSetup);
    setPlayerHand(shuffledP.slice(0, HAND_SIZE));
    setPlayerDeck(shuffledP.slice(HAND_SIZE));
    setPcHand(shuffledC.slice(0, HAND_SIZE));
    setPcDeck(shuffledC.slice(HAND_SIZE));
    if (roomData) {
      setPlayerHP(isHostRef.current ? roomData.p1Hp : roomData.p2Hp);
      setPcHP(isHostRef.current ? roomData.p2Hp : roomData.p1Hp);
    } else {
      setPlayerHP(INITIAL_HP);
      setPcHP(INITIAL_HP);
    }
    setPlayerScore(0);
    setPcScore(0);
    setWinner(null);
    setRoundResult(null);
    setPlayerAnswered(false);
    setPcAnswered(false);
    setInitiative(Math.random() > 0.5 ? 'player' : 'pc');
    setTurnPhase('selecting_card');
    if (format) setBattleFormat(format);
    setPlayerRoundWins(0);
    setPcRoundWins(0);
    setCurrentRound(1);
    const formatLabel = format === 'best_of_3' ? '【3本勝負】' : format === 'best_of_5' ? '【5本勝負】' : format === 'best_of_7' ? '【7本勝負】' : '【マスターデュエル】';
    setGameLog([`${formatLabel} バトル開始！問題に答えてダメージを与えよう！`]);
  }, [cleanupGameSession, buildAdaptiveCpuDeck]);

  // ============================
  // Speed Duel Logic
  // ============================
  const generateSpeedProblems = useCallback((subtopics: string[], count: number): SpeedProblem[] => {
    // Support both subtopic names (granular) and main category names (legacy)
    const subtopicSet = new Set(subtopics);
    const eligible = CARD_DEFINITIONS.filter(c => (subtopicSet.has(c.category) || subtopicSet.has(c.mainCategory)) && !lockedUnits.has(c.mainCategory));
    const shuffled = shuffleDeck(eligible);
    // 単元・難易度を保持（弱点分析/SRS記録・CPUのDDAに使用）
    return shuffled.slice(0, Math.min(count, shuffled.length))
      .map(c => ({ ...c.problem, category: c.category, difficulty: c.difficulty }));
  }, []);

  const getSpeedTotalRounds = useCallback((format: BattleFormat): number => {
    if (format === 'best_of_3') return 3;
    if (format === 'best_of_5') return 5;
    if (format === 'best_of_7') return 7;
    return 10; // master_duel
  }, []);

  const getSpeedRequiredWins = useCallback((format: BattleFormat): number => {
    if (format === 'best_of_3') return 2;
    if (format === 'best_of_5') return 3;
    if (format === 'best_of_7') return 4;
    return 0; // master_duel: most wins after all rounds
  }, []);

  const startSpeedDuel = useCallback((categories: string[], format: BattleFormat, mode: 'cpu' | 'pvp') => {
    setBattleType('speed_duel');
    setSpeedCategories(categories);
    setBattleFormat(format);
    const bmode = mode === 'pvp' ? 'pvp' : 'cpu';
    setGameMode(bmode as any);

    if (bmode === 'pvp') {
      setGameState('matchmaking');
      return;
    }

    // CPU mode: generate problems and start
    const total = getSpeedTotalRounds(format);
    const problems = generateSpeedProblems(categories, total);
    setSpeedProblems(problems);
    setSpeedTotalRounds(total);
    setSpeedRound(1);
    setSpeedPlayerScore(0);
    setSpeedOpponentScore(0);
    setSpeedPlayerAnswered(false);
    setSpeedOpponentAnswered(false);
    setSpeedRoundWinner(null);
    setSpeedGameResult(null);
    speedRewardGrantedRef.current = false;
    setSpeedPhase('countdown');
    setGameState('speed_duel');

    // Countdown then start
    setTimeout(() => {
      setSpeedPhase('answering');
      setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
    }, 1500);
  }, [generateSpeedProblems, getSpeedTotalRounds]);

  // Speed Duel timer
  useEffect(() => {
    if (gameState !== 'speed_duel' || speedPhase !== 'answering') return;
    speedTimerRef.current = setInterval(() => {
      setSpeedTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - resolve round
          clearInterval(speedTimerRef.current!);
          if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current);
          setSpeedPhase('round_result');
          if (!speedPlayerAnswered && !speedOpponentAnswered) {
            setSpeedRoundWinner('draw');
          } else if (speedPlayerAnswered && !speedOpponentAnswered) {
            // Player already answered (might be correct or wrong, handled in answer handler)
          } else if (!speedPlayerAnswered && speedOpponentAnswered) {
            // CPU already answered correctly
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (speedTimerRef.current) clearInterval(speedTimerRef.current); };
  }, [gameState, speedPhase, speedRound]);

  // Speed Duel CPU answer — DDA (動的難易度調整)
  // プレイヤー自身の難易度別平均解答時間を基準にCPUの速度・正答率を決める
  // (詳細は constants/gameBalance.ts を参照)
  useEffect(() => {
    if (gameState !== 'speed_duel' || speedPhase !== 'answering' || gameMode !== 'cpu') return;
    const problem = speedProblems[speedRound - 1];
    if (!problem) return;
    const difficulty = problem.difficulty || 3;
    const stats = userLevelStats[difficulty];
    const baseTime = stats && stats.count >= SPEED_CPU.MIN_SAMPLE_COUNT
      ? stats.avgTime
      : difficulty * SPEED_CPU.FALLBACK_MS_PER_DIFFICULTY;
    const jitter = SPEED_CPU.DELAY_JITTER_MIN
      + Math.random() * (SPEED_CPU.DELAY_JITTER_MAX - SPEED_CPU.DELAY_JITTER_MIN);
    const baseDelay = Math.max(SPEED_CPU.MIN_DELAY_MS, Math.min(SPEED_CPU.MAX_DELAY_MS, baseTime * jitter));
    speedCpuTimerRef.current = setTimeout(() => {
      // クロージャのspeedPhaseは古い値のため、refで現在のフェーズを判定する
      if (speedPhaseRef.current !== 'answering') return;
      setSpeedOpponentAnswered(true);
      const cpuCorrect = Math.random() < speedCpuAccuracy(difficulty);
      if (cpuCorrect && !speedPlayerAnswered) {
        // CPU wins this round
        if (speedTimerRef.current) clearInterval(speedTimerRef.current);
        setSpeedRoundWinner('opponent');
        setSpeedOpponentScore(prev => prev + 1);
        setSpeedPhase('round_result');
      }
    }, baseDelay);
    return () => { if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current); };
  }, [gameState, speedPhase, speedRound, gameMode, speedProblems, userLevelStats]);

  const handleSpeedAnswer = useCallback(async (answer: string) => {
    if (speedPhase !== 'answering' || speedPlayerAnswered) return;
    const problem = speedProblems[speedRound - 1];
    if (!problem) return;

    setSpeedPlayerAnswered(true);

    // Check correctness (カードバトルと同一の採点ロジック)
    const isCorrect = checkAnswer(answer, problem.answer, { multiple: !!(problem.data as any)?.multiple, requireForm: (problem.data as any)?.requireForm });

    // ゲーミフィケーション統合: チェイン・バッジ・クエスト・セッション統計
    recordAnswerOutcome(isCorrect);
    // 学習記録: 弱点分析と間隔反復(SRS)はカードバトル・練習モードと同様に蓄積する
    // （旧形式PvPルームの問題には category が無いためガード）
    if (problem.category) {
      recordAttempt(problem.category, isCorrect);
      if (!isCorrect) {
        addIncorrectToSrs(
          problem.category,
          String((problem.data as any)?.question || '').slice(0, 50),
          problem.answer,
          problem.type
        );
      }
    }
    // がくしゅうのきろく: 1問ログ(きょうやった問題の即時確認用)
    recordProblemLog({
      mode: 'speed',
      subTopic: problem.category || 'スピード対戦',
      question: String((problem.data as any)?.question || ''),
      userAnswer: answer,
      correct: isCorrect,
    });

    if (gameMode === 'pvp' && currentRoomId && db) {
      // PvP: write answer to Firestore, use transaction for atomicity
      const answerField = isHostRef.current ? 'speedP1Answer' : 'speedP2Answer';
      const myRole = isHostRef.current ? 'host' : 'guest';
      try {
        await runTransaction(db, async (tx) => {
          const roomSnap = await tx.get(doc(db, 'rooms', currentRoomId));
          if (!roomSnap.exists()) return;
          const roomData = roomSnap.data() as Room;
          // Already resolved?
          if (roomData.speedRoundWinner) return;
          const update: Record<string, any> = {
            [answerField]: { answer, correct: isCorrect, answeredAt: Date.now() },
          };
          if (isCorrect && !roomData.speedRoundWinner) {
            update.speedRoundWinner = myRole;
            const scoreField = isHostRef.current ? 'speedP1Score' : 'speedP2Score';
            update[scoreField] = (isHostRef.current ? (roomData.speedP1Score || 0) : (roomData.speedP2Score || 0)) + 1;
          }
          tx.update(doc(db, 'rooms', currentRoomId), update);
        });
      } catch (e) {
        console.error('Speed duel PvP answer error:', e);
      }
      // State will be updated by the room listener
      return;
    }

    // CPU mode: resolve locally
    if (isCorrect) {
      if (speedTimerRef.current) clearInterval(speedTimerRef.current);
      if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current);
      setSpeedRoundWinner('player');
      setSpeedPlayerScore(prev => prev + 1);
      setSpeedPhase('round_result');
    }
    // If wrong, player can't retry - wait for CPU or timeout
  }, [speedPhase, speedPlayerAnswered, speedProblems, speedRound, recordAnswerOutcome, gameMode, currentRoomId, db]);

  const handleSpeedNextRound = useCallback(() => {
    const required = getSpeedRequiredWins(battleFormat);

    // PvP: ルームを終了状態にする（両クライアントが同じ値を書くため冪等）
    const finishPvpMatch = (result: 'win' | 'lose' | 'draw') => {
      if (gameMode !== 'pvp' || !currentRoomId || !db) return;
      const myRole = isHostRef.current ? 'host' : 'guest';
      const oppRole = isHostRef.current ? 'guest' : 'host';
      const winnerId = result === 'draw' ? 'draw' : result === 'win' ? myRole : oppRole;
      updateDoc(doc(db, 'rooms', currentRoomId), { status: 'finished', winnerId }).catch(() => {});
      clearActivePvpSession();
    };

    // Check if match is over (スコアは回答時点で加算済み)
    if (required > 0) {
      // best-of-N: check if either player reached required wins
      if (speedPlayerScore >= required || speedOpponentScore >= required) {
        const result = speedPlayerScore >= required ? 'win' : 'lose';
        setSpeedGameResult(result);
        setSpeedPhase('match_over');
        finishPvpMatch(result);
        return;
      }
    }

    // Check if all rounds played (master_duel or remaining rounds exhausted)
    if (speedRound >= speedTotalRounds) {
      const result = speedPlayerScore > speedOpponentScore ? 'win'
        : speedPlayerScore < speedOpponentScore ? 'lose' : 'draw';
      setSpeedGameResult(result);
      setSpeedPhase('match_over');
      finishPvpMatch(result);
      return;
    }

    // PvP: 前ラウンドの解答・勝者をクリアして次ラウンドへ進める。
    // 重要: これを行わないと speedRoundWinner がルームに残り続け、
    // 2ラウンド目以降の解答トランザクションが常に早期returnして
    // 誰も得点できなくなる（旧実装のバグ）。speedRound の保存は再接続にも使う
    if (gameMode === 'pvp' && currentRoomId && db) {
      updateDoc(doc(db, 'rooms', currentRoomId), {
        speedRound: speedRound + 1,
        speedRoundWinner: null,
        speedP1Answer: null,
        speedP2Answer: null,
      }).catch(() => {});
    }

    // Next round
    setSpeedRound(prev => prev + 1);
    setSpeedPlayerAnswered(false);
    setSpeedOpponentAnswered(false);
    setSpeedRoundWinner(null);
    setSpeedPhase('countdown');
    setTimeout(() => {
      setSpeedPhase('answering');
      setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
    }, SPEED_DUEL_COUNTDOWN_MS);
  }, [battleFormat, speedPlayerScore, speedOpponentScore, speedRound, speedTotalRounds, getSpeedRequiredWins, gameMode, currentRoomId]);

  // ============================
  // スピード対戦の対戦報酬（マッチ終了時に1回だけ付与）
  // 旧実装ではスピード対戦に報酬がなく、報酬ループから漏れていた
  // ============================
  const speedRewardGrantedRef = useRef(false);
  useEffect(() => {
    if (speedPhase !== 'match_over' || !speedGameResult) return;
    if (speedRewardGrantedRef.current) return;
    speedRewardGrantedRef.current = true;
    const reward = SPEED_DUEL_REWARDS[speedGameResult];
    addExp(reward.exp);
    // CPU戦は1日の獲得上限あり(荒稼ぎ防止)。PvPは対人戦のため上限なし。
    if (reward.mp > 0) { if (gameMode === 'cpu') addCpuBattleMp(reward.mp); else addBoostedMp(reward.mp); }
    if (speedGameResult === 'win') {
      incrementTotalWins();
      saveUserToFirestore({ totalWins: increment(1), totalMatches: increment(1) });
    } else {
      saveUserToFirestore({ totalMatches: increment(1) });
    }
    if (gameMode === 'pvp') handleQuestProgress('pvp_match');
    flushSessionData().catch(() => {});
  }, [speedPhase, speedGameResult, gameMode, addExp, addBoostedMp, incrementTotalWins, saveUserToFirestore, handleQuestProgress, flushSessionData]);

  // ============================
  // Auto-draw helper
  // ============================
  const handleAutoDraw = useCallback((
    hand: ProblemCard[], deck: ProblemCard[], targetLevel: number
  ) => {
    const idx = deck.findIndex(c => c.difficulty === targetLevel);
    if (idx !== -1) {
      const newCard = deck[idx];
      const newDeck = [...deck];
      newDeck.splice(idx, 1);
      const oldCard = hand[Math.floor(Math.random() * hand.length)];
      const newHand = [...hand.filter(c => c.id !== oldCard.id), newCard];
      newDeck.push(oldCard);
      return { newHand, newDeck, success: true };
    }
    return { newHand: hand, newDeck: deck, success: false };
  }, []);

  // ============================
  // HP Battle Resolution
  // エビデンスB: ATK/DEF + 正解ダメージ統合設計
  // ============================
  const resolveHpBattle = useCallback((
    playerCorrect: boolean,
    playerCard: ProblemCard,
    pcCard: ProblemCard
  ) => {
    // Damage formula: difficulty × 2 HP
    // SCORE_BOOST: +2 bonus damage on correct answer
    // DEFENSIVE_STANCE: block damage when wrong
    if (playerCorrect) {
      let dmg = calcDamage(playerCard.difficulty);
      if (playerCard.ability?.type === 'SCORE_BOOST') dmg += (playerCard.ability.value || 1) * 2;
      addLog(`正解！${(pcCard.problem.data as Record<string, unknown>).question ? String((pcCard.problem.data as Record<string, unknown>).question).slice(0, 20) : ''}... → ${dmg}ダメージ！`);
      setPcHP(prev => Math.max(0, prev - dmg));
      setPlayerScore(s => s + 1);
      return 'player_win';
    } else {
      if (playerCard.ability?.type === 'DEFENSIVE_STANCE') {
        addLog(`不正解 [防御スタンス] ダメージをガード！`);
        return 'defended';
      }
      const dmg = calcDamage(pcCard.difficulty);
      addLog(`不正解… ${dmg}ダメージを受けた`);
      setPlayerHP(prev => Math.max(0, prev - dmg));
      setPcScore(s => s + 1);
      return 'pc_win';
    }
  }, []);

  const addLog = useCallback((msg: string) => {
    setGameLog(prev => [...prev.slice(-10), msg]);
  }, []);

  // ============================
  // PvP再接続
  // 誤リロード後、保存済みセッションのルームがまだ進行中なら復帰を提案する
  // ============================
  const [resumeCandidate, setResumeCandidate] = useState<SavedPvpSession | null>(null);
  const resumeCheckedRef = useRef(false);

  useEffect(() => {
    if (!user || !db || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    const saved = loadActivePvpSession();
    if (!saved) return;
    if (Date.now() - saved.savedAt > PVP_RESUME_MAX_AGE_MS) {
      clearActivePvpSession();
      return;
    }
    getDoc(doc(db, 'rooms', saved.roomId)).then(snap => {
      if (!snap.exists()) { clearActivePvpSession(); return; }
      const room = snap.data() as Room;
      const isParticipant = room.hostId === user.uid || room.guestId === user.uid;
      if (room.status !== 'playing' || !isParticipant) { clearActivePvpSession(); return; }
      setResumeCandidate(saved);
    }).catch(() => {});
  }, [user]);

  const performResume = useCallback(async (saved: SavedPvpSession) => {
    setResumeCandidate(null);
    if (!db) return;
    try {
      const snap = await getDoc(doc(db, 'rooms', saved.roomId));
      if (!snap.exists()) { clearActivePvpSession(); return; }
      const room = snap.data() as Room;
      if (room.status !== 'playing') { clearActivePvpSession(); return; }

      // isHostRef は startGame/リスナーが即座に参照するため、stateより先にrefを更新する
      isHostRef.current = saved.isHost;
      setIsHost(saved.isHost);
      setGameMode('pvp');
      processedMatchIdRef.current = null;

      if (room.battleType === 'speed_duel' && room.speedProblems) {
        setBattleType('speed_duel');
        setSpeedProblems(room.speedProblems as SpeedProblem[]);
        setSpeedTotalRounds(room.speedTotalRounds || 5);
        setBattleFormat((room.speedFormat as BattleFormat) || 'best_of_5');
        setSpeedRound(room.speedRound || 1);
        setSpeedPlayerScore(saved.isHost ? (room.speedP1Score || 0) : (room.speedP2Score || 0));
        setSpeedOpponentScore(saved.isHost ? (room.speedP2Score || 0) : (room.speedP1Score || 0));
        setSpeedPlayerAnswered(!!(saved.isHost ? room.speedP1Answer : room.speedP2Answer));
        setSpeedOpponentAnswered(!!(saved.isHost ? room.speedP2Answer : room.speedP1Answer));
        setSpeedGameResult(null);
        speedRewardGrantedRef.current = false;
        if (room.speedRoundWinner) {
          const mine = room.speedRoundWinner !== 'draw'
            && ((room.speedRoundWinner === 'host') === saved.isHost);
          setSpeedRoundWinner(room.speedRoundWinner === 'draw' ? 'draw' : mine ? 'player' : 'opponent');
          setSpeedPhase('round_result');
        } else {
          setSpeedRoundWinner(null);
          setSpeedPhase('answering');
          setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
        }
        setCurrentRoomId(saved.roomId);
        setGameState('speed_duel');
      } else {
        // カードバトル: HPはルームから復元、手札は引き直し
        setBattleType('card_battle');
        const deck = saved.deckIds
          .map(id => CARD_DEFINITIONS.find(c => c.id === id))
          .filter((c): c is ProblemCard => !!c);
        const deckToUse = deck.length >= HAND_SIZE ? deck : shuffleDeck(CARD_DEFINITIONS.filter(c => !lockedUnits.has(c.mainCategory))).slice(0, DECK_SIZE);
        pvpDeckRef.current = deckToUse;
        startGame(deckToUse, false, room);
        setCurrentRoomId(saved.roomId);
        setGameState('in_game');
        addLog('🔌 対戦に再接続しました（手札は引き直しです）');
      }
    } catch (e) {
      console.error('PvP resume error:', e);
      clearActivePvpSession();
    }
  }, [startGame, addLog]);

  const dismissResume = useCallback(async (saved: SavedPvpSession) => {
    setResumeCandidate(null);
    // 破棄 = 投了扱い（相手の勝利でルームを終了）
    await leaveRoom(saved.roomId, saved.isHost);
  }, [leaveRoom]);

  // ============================
  // Player Answer Handler
  // ============================
  const handlePlayerAnswer = (answer: string) => {
    if (playerAnswered || pcAnswered || !pcPlayedCard || !playerPlayedCard) return;
    setPlayerAnswered(true);
    const solveTime = Date.now() - roundStartTime;
    // Proof problems are auto-correct (same as practice mode)
    // Multiple-choice: compare as sorted sets so answer order doesn't matter
    const problemData = pcPlayedCard.problem.data as any;
    const correct = pcPlayedCard.problem.type === 'proof'
      ? true
      : checkAnswer(answer, pcPlayedCard.problem.answer, { multiple: !!problemData?.multiple, requireForm: (problemData as any)?.requireForm });

    if (correct) {
      // Update DDA stats
      recordSolveTime(pcPlayedCard.difficulty, solveTime);
      // スピードバッジ: 3秒以内正解
      if (solveTime < 3000) earnBadge('speed_demon');
    }

    // ゲーミフィケーション: チェイン・バッジ・クエスト更新
    onCorrectAnswerEvent(correct, pcPlayedCard.problem.answer);

    // メタ認知: カテゴリ別正答率を記録（エビデンスA: Wang et al. 1993, ES=0.69）
    recordAttempt(pcPlayedCard.category, correct);

    // がくしゅうのきろく: 1問ログ(きょうやった問題の即時確認用)
    recordProblemLog({
      mode: 'battle',
      subTopic: pcPlayedCard.category,
      question: String((pcPlayedCard.problem.data as any)?.question || ''),
      userAnswer: answer,
      correct,
      timeSec: Math.round(solveTime / 100) / 10,
    });

    // 精緻化フィードバック: 不正解時にプレイヤーの回答とカテゴリを記録
    if (!correct) {
      setPlayerWrongAnswer(answer);
      setWrongCategory(pcPlayedCard.category);
      // SRS: 不正解を間隔反復キューに追加（エビデンスA: Cepeda 2006, d=0.42）
      const qData = pcPlayedCard.problem.data as Record<string, unknown>;
      addIncorrectToSrs(
        pcPlayedCard.category,
        String(qData.question || '').slice(0, 50),
        pcPlayedCard.problem.answer,
        pcPlayedCard.problem.type
      );
    } else {
      setPlayerWrongAnswer(null);
      setWrongCategory(null);
    }

    const outcome = resolveHpBattle(correct, playerPlayedCard, pcPlayedCard);
    setRoundResult(outcome === 'player_win' ? 'ラウンド勝利！' : 'ラウンド敗北...');
    if (!pcAnswered) setPcAnswered(true);
    setTurnPhase('round_end');
  };

  // ============================
  // Card Selection
  // ============================
  // 手札+デッキに同レベルカードがあるか判定
  const hasMatchingCard = useCallback((targetDiff: number): boolean => {
    return playerHand.some(c => c.difficulty === targetDiff) ||
           playerDeck.some(c => c.difficulty === targetDiff);
  }, [playerHand, playerDeck]);

  const handleCardClickInHand = (card: ProblemCard) => {
    if (turnPhase !== 'selecting_card') return;

    // PC先攻時: 同レベルマッチング制約
    if (initiative === 'pc' && pcPlayedCard !== null) {
      const canMatch = hasMatchingCard(pcPlayedCard.difficulty);
      if (canMatch && card.difficulty !== pcPlayedCard.difficulty) {
        // 同レベルカードが存在するなら、それを選ぶよう促す
        addLog('同じ難易度のカードを選んでください');
        return;
      }
      // 同レベルカードが無い場合 → 任意カードで応戦OK（mismatch round）
    }

    if (selectedCardId === card.id) {
      // 難易度不一致ラウンド判定
      const isMismatch = initiative === 'pc' && pcPlayedCard !== null &&
                          card.difficulty !== pcPlayedCard.difficulty;
      setMismatchRound(isMismatch);
      if (isMismatch) {
        addLog(`⚡ レベル不一致で応戦！ 解答時間ボーナス獲得（+50%）`);
      }

      setPlayerPlayedCard(card);
      setPlayerHand(prev => prev.filter(c => c.id !== card.id));
      if (initiative === 'player') {
        let pcMatchingCard = pcHand.find(c => c.difficulty === card.difficulty);
        if (!pcMatchingCard) {
          const res = handleAutoDraw(pcHand, pcDeck, card.difficulty);
          if (res.success) {
            addLog('PC: カードを引き直しています...');
            setPcHand(res.newHand);
            setPcDeck(res.newDeck);
            pcMatchingCard = res.newHand.find(c => c.difficulty === card.difficulty);
          }
        }
        const pcCard = pcMatchingCard || pcHand[Math.floor(Math.random() * pcHand.length)];
        setPcPlayedCard(pcCard);
        setPcHand(prev => prev.filter(c => c.id !== pcCard.id));
        setTurnPhase('solving_problem');
        setRoundStartTime(Date.now());
      } else {
        setTurnPhase('solving_problem');
        setRoundStartTime(Date.now());
      }
    } else {
      setSelectedCardId(card.id);
    }
  };

  // ============================
  // PC Initiative
  // ============================
  useEffect(() => {
    if (gameState !== 'in_game' || turnPhase !== 'selecting_card' || initiative !== 'pc' || pcPlayedCard !== null) return;
    const timer = setTimeout(() => {
      const pcCard = pcHand[Math.floor(Math.random() * pcHand.length)];
      if (!pcCard) return;
      setPcPlayedCard(pcCard);
      setPcHand(prev => prev.filter(c => c.id !== pcCard.id));
      addLog(`PC: レベル${pcCard.difficulty} の問題を出題`);
      const hasMatch = playerHand.some(c => c.difficulty === pcCard.difficulty);
      if (!hasMatch) {
        // まずデッキから同レベルカードを自動補充
        const res = handleAutoDraw(playerHand, playerDeck, pcCard.difficulty);
        if (res.success) {
          addLog('カードを自動補充しました');
          setPlayerHand(res.newHand);
          setPlayerDeck(res.newDeck);
        } else {
          // 手札にもデッキにも同レベルがない → 任意カードで応戦可能
          addLog('⚠ 同レベルカードがありません — 手持ちのカードで応戦しましょう！');
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [gameState, turnPhase, initiative, pcPlayedCard, pcHand, playerHand, playerDeck, handleAutoDraw, addLog]);

  // ============================
  // PC Solve Timer (DDA)
  // エビデンスB: Dynamic Difficulty Adjustment
  // ============================
  useEffect(() => {
    if (turnPhase !== 'solving_problem' || pcAnswered || !pcPlayedCard) return;
    const diff = pcPlayedCard.difficulty;
    const stats = userLevelStats[diff] || { avgTime: diff * 12000, count: 0 };
    const baseTime = stats.count > 2 ? stats.avgTime : diff * 12000;
    let finalTime = baseTime * 1.25;
    // レベル不一致ラウンド: 解答時間+50%ボーナス
    if (mismatchRound) finalTime *= 1.5;
    if (pcPlayedCard.ability?.type === 'TIME_PRESSURE') finalTime -= (pcPlayedCard.ability.value || 3) * 1000;
    const solveTime = Math.max(3000, Math.min(120000, finalTime));

    const timer = setTimeout(() => {
      if (!playerAnswered) {
        if (playerPlayedCard?.ability?.type !== 'DEFENSIVE_STANCE') {
          const dmg = calcDamage(pcPlayedCard.difficulty);
          setPlayerHP(prev => Math.max(0, prev - dmg));
          addLog(`時間切れ！${dmg}ダメージを受けた`);
          setPcScore(s => s + 1);
        }
        setRoundResult('ラウンド敗北...');
        setTurnPhase('round_end');
      }
      setPcAnswered(true);
    }, solveTime);
    return () => clearTimeout(timer);
  }, [turnPhase, pcAnswered, playerAnswered, pcPlayedCard, playerPlayedCard, userLevelStats, mismatchRound]);

  // ============================
  // Round End / Win Check (supports both HP and round-based formats)
  // ============================
  const getRequiredWins = useCallback((format: BattleFormat): number => {
    if (format === 'best_of_3') return 2;
    if (format === 'best_of_5') return 3;
    if (format === 'best_of_7') return 4;
    return 0; // master_duel uses HP
  }, []);

  useEffect(() => {
    if (turnPhase !== 'round_end') return;
    const timer = setTimeout(async () => {
      const isPlayerWonRound = roundResult?.includes('勝利');
      const isPlayerLostRound = roundResult?.includes('敗北');

      // Track round wins for best-of-N formats
      let newPlayerRoundWins = playerRoundWins;
      let newPcRoundWins = pcRoundWins;
      if (battleFormat !== 'master_duel') {
        if (isPlayerWonRound) {
          newPlayerRoundWins = playerRoundWins + 1;
          setPlayerRoundWins(newPlayerRoundWins);
        } else if (isPlayerLostRound) {
          newPcRoundWins = pcRoundWins + 1;
          setPcRoundWins(newPcRoundWins);
        }
      }

      // Determine if game is over
      let gameOver = false;
      let isWin = false;
      let isDraw = false;

      if (battleFormat === 'master_duel') {
        // HP-based win condition
        if (playerHP <= 0 || pcHP <= 0) {
          gameOver = true;
          isWin = pcHP <= 0 && playerHP > 0;
          isDraw = pcHP <= 0 && playerHP <= 0;
        }
      } else {
        // Round-based win condition
        const required = getRequiredWins(battleFormat);
        if (newPlayerRoundWins >= required || newPcRoundWins >= required) {
          gameOver = true;
          isWin = newPlayerRoundWins >= required;
          isDraw = false;
        }
        // Also end if HP reaches 0 (knockout in round format)
        if (!gameOver && (playerHP <= 0 || pcHP <= 0)) {
          gameOver = true;
          isWin = pcHP <= 0 && playerHP > 0;
          isDraw = pcHP <= 0 && playerHP <= 0;
        }
      }

      if (gameOver) {
        // Immediately exit 'round_end' phase to prevent this effect from re-firing
        // when state updates (addExp, setPlayerRoundWins, etc.) trigger a re-render
        setTurnPhase('selecting_card');
        const formatLabel = battleFormat === 'best_of_3' ? '3本勝負' : battleFormat === 'best_of_5' ? '5本勝負' : battleFormat === 'best_of_7' ? '7本勝負' : 'マスターデュエル';
        const formatWinKey = `formatWins.${battleFormat}`;
        const formatMatchKey = `formatMatches.${battleFormat}`;
        if (isDraw) {
          setWinner('引き分け\nお互い健闘しました！');
          addExp(200);
          saveUserToFirestore({ totalMatches: increment(1), [formatMatchKey]: increment(1) });
        } else if (isWin) {
          const winDetail = battleFormat !== 'master_duel' ? `\n${newPlayerRoundWins}-${newPcRoundWins} (${formatLabel})` : '';
          setWinner(`勝利！\nおめでとう！${winDetail}`);
          addExp(500);
          // CPU戦は1日の獲得上限あり(荒稼ぎ防止)。PvPは対人戦のため上限なし。
          if (gameMode === 'cpu') addCpuBattleMp(300); else addBoostedMp(300);
          incrementTotalWins();
          saveUserToFirestore({ totalWins: increment(1), totalMatches: increment(1), [formatWinKey]: increment(1), [formatMatchKey]: increment(1) });
          if (gameMode === 'cpu') earnBadge('first_cpu_win');
          else earnBadge('first_pvp_win');
          if (playerHP >= INITIAL_HP) earnBadge('perfect_battle');
          if (playerHP <= 5) earnBadge('comeback');
          checkCategoryMasterBadges();
          // 称号条件チェック (totalWins はストアで加算済み)
          checkTitleConditions();
        } else {
          const loseDetail = battleFormat !== 'master_duel' ? `\n${newPlayerRoundWins}-${newPcRoundWins} (${formatLabel})` : '';
          setWinner(`敗北...\n次こそ勝とう！${loseDetail}`);
          addExp(100);
          saveUserToFirestore({ totalMatches: increment(1), [formatMatchKey]: increment(1) });
        }
        await flushSessionData();
        setGameState('end');
        return;
      }

      // Round-based format: advance round counter and log score
      if (battleFormat !== 'master_duel') {
        setCurrentRound(prev => prev + 1);
        addLog(`第${currentRound}回戦終了 [${newPlayerRoundWins}-${newPcRoundWins}]`);
      }

      // PvP: update Firestore HP
      if (gameMode === 'pvp' && currentRoomId && db && isHostRef.current) {
        const p1Hp = playerHP;
        const p2Hp = pcHP;
        let wId = p1Hp <= 0 && p2Hp <= 0 ? 'draw' : p1Hp <= 0 ? 'guest' : p2Hp <= 0 ? 'host' : null;
        const updates: any = { p1Hp, p2Hp, p1Move: null, p2Move: null };
        if (wId) { updates.winnerId = wId; updates.status = 'finished'; }
        else { updates.round = increment(1); }
        await updateDoc(doc(db, 'rooms', currentRoomId), updates).catch(console.error);
      }

      // Next round setup
      setInitiative(isPlayerLostRound ? 'player' : 'pc');
      setPlayerHand(prev => {
        const needed = HAND_SIZE - prev.length;
        if (needed <= 0 || playerDeck.length === 0) return prev;
        const newCards = playerDeck.slice(0, needed);
        setPlayerDeck(d => d.slice(needed));
        return [...prev, ...newCards];
      });
      setPcHand(prev => {
        const needed = HAND_SIZE - prev.length;
        if (needed <= 0 || pcDeck.length === 0) return prev;
        const newCards = pcDeck.slice(0, needed);
        setPcDeck(d => d.slice(needed));
        return [...prev, ...newCards];
      });
      setPlayerPlayedCard(null);
      setPcPlayedCard(null);
      setRoundResult(null);
      setPlayerAnswered(false);
      setPcAnswered(false);
      setSelectedCardId(null);
      setMismatchRound(false);
      setTurnPhase('selecting_card');
    }, 3000);
    return () => clearTimeout(timer);
  }, [turnPhase, playerHP, pcHP, gameMode, currentRoomId, playerDeck, pcDeck, addExp, roundResult, battleFormat, playerRoundWins, pcRoundWins, currentRound, getRequiredWins]);

  // ============================
  // Render
  // ============================
  if (authLoading || showSplash) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-950">
        <div className="text-center animate-[fadeIn_1.5s_ease-in-out]">
          <p className="text-lg text-gray-400 font-mono tracking-[0.3em] opacity-80">
            presented by
          </p>
          <p className="text-2xl text-white font-bold font-mono tracking-[0.2em] mt-2">
            onokomachi
          </p>
        </div>
        <style>{`
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  const renderContent = () => {
    switch (gameState) {
      case 'login_screen':
        return (
          <LoginScreen
            currentUser={user}
            onLogin={handleLogin}
            onGuestPlay={handleGuestPlay}
            onLogout={handleLogout}
            onOpenGameMaster={handleOpenGameMaster}
            mathPoints={mathPoints}
            playerLevel={playerLevel}
            studentProfile={studentProfile}
            onStudentProfileSet={handleStudentProfileSet}
          />
        );

      case 'main_menu':
        return (
          <MainMenu
            onSelectMode={mode => setGameState(mode)}
            playerLevel={playerLevel}
            playerExp={playerExp}
            expForNextLevel={expForNextLevel(playerLevel)}
            user={user}
            mathPoints={mathPoints}
            onLogout={handleLogout}
            loginStreak={loginStreak}
            onOpenQuests={() => setShowQuestPanel(true)}
            onOpenLoginBonus={() => setShowLoginBonus(true)}
            canAccessGameMaster={canAccessGameMaster}
            onOpenGameMaster={handleOpenGameMaster}
            dailyQuestDefs={DAILY_QUEST_DEFS}
            dailyQuestProgress={dailyQuestProgress}
            dailyQuestDone={dailyQuestDone}
            onOpenClassBattle={() => setShowClassBattle(true)}
            hasStudentProfile={!!studentProfile}
            srsReviewCount={getDueCount()}
            onOpenWeakness={() => setShowWeaknessPanel(true)}
            onOpenItemShop={() => setShowItemShop(true)}
            equippedTitleName={equippedTitle ? (TITLE_DEFS.find(t => t.id === equippedTitle)?.name || SHOP_ITEMS.find(i => i.id === equippedTitle)?.name || null) : null}
          />
        );

      case 'practice_mode':
        return (
          <PracticeMode
            onSessionComplete={pts => { addMathPoints(pts); setGameState('main_menu'); }}
            db={db}
            user={user}
            studentProfile={studentProfile}
            lockedUnits={lockedUnits}
          />
        );

      case 'review_mode':
        return (
          <ReviewMode
            onExit={pts => { if (pts > 0) addMathPoints(pts); setGameState('main_menu'); }}
          />
        );

      case 'mock_test':
        return (
          <MockTestMode
            onExit={() => setGameState('main_menu')}
            onTestFinished={handleTestFinished}
          />
        );

      case 'learning_log':
        return (
          <LearningLogScreen
            onExit={() => setGameState('main_menu')}
            equippedBackground={equippedBackground}
            onEquipBackground={handleEquipBackground}
          />
        );

      case 'deck_building':
        return (
          <DeckBuilder
            ownedCards={ownedCards}
            onDeckSubmit={(deck, mode, format) => {
              const bmode: BattleMode = (mode as string) === 'pvp' ? 'pvp' : 'cpu';
              setGameMode(bmode);
              setBattleFormat(format);
              setBattleType('card_battle');
              if (bmode === 'pvp') {
                pvpDeckRef.current = deck;
                setPlayerDeck(deck);
                setGameState('matchmaking');
              } else {
                startGame(deck, true, undefined, format);
                setGameState('in_game');
              }
            }}
            onBack={() => setGameState('main_menu')}
          />
        );

      case 'matchmaking':
        return (
          <Matchmaking
            rooms={rooms}
            onJoinRoom={handleJoinRoom}
            onCancel={async () => {
              await leaveRoom(currentRoomId, isHost);
              cleanupGameSession();
              setGameState(battleType === 'speed_duel' ? 'speed_duel_setup' : 'deck_building');
            }}
            currentRoomId={currentRoomId}
            user={user}
            connectionError={firestoreError}
            battleType={battleType}
          />
        );

      case 'speed_duel_setup':
        return (
          <SpeedDuelSetup
            onStart={(categories, format, mode) => {
              setBattleType('speed_duel');
              startSpeedDuel(categories, format, mode);
            }}
            onBack={() => { setBattleType('card_battle'); setGameState('main_menu'); }}
            isLoggedIn={!!user}
            lockedUnits={lockedUnits}
          />
        );

      case 'speed_duel':
        return (
          <SpeedDuelBoard
            problem={speedProblems[speedRound - 1] || null}
            playerScore={speedPlayerScore}
            opponentScore={speedOpponentScore}
            round={speedRound}
            totalRounds={speedTotalRounds}
            format={battleFormat}
            phase={speedPhase}
            onAnswer={handleSpeedAnswer}
            onNextRound={handleSpeedNextRound}
            onExit={() => {
              if (speedTimerRef.current) clearInterval(speedTimerRef.current);
              if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current);
              setBattleType('card_battle');
              setGameState('main_menu');
            }}
            roundWinner={speedRoundWinner}
            playerName={user?.displayName || 'あなた'}
            opponentName={gameMode === 'cpu' ? 'CPU' : '相手'}
            isPlayerAnswered={speedPlayerAnswered}
            isOpponentAnswered={speedOpponentAnswered}
            timeLeft={speedTimeLeft}
            gameResult={speedGameResult}
          />
        );

      case 'card_shop':
        return (
          <CardShop
            mathPoints={mathPoints}
            onBuyPack={(m, cost, _t) => buyCardPack(m, cost)}
            onExit={() => setGameState('main_menu')}
            lockedUnits={lockedUnits}
          />
        );

      case 'in_game':
        return (
          <>
            <GameBoard
              turnPhase={turnPhase}
              playerScore={playerScore}
              pcScore={pcScore}
              playerHP={playerHP}
              pcHP={pcHP}
              initialHP={INITIAL_HP}
              playerHand={playerHand}
              pcHandSize={pcHand.length}
              playerDeckSize={playerDeck.length}
              pcDeckSize={pcDeck.length}
              playerPlayedCard={playerPlayedCard}
              pcPlayedCard={pcPlayedCard}
              onCardSelect={handleCardClickInHand}
              onAnswerSubmit={handlePlayerAnswer}
              selectedCardId={selectedCardId}
              gameLog={gameLog}
              roundResult={roundResult}
              maxScore={INITIAL_HP}
              initiative={initiative}
              chainCount={chainCount}
              wrongAnswerText={wrongAnswerText}
              playerWrongAnswer={playerWrongAnswer}
              wrongCategory={wrongCategory}
              mismatchRound={mismatchRound}
              battleFormat={battleFormat}
              playerRoundWins={playerRoundWins}
              pcRoundWins={pcRoundWins}
              currentRound={currentRound}
              battleTheme={equippedTheme}
            />
            {/* 相手切断通知バナー */}
            {opponentDisconnected && gameMode === 'pvp' && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500 rounded-xl px-6 py-3 flex items-center gap-4 shadow-2xl">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-red-200 text-sm font-bold">相手の接続が切れました</span>
                  <span className="text-red-300/60 text-[10px]">しばらくすると自動的に勝利になります</span>
                </div>
                <button
                  onClick={async () => {
                    if (currentRoomId && db) {
                      await updateDoc(doc(db, 'rooms', currentRoomId), {
                        status: 'finished',
                        winnerId: isHost ? 'host' : 'guest',
                      }).catch(() => {});
                    }
                  }}
                  className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
                >
                  今すぐ勝利を宣言
                </button>
              </div>
            )}
          </>
        );

      case 'end':
        return (
          <div className="text-center flex flex-col items-center justify-center h-full animate-level-up-reveal">
            <h1 className="text-7xl font-bold text-hologram mb-4 whitespace-pre-line uppercase tracking-widest leading-tight">
              {winner}
            </h1>
            <div className="flex gap-4 mt-12">
              <button
                onClick={() => { cleanupGameSession(); setChainCount(0); setGameState('deck_building'); }}
                className="btn-tactical py-4 px-10 rounded-lg text-xl tracking-[0.4em]"
              >
                RETRY
              </button>
              <button
                onClick={async () => { await flushSessionData(); cleanupGameSession(); setChainCount(0); setGameState('main_menu'); }}
                className="border border-gray-600 text-gray-400 hover:text-white py-4 px-10 rounded-lg text-xl tracking-[0.4em] transition-colors"
              >
                MENU
              </button>
            </div>
          </div>
        );

      case 'tutorial':
        return (
          <TutorialBattle
            onComplete={() => {
              setTutorialDone(true);
              earnBadge('tutorial_clear');
              setGameState('main_menu');
            }}
            onSkip={() => {
              setTutorialDone(true);
              setGameState('main_menu');
            }}
          />
        );

      case 'gamemaster':
        return db ? (
          <GameMaster db={db} onClose={() => setGameState('login_screen')} />
        ) : (
          <div className="text-center text-red-400 p-12">Firebase接続エラー</div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="w-screen h-screen relative flex flex-col items-center justify-center font-sans">
      <GravityBackground />
      <BackgroundFX background={equippedBackground} />
      <div className="relative z-10 w-full h-full">
        {renderContent()}
        {levelUpInfo && <LevelUpModal {...levelUpInfo} onClose={() => setLevelUpInfo(null)} />}
        {showAdminPasswordModal && (
          <AdminPasswordModal
            onSuccess={() => { setShowAdminPasswordModal(false); setGameState('gamemaster'); }}
            onCancel={() => setShowAdminPasswordModal(false)}
          />
        )}
        {showQuestPanel && (
          <QuestPanel
            loginStreak={loginStreak}
            dailyProgress={dailyQuestProgress}
            dailyCompleted={Object.fromEntries([...dailyQuestDone].map(id => [id, true]))}
            weeklyProgress={weeklyQuestProgress}
            weeklyCompleted={Object.fromEntries([...weeklyQuestDone].map(id => [id, true]))}
            onClose={() => setShowQuestPanel(false)}
          />
        )}
        {pendingBadge && (
          <BadgeNotification
            badge={pendingBadge}
            onDismiss={() => setPendingBadge(null)}
          />
        )}
        {showLoginBonus && (
          <LoginBonusModal
            loginStreak={loginStreak}
            todayReward={getLoginReward(loginStreak)}
            alreadyClaimed={loginBonusClaimed}
            onClaim={handleClaimLoginBonus}
            onClose={() => setShowLoginBonus(false)}
          />
        )}
        {showClassBattle && db && (
          <ClassBattleBoard
            db={db}
            onClose={() => setShowClassBattle(false)}
            currentSchool={studentProfile?.school}
          />
        )}
        {showWeaknessPanel && (
          <WeaknessPanel onClose={() => setShowWeaknessPanel(false)} />
        )}
        {showItemShop && (
          <ItemShop
            mathPoints={mathPoints}
            ownedItems={ownedShopItems}
            earnedTitleIds={earnedTitleIds}
            equippedTitle={equippedTitle}
            equippedTheme={equippedTheme}
            hintTokens={hintTokens}
            onPurchase={handleShopPurchase}
            onEquipTitle={setEquippedTitle}
            onEquipTheme={setEquippedTheme}
            onClose={() => setShowItemShop(false)}
          />
        )}
        {/* PvP再接続プロンプト */}
        {resumeCandidate && (gameState === 'main_menu' || gameState === 'login_screen') && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="max-w-sm w-full bg-slate-900 border border-red-700/50 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-3">🔌</p>
              <h2 className="text-lg font-bold text-white mb-2">進行中の対戦があります</h2>
              <p className="text-xs text-gray-400 mb-6">
                {resumeCandidate.battleType === 'speed_duel' ? 'スピード対戦' : 'カードバトル'}の途中で切断されました。再接続しますか？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => performResume(resumeCandidate)}
                  className="flex-1 btn-tactical py-3 rounded-xl font-bold"
                >
                  再接続する
                </button>
                <button
                  onClick={() => dismissResume(resumeCandidate)}
                  className="flex-1 border border-gray-600 text-gray-400 hover:text-white py-3 rounded-xl font-bold transition-colors"
                >
                  破棄（投了）
                </button>
              </div>
            </div>
          </div>
        )}
        {showNewYearPrompt && studentProfile && (
          <NewYearPrompt
            profile={studentProfile}
            currentSchoolYear={getCurrentSchoolYear()}
            onConfirm={handleNewYearConfirm}
            onSkip={handleNewYearSkip}
          />
        )}
      </div>
    </main>
  );
};

export default App;
