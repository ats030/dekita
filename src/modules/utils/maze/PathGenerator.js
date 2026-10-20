/** A connected 10×10 maze tree: every cell is reachable, with one solution. */
const COLUMNS = 8;
const ROWS = 8;
const PADDING = 24;
const NEWEST_BIAS = .25;
const CANDIDATES = 24;
const MIN_SOLUTION = 14;
const MIN_DECISIONS = 5;
const MIN_DEAD_ENDS = 14;
const FALLBACK_SEED = 2;

/**
 * Growing-tree spanning tree. Mostly Prim-like (random active cell) with a small
 * newest-cell bias: many short dead-end branches and few long corridors, which
 * is harder to read at a glance than a depth-first maze.
 */
function buildTree(random) {
  const cells = Array.from({ length: COLUMNS * ROWS }, () => []);
  const visited = new Set([0]);
  const active = [0];
  while (active.length) {
    const index = random() < NEWEST_BIAS ? active.length - 1 : Math.floor(random() * active.length);
    const current = active[index];
    const x = current % COLUMNS;
    const y = Math.floor(current / COLUMNS);
    const neighbors = [];
    if (x < COLUMNS - 1) neighbors.push(current + 1);
    if (y < ROWS - 1) neighbors.push(current + COLUMNS);
    if (x > 0) neighbors.push(current - 1);
    if (y > 0) neighbors.push(current - COLUMNS);
    const choices = neighbors.filter(cell => !visited.has(cell));
    if (!choices.length) {
      active.splice(index, 1);
      continue;
    }
    const next = choices[Math.floor(random() * choices.length)];
    cells[current].push(next);
    cells[next].push(current);
    visited.add(next);
    active.push(next);
  }
  return cells;
}

function makeMaze(cells, width, height) {
  const parents = new Map([[0, null]]);
  const queue = [0];
  for (let i = 0; i < queue.length; i++) {
    for (const next of cells[queue[i]]) {
      if (parents.has(next)) continue;
      parents.set(next, queue[i]);
      queue.push(next);
    }
  }
  const solution = [];
  for (let cell = cells.length - 1; cell !== null; cell = parents.get(cell)) solution.push(cell);
  solution.reverse();
  const cellWidth = (width - PADDING * 2) / COLUMNS;
  const cellHeight = (height - PADDING * 2) / ROWS;
  const point = cell => ({
    x: PADDING + (cell % COLUMNS + .5) * cellWidth,
    y: PADDING + (Math.floor(cell / COLUMNS) + .5) * cellHeight,
  });
  const walls = [];
  cells.forEach((neighbors, cell) => {
    const column = cell % COLUMNS;
    const row = Math.floor(cell / COLUMNS);
    const x = PADDING + column * cellWidth;
    const y = PADDING + row * cellHeight;
    if (row === 0) walls.push({ x1: x, y1: y, x2: x + cellWidth, y2: y });
    if (column === 0) walls.push({ x1: x, y1: y, x2: x, y2: y + cellHeight });
    if (column === COLUMNS - 1 || !neighbors.includes(cell + 1)) {
      walls.push({ x1: x + cellWidth, y1: y, x2: x + cellWidth, y2: y + cellHeight });
    }
    if (row === ROWS - 1 || !neighbors.includes(cell + COLUMNS)) {
      walls.push({ x1: x, y1: y + cellHeight, x2: x + cellWidth, y2: y + cellHeight });
    }
  });
  const path = solution.map(point);
  const passages = cells.flatMap((neighbors, cell) => neighbors.filter(next => next > cell)
    .map(next => ({ from: cell, to: next, start: point(cell), end: point(next) })));
  return {
    columns: COLUMNS, rows: ROWS, padding: PADDING, cellWidth, cellHeight,
    cells, walls, passages, solution, path, player: { ...path[0] }, goal: { ...path[path.length - 1] },
    decisions: solution.slice(1, -1).filter(cell => cells[cell].length >= 3).length,
    deadEnds: cells.filter((neighbors, cell) => neighbors.length === 1 && cell !== 0 && cell !== cells.length - 1).length,
  };
}

