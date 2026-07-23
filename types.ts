
// types.ts

// --- Graphing Problem Types ---
export interface VisualHint {
  type: 'highlight-rect';
  x_range: [number, number];
  y_range: [number, number];
  color: 'blue' | 'green' | 'red';
}

export interface GraphLineData {
    m: number;
    c: number;
    color?: string;
    label?: string;
}

export interface GraphPolygonData {
    points: {x: number, y: number}[];
    color?: string;
}

export interface GraphingProblemData {
  question: string;
}

export interface GraphingWithTableProblemData {
    question: string;
    equation: string;
    table: {x: number, y: number}[];
}

export interface GraphToEquationProblemData {
    question: string;
    points: {x: number, y: number}[];
}

export interface GraphWithDomainProblemData {
    question: string;
    equation: {m: number, c: number};
    x_range: [number, number];
    visualHints: VisualHint[];
    keypadLayout?: string[][];
}

export interface GraphWithAreaProblemData {
    question: string;
    graphLines: GraphLineData[];
    polygon: GraphPolygonData;
    keypadLayout?: string[][];
}


// --- New Problem Data Types ---
export interface VerticalCalculationData {
    operator: '+' | '-';
    lines: [string, string];
    question: string;
}

/**
 * type: 'guided' 用のデータ。参照アプリ(wari-hissann3/syo4-gaisu/syo4-syousu/
 * syo4-bainomikata)の専用インタラクション(筆算シミュレーター・マスターモード・
 * ヒント付きリトライなど)を、そのまま(デザインのみBattle-Math:04風に)動かす。
 * guidedKind で GuidedAnswerHost がどのエンジンを描画するか決める。
 */
export interface GuidedDivisionHissanData {
    guidedKind: 'division-hissan';
    /** カード一覧・デッキビルダーなど「そのまま解答UIを描画しない」画面での表示用フォールバック */
    question?: string;
    dividend: number;
    divisor: number;
    /** 商に0が立つ位を強調する(たすきの筆算) */
    zeroFocus?: boolean;
    /** 商に0が立つ位はかけ算・ひき算の行を省略して書く */
    zeroShortcut?: boolean;
    /** ヒントなしで最後にまとめて採点する「マスターモード」 */
    masterMode?: boolean;
}

export interface GuidedDivisionErrorHunterData {
    guidedKind: 'division-error-hunter';
    question?: string;
    dividend: number;
    divisor: number;
    isCorrect: boolean;
    wrongQuotient: number;
    wrongRemainder: number;
    /** 商を書きはじめる列(0=いちばん左)。省略時は右づめ */
    wrongOffset?: number;
    correctQuotient: number;
    correctRemainder: number;
    /** 「なおして」の段のヒント */
    fixHint: string;
    reasonOptions: string[];
    reasonAnswerIndex: number;
    /** 完了時の一言解説 */
    explain: string;
}

export interface GuidedDecimalColumnData {
    guidedKind: 'decimal-addsub' | 'decimal-muldiv';
    question?: string;
    operator: '+' | '-' | '×' | '÷';
    a: number;
    b: number;
    /** マスターモード(自由配置)を許可するか */
    masterMode?: boolean;
}

export interface GuidedMultiplicationData {
    guidedKind: 'multiplication-hissan';
    question?: string;
    a: number;
    b: number;
    /** ヒントなしでマスを自由に選んで入力し、最後にまとめて採点する「マスターモード」 */
    masterMode?: boolean;
}

export interface GuidedRetryHintData {
    /** 「ダイアグラム+単一解答欄+正解までリトライ+ヒント+結果パネル」の共通エンジン */
    guidedKind: 'retry-hint';
    /** カード一覧などでの表示用(通常は prompt と同じ文字列を入れる) */
    question?: string;
    /** 表示する問題文(FractionText互換のマークアップ可) */
    prompt: string;
    /** 正答(数値文字列)。複数の表現を許すときは answerAliases も判定に使う */
    answer: string;
    answerAliases?: string[];
    svg?: string;
    hint: string | string[];
    /** 選択式のとき(見積もり・切り上げ切り捨て判断など) */
    choices?: string[];
    choiceAnswerIndex?: number;
    /** 複数選択(正答は answer をカンマ区切りで) */
    multiple?: boolean;
    /** 完了時に表示する解説 */
    explain?: string;
    allowDecimal?: boolean;
    /** 数字キーパッド以外に必要な特殊キー(「あまり」など) */
    extraKeys?: string[];
}

export type GuidedProblemData =
    | GuidedDivisionHissanData
    | GuidedDivisionErrorHunterData
    | GuidedDecimalColumnData
    | GuidedMultiplicationData
    | GuidedRetryHintData;

export interface ProofProblemData {
    assumption: string;
    conclusion: string;
    imageUrl?: string;
    svg?: string;
}

