import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIRITORI_WORDS, SHIRITORI_COURSES, SHIRITORI_AUDIO,
  lastSound, soundPrompt, shiritoriChoices, buildShiritoriCourses, chooseShiritoriCourse } from '../src/modules/data/ShiritoriWords.js';

test('every derived course has ten distinct named pictures and nine unambiguous choices', () => {
  const names = new Set(SHIRITORI_WORDS.map(word => word.name));
  assert.equal(names.size, SHIRITORI_WORDS.length);
  assert.equal(new Set(SHIRITORI_WORDS.map(word => word.emoji)).size, SHIRITORI_WORDS.length);
  const voices = new Set(SHIRITORI_AUDIO.map(line => line.text));
  assert.equal(voices.size, SHIRITORI_AUDIO.length);
  assert.equal(SHIRITORI_COURSES.length, 1461);
  assert.equal(new Set(SHIRITORI_COURSES.map(course => course.map(word => word.id).join(','))).size, 1461);
  for (const [courseIndex, course] of SHIRITORI_COURSES.entries()) {
    assert.equal(course.length, 10);
    assert.equal(new Set(course.map(word => word.id)).size, 10);
    for (const word of course) {
      assert.match(word.name, /^[ぁ-ゖ]+$/u);
      assert.notEqual(lastSound(word), 'ん');
      assert.ok(voices.has(word.name));
    }
    for (let index = 1; index < 10; index++) {
      const sound = lastSound(course[index - 1]);
      assert.equal(course[index].name[0], sound);
      assert.ok(voices.has(soundPrompt(sound)));
      for (let seed = 0; seed < 3; seed++) {
        let value = (courseIndex + 1) * 100 + index * 3 + seed;
        const random = () => ((value = (value * 16807) % 2147483647) - 1) / 2147483646;
        const choices = shiritoriChoices(course, index, random);
        assert.equal(choices.length, 4);
        assert.equal(new Set(choices.map(word => word.id)).size, 4);
        assert.equal(choices.filter(word => word.name[0] === sound).length, 1);
        assert.ok(choices.includes(course[index]));
        assert.ok(choices.every(word => !course.slice(0, index).includes(word)));
      }
    }
  }
});

test('every course can be drawn and the previous course is always excluded', () => {
  const total = SHIRITORI_COURSES.length;
  for (let index = 0; index < total; index++) {
    assert.equal(chooseShiritoriCourse(undefined, () => (index + .5) / total), SHIRITORI_COURSES[index]);
  }
  for (const previousIndex of [0, Math.floor(total / 2), total - 1]) {
    const previous = SHIRITORI_COURSES[previousIndex];
    const seen = new Set();
    for (let index = 0; index < total - 1; index++) {
      const course = chooseShiritoriCourse(previous, () => (index + .5) / (total - 1));
      assert.notEqual(course, previous);
      seen.add(course);
    }
    assert.equal(seen.size, total - 1);
  }
});

test('enumeration explores branches and excludes dead ends, repetitions and ん', () => {
  const words = ['あい', 'いう', 'いえ', 'うあ', 'えお', 'おん'].map((name, id) => ({ id, name }));
  const paths = buildShiritoriCourses(words, 4).map(course => course.map(word => word.name).join('→')).sort();
  assert.deepEqual(paths, ['いう→うあ→あい→いえ', 'うあ→あい→いえ→えお']);
});