function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

export class PathGenerator {
  constructor(random = Math.random) {
    this.random = random;
    this.path = [];
  }

  generate(width, height) {
    // Sample several trees and keep the most confusing qualified one:
    // decision points on the answer route, plus dead ends that lure players off it.
    let best = null;
    for (let attempt = 0; attempt < CANDIDATES; attempt++) {
      const maze = makeMaze(buildTree(this.random), width, height);
      if (maze.solution.length < MIN_SOLUTION || maze.decisions < MIN_DECISIONS || maze.deadEnds < MIN_DEAD_ENDS) continue;
      const score = maze.decisions * 3 + maze.deadEnds + maze.solution.length;
      if (!best || score > best.score) best = { maze, score };
    }
    // Known qualified tree, used only if repeated random samples are too simple.
    const maze = best ? best.maze : makeMaze(buildTree(seededRandom(FALLBACK_SEED)), width, height);
    this.path = maze.path;
    return maze;
  }

  getPath() {
    return this.path;
  }
}

function hitsBox(from, to, minimum, maximum) {
  let near = 0;
  let far = 1;
  for (const axis of ['x', 'y']) {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-10) {
      if (from[axis] < minimum[axis] || from[axis] > maximum[axis]) return false;
    } else {
      const first = (minimum[axis] - from[axis]) / delta;
      const last = (maximum[axis] - from[axis]) / delta;
      near = Math.max(near, Math.min(first, last));
      far = Math.min(far, Math.max(first, last));
      if (near > far) return false;
    }
  }
  return true;
}

/** Check the entire gesture segment, including wall thickness and corners. */
export function canTravel(maze, from, to) {
  const clearance = Math.min(maze.cellWidth, maze.cellHeight) * .08;
  for (const point of [from, to]) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        point.x < maze.padding + clearance || point.y < maze.padding + clearance ||
        point.x > maze.padding + maze.columns * maze.cellWidth - clearance ||
        point.y > maze.padding + maze.rows * maze.cellHeight - clearance) return false;
  }
  return !maze.walls.some(wall => hitsBox(from, to,
    { x: Math.min(wall.x1, wall.x2) - clearance, y: Math.min(wall.y1, wall.y2) - clearance },
    { x: Math.max(wall.x1, wall.x2) + clearance, y: Math.max(wall.y1, wall.y2) + clearance },
  ));
}


/** Project onto a passage containing the current player, never another road. */
export function followRoad(maze, player, target) {
  let best = { ...player };
  let distance = Math.hypot(target.x - player.x, target.y - player.y);
  const junctionRadius = Math.min(maze.cellWidth, maze.cellHeight) * .3;
  for (const { start, end } of maze.passages) {
    const minimumX = Math.min(start.x, end.x), maximumX = Math.max(start.x, end.x);
    const minimumY = Math.min(start.y, end.y), maximumY = Math.max(start.y, end.y);
    const onPassage = player.x >= minimumX - 1e-6 && player.x <= maximumX + 1e-6 &&
      player.y >= minimumY - 1e-6 && player.y <= maximumY + 1e-6;
    // Turn through a nearby shared junction, tolerating finger drift and the
    // fractional coordinate rounding of real mouse/touch events.
    const nearJunction = Math.hypot(player.x - start.x, player.y - start.y) <= junctionRadius ||
      Math.hypot(player.x - end.x, player.y - end.y) <= junctionRadius;
    if (!onPassage && !nearJunction) continue;
    const point = {
      x: Math.max(minimumX, Math.min(maximumX, target.x)),
      y: Math.max(minimumY, Math.min(maximumY, target.y)),
    };
    const candidateDistance = Math.hypot(target.x - point.x, target.y - point.y);
    if (candidateDistance < distance - 1e-8) {
      best = point;
      distance = candidateDistance;
    }
  }
  return best;
}
