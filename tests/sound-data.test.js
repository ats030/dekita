import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOUNDS, SOUND_AUDIO } from '../src/modules/data/SoundData.js';

test('sounds include non-animal emojis and have unique names', () => {
  assert.ok(SOUNDS.length >= 12);
  assert.equal(new Set(SOUNDS.map(s => s.name)).size, SOUNDS.length);
  assert.ok(SOUNDS.some(s => s.emoji === '🚗'));
});

test('every sound line has an audio file', () => {
  for (const { filename } of SOUND_AUDIO) {
    assert.ok(fs.existsSync(new URL(`../audio/${filename}`, import.meta.url)), filename);
  }
});
