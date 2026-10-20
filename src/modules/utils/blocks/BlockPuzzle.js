/** All coordinates are [column, row]; rotations never reflect a piece. */
export function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export const rotateCells = cells => normalizeCells(cells.map(([x, y]) => [-y, x]));

const shapes = [
  [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]],
  [[0,0],[1,0],[2,0],[1,1]], [[0,0],[0,1],[0,2],[1,2]],
  [[1,0],[1,1],[0,2],[1,2]], [[1,0],[2,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]],
];
const variants = [...new Map(shapes.flatMap(shape => {
  const rotations = [];
  let cells = normalizeCells(shape);
  for (let i = 0; i < 4; i++) { rotations.push(cells); cells = rotateCells(cells); }
  return rotations;
}).map(cells => [JSON.stringify(cells), cells])).values()];

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** The first occupied cell, rather than an empty corner, is the anchor. */
export function anchoredCells(cells, column, row) {
  const [ax, ay] = cells[0];
  return cells.map(([x, y]) => [column + x - ax, row + y - ay]);
}

export function canPlace(cells, columns, rows, occupied) {
  return cells.every(([x, y]) => x >= 0 && y >= 0 && x < columns && y < rows && !occupied.has(`${x},${y}`));
}

/** Legal first-cell positions; this checks fit, not the puzzle solution. */
export function legalAnchors(cells, columns, rows, occupied) {
  const anchors = new Set();
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (canPlace(anchoredCells(cells, column, row), columns, rows, occupied)) anchors.add(`${column},${row}`);
    }
  }
  return anchors;
}

/** Make a complete tiling first, then shuffle and rotate its pieces for play. */
export function createBlockPuzzle(round, random = Math.random) {
  const columns = 4, rows = round < 2 ? 3 : 4;
  const occupied = new Set();
  const solution = [];
  function fill() {
    if (occupied.size === rows * columns) return true;
    let first = 0;
    while (occupied.has(`${first % columns},${Math.floor(first / columns)}`)) first++;
    const x = first % columns, y = Math.floor(first / columns);
    for (const shape of shuffled(variants, random)) {
      for (const [sx, sy] of shape) {
        const cells = shape.map(([dx, dy]) => [x + dx - sx, y + dy - sy]);
        if (!canPlace(cells, columns, rows, occupied)) continue;
        cells.forEach(([cx, cy]) => occupied.add(`${cx},${cy}`));
        solution.push(cells);
        if (fill()) return true;
        solution.pop();
        cells.forEach(([cx, cy]) => occupied.delete(`${cx},${cy}`));
      }
    }
    return false;
  }
  if (!fill()) throw new Error('No block tiling found');
  const pieces = shuffled(solution, random).map((target, id) => {
    let cells = normalizeCells(target);
    const turns = Math.floor(random() * 4);
    for (let i = 0; i < turns; i++) cells = rotateCells(cells);
    return { id, cells, target };
  });
  return { columns, rows, pieces };
}
