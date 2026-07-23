import { Coordinates, GRID_SIZE } from "../types";

// Node for A* Algorithm
interface Node {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  parent: Node | null;
}

// Check if coordinate is within grid bounds
const isValid = (x: number, y: number) => {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
};

// Heuristic: Manhattan Distance
const heuristic = (a: Coordinates, b: Coordinates) => {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

/**
 * A* Pathfinding Algorithm
 * @param start Start coordinates
 * @param end End coordinates
 * @param obstacles Set of strings "x,y" that are blocked
 * @returns Array of coordinates representing the path, or null if no path
 */
export const findPath = (
  start: Coordinates,
  end: Coordinates,
  obstacles: Set<string>
): Coordinates[] | null => {
  // Optimization: If start is effectively the end
  if (Math.abs(start.x - end.x) < 1 && Math.abs(start.y - end.y) < 1) return [];

  const openList: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: Math.round(start.x),
    y: Math.round(start.y),
    g: 0,
    h: heuristic(start, end),
    f: 0,
    parent: null
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  // Limit iterations to prevent freezing on unreachable targets
  let iterations = 0;
  const MAX_ITERATIONS = 500; 

  while (openList.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    
    // Get node with lowest f score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    const currentKey = `${current.x},${current.y}`;

    // Found target (or adjacent to target)
    if (Math.abs(current.x - end.x) <= 1 && Math.abs(current.y - end.y) <= 1) {
      const path: Coordinates[] = [];
      let temp: Node | null = current;
      while (temp) {
        path.push({ x: temp.x, y: temp.y });
        temp = temp.parent;
      }
      return path.reverse().slice(1); // Remove start node, return next steps
    }

    closedSet.add(currentKey);

    // Neighbors (Up, Down, Left, Right) - No diagonals for simpler wall logic
    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const neighbor of neighbors) {
      if (!isValid(neighbor.x, neighbor.y)) continue;
      
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;

      // Obstacle check: Walls/Buildings are obstacles
      // Note: We allow the "end" node to be an obstacle (since we attack it)
      const isTarget = Math.abs(neighbor.x - end.x) < 1 && Math.abs(neighbor.y - end.y) < 1;
      if (obstacles.has(neighborKey) && !isTarget) continue;

      const gScore = current.g + 1;
      const existingNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

      if (!existingNode || gScore < existingNode.g) {
        const newNode: Node = {
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: heuristic(neighbor, end),
          f: 0,
          parent: current
        };
        newNode.f = newNode.g + newNode.h;

        if (!existingNode) {
          openList.push(newNode);
        } else {
          existingNode.g = gScore;
          existingNode.f = newNode.f;
          existingNode.parent = current;
        }
      }
    }
  }

  return null; // No path found
};

export type TerrainCostMap = Map<string, number>;

export const buildTerrainCostMap = (terrain: import('../types').TerrainTile[]): TerrainCostMap => {
  const map = new Map<string, number>();
  for (const tile of terrain) {
    let cost: number;
    switch (tile.type) {
      case 'WATER': cost = Infinity; break;
      case 'ROCK':  cost = Infinity; break;
      case 'BRIDGE': cost = 3; break;
      case 'SWAMP':  cost = 2; break;
      default:       cost = 1;
    }
    map.set(`${tile.x},${tile.y}`, cost);
  }
  return map;
};

export const findPathWithTerrain = (
  start: Coordinates,
  end: Coordinates,
  obstacles: Set<string>,
  terrainCosts: TerrainCostMap
): Coordinates[] | null => {
  if (Math.abs(start.x - end.x) < 1 && Math.abs(start.y - end.y) < 1) return [];

  const openList: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: Math.round(start.x), y: Math.round(start.y),
    g: 0, h: heuristic(start, end), f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  let iterations = 0;
  const MAX_ITERATIONS = 600;

  while (openList.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    const currentKey = `${current.x},${current.y}`;

    if (Math.abs(current.x - end.x) <= 1 && Math.abs(current.y - end.y) <= 1) {
      const path: Coordinates[] = [];
      let temp: Node | null = current;
      while (temp) { path.push({ x: temp.x, y: temp.y }); temp = temp.parent; }
      return path.reverse().slice(1);
    }

    closedSet.add(currentKey);

    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const neighbor of neighbors) {
      if (!isValid(neighbor.x, neighbor.y)) continue;
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;

      const terrainCost = terrainCosts.get(neighborKey) ?? 1;
      if (terrainCost === Infinity) continue; // impassable terrain

      const isTarget = Math.abs(neighbor.x - end.x) < 1 && Math.abs(neighbor.y - end.y) < 1;
      if (obstacles.has(neighborKey) && !isTarget) continue;

      const gScore = current.g + terrainCost;
      const existingNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

      if (!existingNode || gScore < existingNode.g) {
        const newNode: Node = {
          x: neighbor.x, y: neighbor.y,
          g: gScore, h: heuristic(neighbor, end), f: 0, parent: current,
        };
        newNode.f = newNode.g + newNode.h;
        if (!existingNode) openList.push(newNode);
        else { existingNode.g = gScore; existingNode.f = newNode.f; existingNode.parent = current; }
      }
    }
  }
  return null;
};
