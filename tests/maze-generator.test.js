import test from 'node:test';
import assert from 'node:assert/strict';
import { PathGenerator, canTravel, followRoad } from '../src/modules/utils/maze/PathGenerator.js';

function randomWithSeed(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function point(maze, cell) {
  return { x: maze.padding + (cell % maze.columns + .5) * maze.cellWidth, y: maze.padding + (Math.floor(cell / maze.columns) + .5) * maze.cellHeight };
}
function onRoad(maze, point) {
  return maze.passages.some(({ start, end }) => point.x >= Math.min(start.x, end.x) - 1e-6 && point.x <= Math.max(start.x, end.x) + 1e-6 && point.y >= Math.min(start.y, end.y) - 1e-6 && point.y <= Math.max(start.y, end.y) + 1e-6);
}

test('seeded and degenerate random sources produce qualified connected trees', () => {
  const sources = [() => 0, () => .999999, ...Array.from({ length: 200 }, (_, seed) => randomWithSeed(seed))];
  for (const random of sources) {
    const maze = new PathGenerator(random).generate(600, 600);
    assert.equal(maze.cells.length, 64);
    assert.equal(maze.cells.reduce((sum, neighbors) => sum + neighbors.length, 0), 126);
    const seen = new Set([0]), queue = [0];
    for (const cell of queue) for (const next of maze.cells[cell]) {
      assert.ok(maze.cells[next].includes(cell));
      const delta = Math.abs(next - cell);
      assert.ok(delta === 8 || (delta === 1 && Math.floor(next / 8) === Math.floor(cell / 8)));
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    assert.equal(seen.size, 64, 'a connected tree has exactly one route between any two cells');
    assert.ok(maze.solution.length >= 14);
    assert.ok(maze.decisions >= 5);
    assert.ok(maze.deadEnds >= 14);
    assert.deepEqual(maze.player, point(maze, 0));
    assert.deepEqual(maze.goal, point(maze, 63));
    assert.equal(canTravel(maze, maze.player, maze.goal), false);
    for (let cell = 0; cell < 64; cell++) {
      for (const next of [cell + 1, cell + 8]) {
        if (next >= 64 || (next === cell + 1 && cell % 8 === 7)) continue;
        assert.equal(canTravel(maze, point(maze, cell), point(maze, next)), maze.cells[cell].includes(next));
      }
    }
  }
});

test('finger drift stays on a connected road; solution and reverse remain traversable', () => {
  for (let seed = 0; seed < 100; seed++) {
    const random = randomWithSeed(seed);
    const maze = new PathGenerator(random).generate(600, 600);
    let player = maze.player;
    for (const target of maze.path.slice(1)) {
      player = followRoad(maze, player, target);
      assert.deepEqual(player, target);
    }
    for (const target of [...maze.path].reverse().slice(1)) {
      player = followRoad(maze, player, target);
      assert.deepEqual(player, target);
    }
    for (let index = 1; index < maze.path.length - 1; index++) {
      const previous = maze.path[index - 1], junction = maze.path[index], next = maze.path[index + 1];
      const near = { x: previous.x + (junction.x - previous.x) * .8, y: previous.y + (junction.y - previous.y) * .8 };
      const projected = followRoad(maze, near, next);
      assert.deepEqual(projected, next, 'near-junction snapping tolerates a rounded or drifting turn');
      assert.ok(canTravel(maze, near, projected));
    }
    for (let move = 0; move < 300; move++) {
      const next = followRoad(maze, player, { x: random() * 500 - 100, y: random() * 500 - 100 });
      assert.ok(onRoad(maze, next));
      assert.ok(canTravel(maze, player, next));
      player = next;
    }
  }
});
