import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlockPuzzle, normalizeCells, rotateCells, anchoredCells, canPlace, legalAnchors } from '../src/modules/utils/blocks/BlockPuzzle.js';

function randomSource(seed) {
  let value = seed + 1;
  return () => ((value = value * 16807 % 2147483647) - 1) / 2147483646;
}
test('1000 generated frames have connected four-cell pieces and a complete legal solution', () => {
  const shapes = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const level = createBlockPuzzle(seed % 5, randomSource(seed));
    assert.equal(level.columns, 4);
    assert.equal(level.rows, seed % 5 < 2 ? 3 : 4);
    assert.equal(level.pieces.length * 4, level.rows * level.columns);
    const occupied = new Set();
    for (const piece of level.pieces) {
      assert.equal(piece.cells.length, 4);
      assert.equal(new Set(piece.cells.map(String)).size, 4);
      let cells = piece.cells;
      for (let i = 0; i < 4; i++) cells = rotateCells(cells);
      assert.deepEqual(cells, piece.cells);
      const reached = new Set([String(piece.cells[0])]);
      for (let pass = 0; pass < 4; pass++) {
        for (const [x,y] of piece.cells) {
          if ([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(cell => reached.has(String(cell)))) reached.add(`${x},${y}`);
        }
      }
      assert.equal(reached.size, 4);
      let rotated = piece.cells;
      const target = normalizeCells(piece.target);
      let matches = false;
      for (let i = 0; i < 4; i++) {
        if (JSON.stringify(rotated) === JSON.stringify(target)) matches = true;
        rotated = rotateCells(rotated);
      }
      assert.ok(matches, 'solution must use rotation, not reflection');
      assert.ok(canPlace(piece.target, level.columns, level.rows, occupied));
      piece.target.forEach(([x,y]) => occupied.add(`${x},${y}`));
      shapes.add(JSON.stringify(target));
    }
    assert.equal(occupied.size, level.rows * level.columns);
  }
  assert.ok(shapes.size >= 10, 'generated shapes should vary');
});

test('marked tile remains the placement anchor and bounds/collisions are rejected', () => {
  const cells = normalizeCells([[1,0],[2,0],[0,1],[1,1]]);
  const placed = anchoredCells(cells, 2, 1);
  assert.deepEqual(placed[0], [2,1]);
  assert.equal(canPlace(placed, 4, 4, new Set()), true);
  assert.equal(canPlace(placed, 4, 4, new Set(['1,2'])), false);
  for (const [x,y] of [[0,0],[3,3],[-1,0],[0,-1]]) {
    assert.equal(canPlace(anchoredCells(cells,x,y),4,4,new Set()), false);
  }
});

test('legal anchors enumerate local fits without choosing a solution', () => {
  const cells = normalizeCells([[1,0],[2,0],[0,1],[1,1]]);
  assert.deepEqual([...legalAnchors(cells,4,4,new Set())], ['1,0','2,0','1,1','2,1','1,2','2,2']);
  assert.deepEqual([...legalAnchors(cells,4,4,new Set(['1,2']))], ['1,0','2,0','2,2']);
  const vertical = [[0,0],[0,1],[0,2],[0,3]];
  assert.equal(legalAnchors(vertical,4,3,new Set()).size, 0);
  assert.deepEqual([...legalAnchors(rotateCells(vertical),4,3,new Set())], ['0,0','0,1','0,2']);
});
