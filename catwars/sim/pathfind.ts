// ── 決定論的な経路探索（A*）─────────────────────────────────────────────
//
// catwars/utils/aiEngine.ts の findPathWithTerrain を、ロックステップ同期でも
// 使えるように書き直したもの。変更点は2つ。
//
// 1. 【決定論】展開順に**完全な全順序**を与えた。
//    元実装は毎回 `openList.sort((a,b) => a.f - b.f)` してから shift していた。
//    Array.prototype.sort は ES2019 以降 stable なので実は決定論的だったが、
//    「安定ソートに暗黙に依存している」状態は危うい（比較関数を少し触るだけで
//    壊れる）。ここでは (f, h, y, x) による全順序で比較するので、同点が
//    原理的に発生せず、ヒープの実装詳細に依存しない。
//
// 2. 【正しさ】g値の更新を正しく扱うようにした。
//    元実装は `openList.find(...)` でオープンリストの中しか探しておらず、
//    さらに既存ノードを見つけても優先度キューの位置を直さないため、
//    より短い経路を見つけても反映されないことがあった。
//    ④「指定した場所に最短距離で移動してほしい」という要件に対して
//    実際に最短を返すよう、gScore マップで管理する形に修正している。
//
// 計算量も毎反復 O(n log n) のソートから、二分ヒープの O(log n) に下がる。

import { Coordinates, GRID_W, GRID_H } from '../types';
import type { TerrainCostMap } from '../utils/aiEngine';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
}

/** (f, h, y, x) の辞書式順序。同点が起きないので展開順が一意に定まる。 */
function less(a: Node, b: Node): boolean {
  if (a.f !== b.f) return a.f < b.f;
  if (a.h !== b.h) return a.h < b.h;
  if (a.y !== b.y) return a.y < b.y;
  return a.x < b.x;
}

/** 二分ヒープ（最小） */
class Heap {
  private a: Node[] = [];
  get size(): number { return this.a.length; }
  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      const t = a[i]; a[i] = a[p]; a[p] = t;
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        const t = a[i]; a[i] = a[m]; a[m] = t;
        i = m;
      }
    }
    return top;
  }
}

const heuristic = (x: number, y: number, end: Coordinates): number =>
  Math.abs(x - end.x) + Math.abs(y - end.y);

const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;

/** 近傍の走査順。ここを変えると経路が変わるので、両クライアントで同一必須。 */
const NEIGHBORS: readonly [number, number][] = [
  [0, -1],  // 上
  [0, 1],   // 下
  [-1, 0],  // 左
  [1, 0],   // 右
];

const MAX_ITERATIONS = 1800;

/**
 * 地形コストを考慮した A*。
 * @param obstacles 通行不可のセル "x,y"（建物など）。ゴール地点は例外的に通れる（攻撃対象のため）
 * @param terrainCosts セルごとの移動コスト。Infinity は通行不可
 * @returns 開始地点を除いた経路。到達不能なら null
 */
export function findPathDet(
  start: Coordinates,
  end: Coordinates,
  obstacles: Set<string>,
  terrainCosts: TerrainCostMap,
): Coordinates[] | null {
  if (Math.abs(start.x - end.x) < 1 && Math.abs(start.y - end.y) < 1) return [];

  const sx = Math.round(start.x);
  const sy = Math.round(start.y);

  const open = new Heap();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const closed = new Set<string>();

  const startKey = `${sx},${sy}`;
  gScore.set(startKey, 0);
  open.push({ x: sx, y: sy, g: 0, h: heuristic(sx, sy, end), f: heuristic(sx, sy, end) });

  let iterations = 0;

  while (open.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const current = open.pop()!;
    const currentKey = `${current.x},${current.y}`;

    // 既により良い経路で確定ずみなら読み飛ばす（遅延削除）
    if (closed.has(currentKey)) continue;
    if (current.g > (gScore.get(currentKey) ?? Infinity)) continue;
    closed.add(currentKey);

    // ゴール（または隣接）に到達
    if (Math.abs(current.x - end.x) <= 1 && Math.abs(current.y - end.y) <= 1) {
      const path: Coordinates[] = [];
      let k: string | undefined = currentKey;
      while (k) {
        const [px, py] = k.split(',');
        path.push({ x: Number(px), y: Number(py) });
        k = cameFrom.get(k);
      }
      return path.reverse().slice(1); // 開始地点を除く
    }

    for (const [dx, dy] of NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inBounds(nx, ny)) continue;

      const nKey = `${nx},${ny}`;
      if (closed.has(nKey)) continue;

      const terrainCost = terrainCosts.get(nKey) ?? 1;
      if (terrainCost === Infinity) continue;

      // ゴールそのものは障害物でも入れる（そこを攻撃するため）
      const isTarget = Math.abs(nx - end.x) < 1 && Math.abs(ny - end.y) < 1;
      if (obstacles.has(nKey) && !isTarget) continue;

      const tentative = current.g + terrainCost;
      if (tentative >= (gScore.get(nKey) ?? Infinity)) continue;

      gScore.set(nKey, tentative);
      cameFrom.set(nKey, currentKey);
      const h = heuristic(nx, ny, end);
      open.push({ x: nx, y: ny, g: tentative, h, f: tentative + h });
    }
  }

  return null;
}
