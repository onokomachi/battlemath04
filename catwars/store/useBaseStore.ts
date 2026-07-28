import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BuildingType, DeployedBuilding } from '../types';

// ── 陣地ストア（当日リセット制）─────────────────────────────────────────────
//
// 設計意図:
//   施設を「一度買えば永久所有」にすると、数週間で💠が貯まりきり、
//   その日に勉強しなくても満額の陣地が組めてしまう。毎日の学習動機を保つため、
//   **施設は毎日建て直す**方式にした。
//
//   ・建設の支払いは ⚡エナジー（当日リセット通貨＝今日解いたぶん）
//   ・建てた施設は「今日のもちもの」として、その日のうちは
//     どのステージ・どの対戦でも自由に置き直せる（何度でも無料）
//   ・日付が変わると もちもの も 配置 もリセットされる
//
// エビデンス: 変動比率でない「毎日リセットされる資源」は日次のログイン・学習習慣を
// 強く形成する（習慣形成における文脈手がかりの反復: Lally et al. 2010）。
// 一方で失うのは当日ぶんだけなので、1日休んでも進行そのものは失われない
// （損失忌避で子どもを縛りすぎない設計）。

/** 施設の建設コスト（⚡エナジー）。コアは必須なので無料。 */
export const FACILITY_ENERGY_COST: Record<BuildingType, number> = {
  [BuildingType.TOWN_HALL]: 0,
  [BuildingType.WALL]: 3,
  [BuildingType.GOLD_MINE]: 8,
  [BuildingType.ARMY_CAMP]: 10,
  [BuildingType.BARRACKS]: 10,
  [BuildingType.CANNON]: 12,
  [BuildingType.HIDDEN_TESLA]: 18,
};

/** 撤去したときに戻ってくる割合（建て直しを気軽にできるよう全額返す） */
export const REFUND_RATE = 1;

const todayStr = (): string => new Date().toISOString().slice(0, 10);

export type FacilityCounts = Partial<Record<BuildingType, number>>;

interface BaseStore {
  /** 今日建設した施設の数 */
  built: FacilityCounts;
  /** ステージ(章)ごとの配置。今日のうちは保持される */
  layouts: Record<string, DeployedBuilding[]>;
  /** built / layouts が属する日付 */
  date: string;

  /** 日付が変わっていたらリセットする（各画面の入口で呼ぶ） */
  rollDateIfNeeded: () => void;
  /** 今日の もちもの を返す（日付チェック込み） */
  getBuilt: () => FacilityCounts;
  /** 施設を1つ建設する。⚡が足りなければ false */
  build: (type: BuildingType, spendEnergy: (n: number) => boolean) => boolean;
  /** 施設を1つ撤去して⚡を返す */
  demolish: (type: BuildingType, refundEnergy: (n: number) => void) => void;
  /** 指定ステージの配置を取得 */
  getLayout: (chapterId: string) => DeployedBuilding[];
  /** 指定ステージの配置を保存 */
  setLayout: (chapterId: string, layout: DeployedBuilding[]) => void;
  /** そのステージの配置で使用中の施設数 */
  usedIn: (chapterId: string) => FacilityCounts;
  reset: () => void;
}

export const useBaseStore = create<BaseStore>()(
  persist(
    (set, get) => ({
      built: {},
      layouts: {},
      date: todayStr(),

      // 実際のリセットを行う。レンダリング中に呼ぶと React の警告になるので、
      // 画面の useEffect かイベントハンドラからだけ呼ぶこと。
      rollDateIfNeeded: () => {
        const t = todayStr();
        if (get().date !== t) set({ built: {}, layouts: {}, date: t });
      },

      // 読み取り系は set を伴わない純粋な参照にしてある（描画中に呼ばれるため）。
      // 日付が変わっていれば、リセット前でも「空」として見える。
      getBuilt: () => (get().date === todayStr() ? get().built : {}),

      build: (type, spendEnergy) => {
        get().rollDateIfNeeded();
        const cost = FACILITY_ENERGY_COST[type] ?? 0;
        if (cost > 0 && !spendEnergy(cost)) return false;
        set(s => ({ built: { ...s.built, [type]: (s.built[type] ?? 0) + 1 } }));
        return true;
      },

      demolish: (type, refundEnergy) => {
        get().rollDateIfNeeded();
        const have = get().built[type] ?? 0;
        if (have <= 0) return;
        const refund = Math.round((FACILITY_ENERGY_COST[type] ?? 0) * REFUND_RATE);
        if (refund > 0) refundEnergy(refund);
        set(s => ({ built: { ...s.built, [type]: Math.max(0, (s.built[type] ?? 0) - 1) } }));
      },

      getLayout: (chapterId) =>
        (get().date === todayStr() ? get().layouts[chapterId] ?? [] : []),

      setLayout: (chapterId, layout) => {
        get().rollDateIfNeeded();
        set(s => ({ layouts: { ...s.layouts, [chapterId]: layout } }));
      },

      usedIn: (chapterId) => {
        const layout = get().layouts[chapterId] ?? [];
        const out: FacilityCounts = {};
        for (const d of layout) out[d.type] = (out[d.type] ?? 0) + 1;
        return out;
      },

      reset: () => set({ built: {}, layouts: {}, date: todayStr() }),
    }),
    { name: 'catwars-base' }
  )
);
