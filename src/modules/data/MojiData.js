import { SHIRITORI_WORDS } from './ShiritoriWords.js';

/** Clear-sound (seion) rows in the traditional order; null is an empty cell. */
export const GOJUON_ROWS = [
  ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'],
  ['い', 'き', 'し', 'ち', 'に', 'ひ', 'み', null, 'り', null],
  ['う', 'く', 'す', 'つ', 'ぬ', 'ふ', 'む', 'ゆ', 'る', 'ん'],
  ['え', 'け', 'せ', 'て', 'ね', 'へ', 'め', null, 'れ', null],
  ['お', 'こ', 'そ', 'と', 'の', 'ほ', 'も', 'よ', 'ろ', 'を'],
];
const SEION = new Set(GOJUON_ROWS.flat().filter(Boolean));

export const MOJI_QUESTIONS = 5;
export const MOJI_MIN_LENGTH = 2;
export const MOJI_MAX_LENGTH = 3;

/** Words typed one character at a time: short, and only clear sounds without ん. */
export const MOJI_WORDS = SHIRITORI_WORDS.filter(({ name }) => {
  const chars = [...name];
  return chars.length >= MOJI_MIN_LENGTH && chars.length <= MOJI_MAX_LENGTH
    && chars.every(char => SEION.has(char) && char !== 'ん');
});

export function chooseMojiWords(count = MOJI_QUESTIONS, random = Math.random) {
  const pool = [...MOJI_WORDS];
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count);
}

// Spoken as katakana where a lone は or へ would be read as a particle.
const SPEECH = { は: 'ハ', へ: 'ヘ' };
export const MOJI_AUDIO = [...SEION].map(char => ({
  filename: `moji-char-${char.codePointAt(0)}.mp3`,
  text: char,
  speech: SPEECH[char] ?? char,
}));
