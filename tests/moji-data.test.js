import test from 'node:test';
import assert from 'node:assert/strict';
import { GOJUON_ROWS, MOJI_WORDS, MOJI_QUESTIONS, chooseMojiWords } from '../src/modules/data/MojiData.js';
import { SHIRITORI_AUDIO } from '../src/modules/data/ShiritoriWords.js';

test('the table holds the 46 clear sounds exactly once', () => {
  const chars = GOJUON_ROWS.flat().filter(Boolean);
  assert.equal(GOJUON_ROWS.length, 5);
  assert.ok(GOJUON_ROWS.every(row => row.length === 10));
  assert.equal(chars.length, 46);
  assert.equal(new Set(chars).size, 46);
});

test('every word is short, typeable from the table and has a recorded voice', () => {
  const chars = new Set(GOJUON_ROWS.flat().filter(Boolean));
  const voices = new Set(SHIRITORI_AUDIO.map(line => line.text));
  assert.ok(MOJI_WORDS.length >= MOJI_QUESTIONS * 2);
  for (const word of MOJI_WORDS) {
    assert.ok([...word.name].length >= 2 && [...word.name].length <= 3);
    assert.ok([...word.name].every(char => chars.has(char) && char !== 'ん'));
    assert.ok(voices.has(word.name));
  }
});

test('a course has distinct words and varies with the random source', () => {
  const course = chooseMojiWords();
  assert.equal(course.length, MOJI_QUESTIONS);
  assert.equal(new Set(course.map(word => word.id)).size, MOJI_QUESTIONS);
  assert.notDeepEqual(chooseMojiWords(5, () => 0), chooseMojiWords(5, () => .999999));
});

test('every chart character has its own voice file', async () => {
  const { MOJI_AUDIO } = await import('../src/modules/data/MojiData.js');
  const { existsSync } = await import('node:fs');
  const chars = GOJUON_ROWS.flat().filter(Boolean);
  assert.deepEqual(MOJI_AUDIO.map(line => line.text).sort(), [...chars].sort());
  for (const line of MOJI_AUDIO) assert.ok(existsSync(new URL(`../audio/${line.filename}`, import.meta.url)));
});