export interface SimultaneousEquationData {
    eq1: { a: number, b: number, c: number };
    eq2: { a: number, b: number, c: number };
}

export interface AngleData {
    value: number | string;
    position: 'base_left' | 'base_right' | 'base_right_exterior' | 'top_vertex' | 'top_exterior_left' | 'top_exterior_right';
}

export interface TriangleInParallelLinesData {
    angles: AngleData[];
    unknown: { label: string; position: 'base_left' | 'base_right' | 'top_vertex' };
    questionText?: string;
}

export interface Transversal {
    p1: { x: number, y: number };
    p2: { x: number, y: number };
}
export interface AngleInfo {
    value: string;
    transversalIndex: number;
    parallelLineIndex: number;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    isUnknown: boolean;
    isIntersectionAngle?: boolean;
}
export interface MultiTransversalAngleData {
    parallelLines: { y: number, label: string }[];
    transversals: Transversal[];
    angles: AngleInfo[];
    questionText?: string;
}

// AngleDiagram
export interface Angle {
    position: number;
    value: number;
    name: string;
}
export interface AngleDiagramData {
    config: {
        known: Omit<Angle, 'name'>[];
        unknown: Omit<Angle, 'value'>;
    };
    question: string;
}

// BentTransversal
export interface BentAngle {
    value: number | string;
    placement: string; // 'interior_left', 'exterior_right', etc.
}
export interface BentTransversalDiagramData {
    topAngle: BentAngle;
    bottomAngle: BentAngle;
    unknownAngle: { label: string };
    question: string;
}

// FillInProof
export type ProofPart = string | null | { options: string[] };
export interface ProofStep {
    parts: ProofPart[];
}
export interface FillInProofProblemData {
    question: string;
    steps: ProofStep[];
    imageUrl?: string;
    svg?: string;
}

// GuidedEquation
export interface GuidedEquationData {
    question?: string;
    initial_equations?: [string, string];
    steps: { parts: (string | null)[] }[];
    final_answer_prompt?: string;
    hint?: string | string[];
}

// IntersectionGuidedEquation
export interface IntersectionGuidedEquationData {
    question: string;
    graphLines: GraphLineData[];
    guidedEquation: GuidedEquationData;
}


// --- Data Analysis Problem Types ---
export interface BoxPlotDataDef {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  label?: string;
}

export interface BoxPlotProblemData {
  question: string;
  datasets: BoxPlotDataDef[];
  hideValue?: string;
  options?: string[];
}

export interface HistogramBarDef {
  from: number;
  to: number;
  freq: number;
}

export interface HistogramProblemData {
  question: string;
  bars: HistogramBarDef[];
  xLabel?: string;
  yLabel?: string;
  options?: string[];
}

// --- Student Profile (学校・学年・組・番号) ---
export interface StudentProfile {
  school: string;     // 学校名 (VITE_SCHOOL_NAME/SCHOOL_NAME、例: "○○小学校")
  grade: number;      // 学年(本アプリは4年生専用のため常に TARGET_GRADE(4) 固定)
  classNum: number;   // 組 (1〜10)
  number: number;     // 出席番号 (1〜45)
  displayLabel: string; // e.g. "4年3組12番"
  schoolYear?: number; // 年度 (e.g. 2025) — 4月始まり
}

// --- Auth / Online Types ---

export interface DailyQuestDef {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: { mp: number; exp: number };
  icon: string;
}

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  mathPoints: number;
  playerLevel: number;
  playerExp: number;
  totalWins: number;
  totalMatches: number;
  ownedCardIds: number[];
  createdAt?: any;
  // 形式別勝敗 (denormalized for single-query ranking)
  formatWins?: {
    best_of_3?: number;
    best_of_5?: number;
    best_of_7?: number;
    master_duel?: number;
  };
  formatMatches?: {
    best_of_3?: number;
    best_of_5?: number;
    best_of_7?: number;
    master_duel?: number;
  };
}

/** MPシンク: 購入可能アイテム定義 */
export type ShopItemType = 'title' | 'streak_shield' | 'theme' | 'mp_booster' | 'hint_token' | 'exp_booster';

export interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  type: ShopItemType;
  durationMs?: number;   // mp_booster / exp_booster の有効時間(ms)
  usesPerBattle?: number; // hint_token のバトルあたり使用回数
}

// ============================
// 称号システム（条件達成で付与）
// ============================

export type TitleConditionType =
  | 'total_correct'   // totalCorrectAnswers >= value
  | 'total_wins'      // totalWins >= value
  | 'login_streak'    // loginStreak >= value
  | 'level'           // playerLevel >= value
  | 'badge_owned'     // earnedBadgeIds に badgeId が含まれる
  | 'monthly_top1'    // 月次チャンピオンDoc の winnerUid が自分
  | 'any';            // 常に満たす（スターター）

