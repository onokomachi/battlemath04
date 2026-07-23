/**
 * spacedRepetitionService.ts — 間隔反復学習エンジン
 *
 * エビデンスA: Cepeda et al. (2006) メタ分析 (184研究, d=0.42)
 *   間隔を置いた反復は集中学習より有意に効果的
 *
 * エビデンスA: Ebbinghaus (1885) 忘却曲線
 *   記憶は指数関数的に減衰 → 最適なタイミングで復習すると定着率が飛躍的に向上
 *
 * アルゴリズム: SM-2簡易版（SuperMemo 2に基づく）
 *   - 不正解: interval = 1日（翌日に再出題）
 *   - 1回目正解: interval = 3日
 *   - 2回目正解: interval = 7日
 *   - 3回目以降: interval = 前回interval × 2（最大30日）
 *   - 全問題は最大50件保持（古い順に削除）
 *
 * データ構造: localStorage `bm_srs_items`
 */

export interface SrsItem {
  /** 問題のカテゴリ（小単元名） */
  category: string;
  /** 問題テキスト（識別用、先頭50文字） */
  questionPreview: string;
  /** 正解 */
  answer: string;
  /** 次回復習予定日 (YYYY-MM-DD) */
  nextReviewDate: string;
  /** 連続正解回数 */
  consecutiveCorrect: number;
  /** 現在の間隔（日数） */
  intervalDays: number;
  /** 登録日時 */
  createdAt: string;
  /** 問題タイプ */
  problemType: string;
}

const STORAGE_KEY = 'bm_srs_items';
const MAX_ITEMS = 50;

const getTodayStr = (): string => new Date().toISOString().slice(0, 10);

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 全SRSアイテムを取得 */
export const getSrsItems = (): SrsItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** SRSアイテムを保存 */
const saveSrsItems = (items: SrsItem[]): void => {
  // 最大件数を超えたら古い順に削除
  const sorted = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const trimmed = sorted.length > MAX_ITEMS ? sorted.slice(sorted.length - MAX_ITEMS) : sorted;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
};

/**
 * 不正解時に呼び出し: 問題をSRSキューに追加
 * 同じcategory+answerの問題は重複しない（intervalをリセット）
 */
export const addIncorrectToSrs = (
  category: string,
  questionPreview: string,
  answer: string,
  problemType: string
): void => {
  const items = getSrsItems();
  const today = getTodayStr();

  // 既存の同一問題を検索
  const existingIdx = items.findIndex(
    item => item.category === category && item.answer === answer
  );

  if (existingIdx >= 0) {
    // リセット: 再度間違えたので間隔を1日に戻す
    items[existingIdx].consecutiveCorrect = 0;
    items[existingIdx].intervalDays = 1;
    items[existingIdx].nextReviewDate = addDays(today, 1);
  } else {
    // 新規追加
    items.push({
      category,
      questionPreview: questionPreview.slice(0, 50),
      answer,
      nextReviewDate: addDays(today, 1),
      consecutiveCorrect: 0,
      intervalDays: 1,
      createdAt: today,
      problemType,
    });
  }

  saveSrsItems(items);
};

/**
 * 復習で正解した時に呼び出し: 間隔を延長
 * SM-2簡易版: 1日→3日→7日→14日→30日
 */
export const markSrsCorrect = (category: string, answer: string): void => {
  const items = getSrsItems();
  const today = getTodayStr();
  const idx = items.findIndex(
    item => item.category === category && item.answer === answer
  );

  if (idx < 0) return;

  const item = items[idx];
  item.consecutiveCorrect += 1;

  // SM-2簡易版の間隔計算
  if (item.consecutiveCorrect === 1) {
    item.intervalDays = 3;
  } else if (item.consecutiveCorrect === 2) {
    item.intervalDays = 7;
  } else {
    item.intervalDays = Math.min(30, item.intervalDays * 2);
  }

  item.nextReviewDate = addDays(today, item.intervalDays);

  // 3回以上連続正解 かつ interval >= 30日 → 習得済みとして削除
  if (item.consecutiveCorrect >= 3 && item.intervalDays >= 30) {
    items.splice(idx, 1);
  }

  saveSrsItems(items);
};

/** 今日復習すべきアイテムを取得（期日が今日以前のもの） */
export const getDueItems = (): SrsItem[] => {
  const items = getSrsItems();
  const today = getTodayStr();
  return items.filter(item => item.nextReviewDate <= today);
};

/** 復習待ちアイテム数を取得（ホーム画面のバッジ表示用） */
export const getDueCount = (): number => getDueItems().length;

/** 全SRSアイテム数を取得 */
export const getTotalSrsCount = (): number => getSrsItems().length;

/** カテゴリ別の復習アイテム数 */
export const getDueByCategory = (): Record<string, number> => {
  const due = getDueItems();
  const result: Record<string, number> = {};
  due.forEach(item => {
    result[item.category] = (result[item.category] || 0) + 1;
  });
  return result;
};
