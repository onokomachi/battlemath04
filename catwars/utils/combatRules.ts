// ── 戦闘ルール補助（⑥ 難易度調整の中核）─────────────────────────────────
//
// テストプレイでの指摘:
//   「大砲の威力が強く、単体のキャラではすぐに倒される」
//   「壁を越えてビームを打ってくるため難易度がとても高く感じた」
//
// 原因（コード上の実測）:
//   (a) 威力: 大砲 20dmg/1000ms = 20DPS に対し基本ネコの HP は 60 → 3.0秒で死亡。
//       隠しテスラは 40DPS → 1.5秒で死亡。反応して手を打つ余地が無い。
//   (b) 遮蔽なし: 防衛施設の索敵が直線距離だけの判定で、壁の内外を区別していなかった。
//       このため壁は「守る意味のあるオブジェクト」ではなく、ただの通行妨害だった。
//   (c) 標的選択: `hostiles.find(...)` が**配列の先頭**を撃っていたため、
//       「タンクで砲撃を引きつける」という設計上の戦術がまったく機能していなかった。
//
// 対策:
//   (a) は `BUILDING_STATS` の数値調整で対応（constants.ts のコメント参照）。
//   (b) 本ファイルの `hasLineOfSight()`。壁は砲撃・ビームを遮る。
//   (c) 本ファイルの `pickDefenseTarget()`。ヘイト値（aggro）→距離の順で選ぶ。
//
// エビデンス:
//   ・[レベル1] 反応の余地の確保: 8〜10歳の選択反応時間は成人より有意に遅く
//     (Kail 1991; Der & Deary 2006)、観察→判断→操作の1サイクルには秒単位の余裕がいる。
//     Time-To-Kill を4秒以上に取るのはこの制約から逆算した設計値。
//   ・[レベル2] 遮蔽の導入は「因果の可読性」を上げる。プレイヤーが被害の原因を
//     特定できないゲームは学習も再挑戦意欲も損なう (Lomas et al. 2013 の
//     難易度知覚の議論、および Björk & Holopainen 2005 の Perceivable Consequence)。
//   ・[レベル3] ヘイト管理はRTS/タワーディフェンスの定石で、役割の直交性
//     (Adams & Rollings) を成立させる前提条件。

import { BattleEntity, BuildingType } from '../types';

/** 飛行系は壁も岩も無視して進む（＝壁による遮蔽の恩恵も受けられない） */
export function isFlying(subType: string): boolean {
  return subType === 'flying';
}

/**
 * ヘイト値。防衛施設は「引きつけ役」を優先してねらう。
 * これにより「タンクを先に出して砲撃を引きつけ、その間に手薄なネコで攻める」
 * という、ゲーム内の戦術解説どおりの立ち回りが実際に成立する。
 */
export function aggroWeight(subType: string): number {
  switch (subType) {
    case 'giant': return 3.0;        // タンク系: 盾役
    case 'boss_titan': return 3.0;
    case 'brute': return 2.5;
    case 'bomber': return 1.6;       // 爆発系: 防衛施設ねらいなので中程度に目立つ
    case 'boss_overlord': return 1.4;
    case 'boss_artillery': return 1.4;
    default: return 1.0;
  }
}

/**
 * from から to までの直線上に壁があるかを判定する。
 * 射手・標的それぞれの足元セルは判定から除外し、「密着している壁」で
 * 撃てなくなる不自然さを避ける。
 */
export function hasLineOfSight(
  fromX: number, fromY: number,
  toX: number, toY: number,
  wallCells: Set<string>,
): boolean {
  if (wallCells.size === 0) return true;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return true;

  const STEP = 0.2;
  const steps = Math.floor(dist / STEP);
  // 端の 0.55 タイルぶんは無視（自分の足元・標的の足元）
  const skip = Math.ceil(0.55 / STEP);

  // 引数はセルの「中心座標」(x+0.5) で渡ってくるので、そのまま floor すればセル番号になる。
  for (let i = skip; i <= steps - skip; i++) {
    const t = (i * STEP) / dist;
    const cx = Math.floor(fromX + dx * t);
    const cy = Math.floor(fromY + dy * t);
    if (wallCells.has(`${cx},${cy}`)) return false;
  }
  return true;
}

/**
 * 防衛施設が撃つべき相手を選ぶ。
 *   1. 射程内、かつ壁で遮られていない相手だけを候補にする
 *   2. そのうちヘイト値の高いもの（タンク役）を優先
 *   3. 同じヘイトなら近いほうを優先
 */
export function pickDefenseTarget(
  building: BattleEntity,
  hostiles: BattleEntity[],
  wallCells: Set<string>,
): BattleEntity | null {
  const bx = building.x + 0.5;
  const by = building.y + 0.5;

  let best: BattleEntity | null = null;
  let bestAggro = -Infinity;
  let bestDist = Infinity;

  for (const h of hostiles) {
    if (h.hp <= 0) continue;
    const d = Math.hypot(h.x - building.x, h.y - building.y);
    if (d > building.attackRange) continue;
    // 飛行している相手は壁のむこうでも見える（＝壁でかくれられない）
    if (!isFlying(h.subType) && !hasLineOfSight(bx, by, h.x + 0.5, h.y + 0.5, wallCells)) continue;

    const a = aggroWeight(h.subType);
    if (a > bestAggro || (a === bestAggro && d < bestDist)) {
      best = h; bestAggro = a; bestDist = d;
    }
  }
  return best;
}

/** 現在の壁セル集合を作る（両陣営の壁が等しく遮蔽になる） */
export function collectWallCells(entities: BattleEntity[]): Set<string> {
  const s = new Set<string>();
  for (const e of entities) {
    if (e.type === 'BUILDING' && e.subType === BuildingType.WALL && e.hp > 0) {
      s.add(`${e.x},${e.y}`);
    }
  }
  return s;
}
