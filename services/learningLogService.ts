/**
 * services/learningLogService.ts — 「がくしゅうのきろく」データ層
 *
 * wari-hissann3 の progressStore の設計を移植:
 *  - 1問ごとのログ(きょうやった問題の即時確認用。直近500件)
 *  - サブトピック別の習熟度(正答率+連続ノーミスによる熟達バー)
 *  - 本番テストの結果(大問別の詳細・自己ベスト・満点回数)
 *
 * 保存先は localStorage(端末)。Firestore への要約同期は呼び出し側
 * (App.tsx / MockTestMode)が users ドキュメントに対して行う。
 */

export type LogMode = 'practice' | 'battle' | 'speed' | 'review' | 'test';

export interface ProblemLogEntry {
  id: string;
  ts: number;
  mode: LogMode;
  subTopic: string;
  /** 問題の表示用ラベル({}マークアップ可) */
  question: string;
  userAnswer: string;
  correct: boolean;
  timeSec?: number;
}

export interface SkillMastery {
  attempts: number;
  corrects: number;
  /** 連続正解数(最大5で熟達MAX。ミスで0にリセット) */
  perfectStreak: number;
  /** 一度でも熟達MAX(5連続正解)に達したか */
  mastered: boolean;
}

export interface TestStepResult {
  daimon: number;
  title: string;
  q: string;
  a: string;
  user: string;
  points: number;
  earned: number;
  correct: boolean;
}

export interface TestRecord {
  id: string;
  ts: number;
  mode: '表' | '裏' | 'ぜんぶ';
  /** テストセット名(例: '1. 大きい数のしくみ')。旧記録には無い */
  setName?: string;
  omoteScore: number;
  omoteMax: number;
  uraScore: number;
  uraMax: number;
  total: number;
  totalMax: number;
  steps: TestStepResult[];
}

export interface TestBests {
  bestOmote: number;
  bestUra: number;
  bestTotal: number;
  perfectCounts: { omote: number; ura: number; total: number };
}

const LOGS_KEY = 'fb_problem_logs_v1';
const MASTERY_KEY = 'fb_skill_mastery_v1';
const TESTS_KEY = 'fb_test_records_v1';
const BESTS_KEY = 'fb_test_bests_v1';
const GOAL_KEY = 'fb_daily_goal_v1';

const LOGS_CAP = 500;
const TESTS_CAP = 30;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

const uuid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ============================
// 1問ごとのログ
// ============================

export const getProblemLogs = (): ProblemLogEntry[] => read<ProblemLogEntry[]>(LOGS_KEY, []);

export const recordProblemLog = (entry: Omit<ProblemLogEntry, 'id' | 'ts'>): void => {
  const logs = getProblemLogs();
  const full: ProblemLogEntry = { ...entry, id: uuid(), ts: Date.now() };
  write(LOGS_KEY, [full, ...logs].slice(0, LOGS_CAP));
  updateMastery(entry.subTopic, entry.correct);
  accumulateDailyPending(entry.subTopic, entry.correct);
};

const startOfToday = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** きょうやった問題(新しい順) */
export const getTodayLogs = (): ProblemLogEntry[] => {
  const t = startOfToday();
  return getProblemLogs().filter((l) => l.ts >= t);
};

export const getTodayCorrectCount = (): number => getTodayLogs().filter((l) => l.correct).length;

// ============================
// 習熟度(サブトピック別)
// ============================

export const getAllMastery = (): Record<string, SkillMastery> => read(MASTERY_KEY, {});

const updateMastery = (subTopic: string, correct: boolean): void => {
  const all = getAllMastery();
  const prev = all[subTopic] ?? { attempts: 0, corrects: 0, perfectStreak: 0, mastered: false };
  const perfectStreak = correct ? Math.min(prev.perfectStreak + 1, 5) : 0;
  all[subTopic] = {
    attempts: prev.attempts + 1,
    corrects: prev.corrects + (correct ? 1 : 0),
    perfectStreak,
    mastered: prev.mastered || perfectStreak >= 5,
  };
  write(MASTERY_KEY, all);
};

// ============================
// デイリー目標
// ============================

export const getDailyGoal = (): number => read<number>(GOAL_KEY, 10);
export const setDailyGoal = (n: number): void => write(GOAL_KEY, n);

// ============================
// 本番テスト
// ============================

