import test from 'node:test';
import assert from 'node:assert/strict';
import { createPictureLayout } from '../src/modules/utils/pictureLayout.js';

function check(layout, count, width, height) {
  assert.equal(layout.positions.length, count);
  assert.ok(layout.size > 0);
  for (const [index, point] of layout.positions.entries()) {
    assert.ok(point.x >= 0 && point.y >= 0);
    assert.ok(point.x + layout.size <= width + 1e-8);
    assert.ok(point.y + layout.size <= height + 1e-8);
    for (const other of layout.positions.slice(index + 1)) {
      assert.ok(Math.abs(point.x - other.x) >= layout.size + 8 - 1e-8 || Math.abs(point.y - other.y) >= layout.size + 8 - 1e-8);
    }
  }
}

test('1–10 equal pictures fit crowded and spacious areas, including fallback', () => {
  let seed = 42;
  const seededRandom = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const [width, height] of [[254, 100], [270, 126], [325, 210], [300, 120], [440, 430], [800, 120]]) {
    for (let count = 1; count <= 10; count++) {
      for (const random of [seededRandom, () => 0, () => .999999]) {
        for (let sample = 0; sample < 5; sample++) check(createPictureLayout(count, width, height, 65, random), count, width, height);
      }
    }
  }
});
