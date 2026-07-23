/**
 * utils/backgroundUnlock.ts — バッジ獲得率による「特別な背景」の解放
 *
 * wari-hissann3 の themeUnlock を移植。
 * マトリックスは(wari-hissann3同様)最初から使える。
 * 25% → 極光(オーロラ) / 50% → 桜吹雪 / 75% → インフェルノ / 100% → 天空神・宇宙神。
 * 報酬による有能感の可視化(自己決定理論)と長期目標の提示。
 */
import { BADGE_DEFS } from '../constants';

export type BackgroundId = 'default' | 'matrix' | 'aurora' | 'sakura' | 'inferno' | 'tenkuu' | 'cosmos';

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  desc: string;
  /** バッジ獲得率がこの値以上で解放(0..1)。未指定=最初から */
  ratio?: number;
  icon: string;
}

export const BACKGROUND_DEFS: BackgroundDef[] = [
  { id: 'default', name: 'スタンダード', desc: 'いつもの背景', icon: '🌌' },
  { id: 'matrix', name: 'マトリックス', desc: 'いつでも使えるよ', icon: '🟢' },
  { id: 'aurora', name: '極光(オーロラ)', desc: 'バッジ25%で解放', ratio: 0.25, icon: '🌈' },
  { id: 'sakura', name: '桜吹雪', desc: 'バッジ50%で解放', ratio: 0.5, icon: '🌸' },
  { id: 'inferno', name: 'インフェルノ', desc: 'バッジ75%で解放', ratio: 0.75, icon: '🔥' },
  { id: 'tenkuu', name: '天空神', desc: 'バッジ100%で解放', ratio: 1.0, icon: '⚡' },
  { id: 'cosmos', name: '宇宙神', desc: 'バッジ100%で解放', ratio: 1.0, icon: '🌠' },
];

/** バッジ獲得率(0..1) */
export const badgeRatio = (earnedBadgeIds: Set<string>): number => {
  if (BADGE_DEFS.length === 0) return 0;
  const earned = BADGE_DEFS.filter((b) => earnedBadgeIds.has(b.id)).length;
  return earned / BADGE_DEFS.length;
};

export const isBackgroundUnlocked = (id: BackgroundId, ratio: number): boolean => {
  const def = BACKGROUND_DEFS.find((b) => b.id === id);
  if (!def || def.ratio == null) return true;
  // 浮動小数の誤差を吸収して 100% 到達を確実に判定する
  return ratio >= def.ratio - 1e-9;
};

const BG_KEY = 'fb_equipped_background_v1';

export const getEquippedBackground = (): BackgroundId => {
  try {
    const v = localStorage.getItem(BG_KEY) as BackgroundId | null;
    return v && BACKGROUND_DEFS.some((b) => b.id === v) ? v : 'default';
  } catch {
    return 'default';
  }
};

export const setEquippedBackground = (id: BackgroundId): void => {
  try { localStorage.setItem(BG_KEY, id); } catch {}
};