export const getTestRecords = (): TestRecord[] => read<TestRecord[]>(TESTS_KEY, []);
export const getTestBests = (): TestBests =>
  read<TestBests>(BESTS_KEY, { bestOmote: 0, bestUra: 0, bestTotal: 0, perfectCounts: { omote: 0, ura: 0, total: 0 } });

// ============================
// 先生向け学習分析(日次サマリ)
// 通信量の設計: 1問ごとには書き込まず、端末内(localStorage)に日単位で集計し、
// セッション終了時の flush で users とは別の dailySummaries/{uid_日付} に
// setDoc(merge) を1回だけ行う。150人が毎日使っても 数百write/日 に収まる。
// 誤答傾向はサブトピック別の誤答数として同じドキュメントに載せる。
// ============================

export interface DailyPending {
  date: string; // YYYY-MM-DD
  answered: number;
  correct: number;
  /** サブトピック別 { 出題数, 正解数 } */
  bySubtopic: Record<string, { a: number; c: number }>;
}

const PENDING_KEY = 'fb_daily_pending_v1';

const todayStr = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const accumulateDailyPending = (subTopic: string, correct: boolean): void => {
  const pending = read<DailyPending>(PENDING_KEY, { date: todayStr(), answered: 0, correct: 0, bySubtopic: {} });
  // 日付が変わっていたら未送信分ごとリセット(端末内のみの取りこぼしは許容)
  const p = pending.date === todayStr() ? pending : { date: todayStr(), answered: 0, correct: 0, bySubtopic: {} };
  p.answered += 1;
  if (correct) p.correct += 1;
  const st = p.bySubtopic[subTopic] ?? { a: 0, c: 0 };
  st.a += 1;
  if (correct) st.c += 1;
  p.bySubtopic[subTopic] = st;
  write(PENDING_KEY, p);
};

/**
 * たまった日次サマリを Firestore に1回の setDoc(merge) で送る。
 * 呼び出し元: progressionStore.flushSessionData(セッション終了・メニュー復帰時)。
 * 未ログイン・未設定時は何もしない(端末に残り続け、次回ログイン時に送られる)。
 */
export const flushDailySummary = async (db: any, uid: string | null): Promise<void> => {
  if (!db || !uid) return;
  const pending = read<DailyPending | null>(PENDING_KEY, null);
  if (!pending || pending.answered === 0) return;
  try {
    const { doc, setDoc, increment } = await import('firebase/firestore');
    let label: string | null = null;
    try {
      const sp = JSON.parse(localStorage.getItem('battleMathStudentProfile') || 'null');
      label = sp?.displayLabel ?? null;
    } catch {}
    const bySubtopic: Record<string, { a: any; c: any }> = {};
    Object.entries(pending.bySubtopic).forEach(([st, v]) => {
      bySubtopic[st] = { a: increment(v.a), c: increment(v.c) };
    });
    await setDoc(
      doc(db, 'dailySummaries', `${uid}_${pending.date}`),
      {
        uid,
        label,
        date: pending.date,
        answered: increment(pending.answered),
        correct: increment(pending.correct),
        bySubtopic,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    // 送信成功後にクリア
    write(PENDING_KEY, { date: pending.date, answered: 0, correct: 0, bySubtopic: {} });
  } catch {
    // 失敗時はそのまま保持(次回flushで再送)
  }
};

/** テスト結果を保存し、更新後の自己ベスト/満点回数を返す */
export const recordTestResult = (rec: Omit<TestRecord, 'id' | 'ts'>): TestBests => {
  const records = getTestRecords();
  const full: TestRecord = { ...rec, id: uuid(), ts: Date.now() };
  write(TESTS_KEY, [full, ...records].slice(0, TESTS_CAP));

  const bests = getTestBests();
  if (rec.omoteMax > 0) {
    bests.bestOmote = Math.max(bests.bestOmote, rec.omoteScore);
    if (rec.omoteScore === rec.omoteMax) bests.perfectCounts.omote += 1;
  }
  if (rec.uraMax > 0) {
    bests.bestUra = Math.max(bests.bestUra, rec.uraScore);
    if (rec.uraScore === rec.uraMax) bests.perfectCounts.ura += 1;
  }
  if (rec.omoteMax > 0 && rec.uraMax > 0) {
    bests.bestTotal = Math.max(bests.bestTotal, rec.total);
    if (rec.total === rec.totalMax) bests.perfectCounts.total += 1;
  }
  write(BESTS_KEY, bests);
  return bests;
};