export interface TitleCondition {
  type: TitleConditionType;
  value?: number;
  badgeId?: string;
}

export interface TitleDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: TitleCondition;
  isMonthly?: boolean;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

// アクティブブースター状態（localStorage + メモリ）
export interface ActiveBooster {
  type: 'mp_booster' | 'exp_booster';
  expiresAt: number; // Date.now() timestamp
  multiplier: number;
}

export type BattleMode = 'cpu' | 'pvp';
export type BattleFormat = 'best_of_3' | 'best_of_5' | 'best_of_7' | 'master_duel';
export type BattleType = 'card_battle' | 'speed_duel';

export interface SavedDeck {
  name: string;
  cardIds: number[];
  createdAt: number;
}

export interface SpeedDuelAnswer {
  answer: string;
  correct: boolean;
  answeredAt: number; // Date.now() timestamp
}

export interface Room {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  createdAt: any;
  hostLastActive: any;
  guestLastActive: any;
  hostReady: boolean;
  guestReady: boolean;
  round: number;
  // HP-based battle
  p1Hp: number;
  p2Hp: number;
  // Moves: serialized card IDs (not full card objects for Firestore)
  p1Move: { cardId: number; answeredCorrectly?: boolean } | null;
  p2Move: { cardId: number; answeredCorrectly?: boolean } | null;
  winnerId: 'host' | 'guest' | 'draw' | 'abandoned' | 'admin_terminated' | null;
  // Speed Duel fields
  battleType?: BattleType;
  speedCategories?: string[];
  speedFormat?: BattleFormat;
  speedRound?: number;
  speedTotalRounds?: number;
  speedP1Score?: number;
  speedP2Score?: number;
  speedProblemIndex?: number;
  speedProblems?: any[]; // serialized problem list (generated by host)
  speedP1Answer?: SpeedDuelAnswer | null;
  speedP2Answer?: SpeedDuelAnswer | null;
  speedRoundWinner?: 'host' | 'guest' | 'draw' | null;
  speedRoundActive?: boolean; // true while round is in progress
}

// --- Core Game Types ---

export type AbilityType = 'DEFENSIVE_STANCE' | 'TIME_PRESSURE' | 'SCORE_BOOST';

export interface Ability {
  type: AbilityType;
  value?: number;
  description: string;
}

// The user's data structure
export interface Problem {
  type: string;
  data: {
    question: string;
    // other fields like svg, options, hint might exist
    [key: string]: any;
  } | AngleDiagramData 
    | BentTransversalDiagramData 
    | FillInProofProblemData
    | GraphingProblemData
    | GraphingWithTableProblemData
    | GraphToEquationProblemData
    | GraphWithDomainProblemData
    | GraphWithAreaProblemData
    | GuidedEquationData
    | IntersectionGuidedEquationData
    | VerticalCalculationData
    | ProofProblemData
    | SimultaneousEquationData
    | TriangleInParallelLinesData
    | MultiTransversalAngleData
    | BoxPlotProblemData
    | HistogramProblemData
    | GuidedProblemData;
  answer: string;
}

export type ProblemSet = Record<string, Problem[]>;

/**
 * スピード対戦用の問題: 出題元カードの単元・難易度を保持する。
 * 単元は弱点分析・間隔反復(SRS)の記録に、難易度はCPUのDDAに使う。
 * (旧形式のPvPルームには無いフィールドのため optional)
 */
export interface SpeedProblem extends Problem {
  category?: string;
  difficulty?: number;
}

// Replaces the old CardData
export interface ProblemCard {
  id: number;
  mainCategory: string; // "式の計算", "図形の性質", etc.
  category: string; // The sub-topic like "式の次数"
  difficulty: number; // e.g., 1, 2, 3
  problem: Problem;
  ability?: Ability;
}

export type TurnPhase = 'selecting_card' | 'solving_problem' | 'round_end' | 'game_over' | 'waiting_for_opponent';
export type GameState = 'login_screen' | 'main_menu' | 'deck_building' | 'in_game' | 'end' | 'practice_mode' | 'review_mode' | 'card_shop' | 'matchmaking' | 'gamemaster' | 'tutorial' | 'speed_duel_setup' | 'speed_duel' | 'mock_test' | 'learning_log' | 'catwars';
export type TurnInitiative = 'player' | 'pc';

// For FillInProofProblemView to connect with a virtual keypad in the future
export interface ProblemViewRef {
    handleKeyClick: (key: string) => void;
}

// --- Practice Mode Types ---
export interface SubCategoryGroup {
    name: string;
    subtopics: string[];
}
export interface Category {
    name: string;
    groups: SubCategoryGroup[];
}

export interface SessionStats {
  correct: number;
  incorrect: number;
  totalScore: number;
  problemCount: number;
}

export interface LearningRecord {
    id: string;
    date: string;
    category: string;
    subTopic: string;
    stats: SessionStats;
}
