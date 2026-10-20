/** Hand-authored names; complete courses are derived locally without an API. */
export const SHIRITORI_WORDS = [
  ['suika', '🍉', 'すいか'], ['kaba', '🦛', 'かば'],
  ['banana', '🍌', 'ばなな'], ['nasu', '🍆', 'なす'],
  ['sushi', '🍣', 'すし'], ['shika', '🦌', 'しか'],
  ['kame', '🐢', 'かめ'], ['megane', '👓', 'めがね'],
  ['neko', '🐱', 'ねこ'], ['koara', '🐨', 'こあら'],
  ['zou', '🐘', 'ぞう'], ['ushi', '🐄', 'うし'],
  ['shimauma', '🦓', 'しまうま'], ['mame', '🫘', 'まめ'],
  ['me', '👀', 'め'], ['rakko', '🦦', 'らっこ'],
  ['koppu', '🥤', 'こっぷ'], ['kuma', '🐻', 'くま'],
  ['buta', '🐷', 'ぶた'], ['tako', '🐙', 'たこ'],
  ['ichigo', '🍓', 'いちご'], ['momo', '🍑', 'もも'],
  ['saru', '🐵', 'さる'], ['kitsune', '🦊', 'きつね'],
  ['kutsu', '👟', 'くつ'], ['tsuki', '🌙', 'つき'],
  ['kuri', '🌰', 'くり'], ['risu', '🐿️', 'りす'],
  ['kujira', '🐳', 'くじら'], ['ringo', '🍎', 'りんご'],
  ['gorira', '🦍', 'ごりら'], ['rakuda', '🐪', 'らくだ'],
  ['dango', '🍡', 'だんご'], ['tamago', '🥚', 'たまご'],
  ['kuruma', '🚗', 'くるま'], ['tomato', '🍅', 'とまと'],
  ['tokei', '⏰', 'とけい'], ['tora', '🐯', 'とら'],
  ['isu', '🪑', 'いす'], ['inu', '🐶', 'いぬ'],
  ['nuigurumi', '🧸', 'ぬいぐるみ'], ['mimi', '👂', 'みみ'],
  ['mitsubachi', '🐝', 'みつばち'], ['chou', '🦋', 'ちょう'],
  ['uma', '🐴', 'うま'], ['koori', '🧊', 'こおり'],
  ['kani', '🦀', 'かに'], ['niwatori', '🐔', 'にわとり'],
].map(([id, emoji, name]) => Object.freeze({ id, emoji, name }));

/** Enumerate only complete, non-repeating paths, including every valid branch. */
export function buildShiritoriCourses(words, length = 10) {
  const byHead = new Map();
  for (const word of words) {
    if (lastSound(word) === 'ん') continue;
    const head = word.name[0];
    if (!byHead.has(head)) byHead.set(head, []);
    byHead.get(head).push(word);
  }
  const courses = [];
  const path = [];
  const used = new Set();
  function visit(word) {
    if (used.has(word.id)) return;
    path.push(word);
    used.add(word.id);
    if (path.length === length) {
      courses.push(Object.freeze([...path]));
    } else {
      for (const next of byHead.get(lastSound(word)) || []) visit(next);
    }
    used.delete(word.id);
    path.pop();
  }
  for (const word of words) if (lastSound(word) !== 'ん') visit(word);
  return Object.freeze(courses);
}

export function lastSound(word) { return word.name.at(-1); }
export const SHIRITORI_COURSES = buildShiritoriCourses(SHIRITORI_WORDS);

/** Uniform choice among all courses except the immediately preceding one. */
export function chooseShiritoriCourse(previous, random = Math.random) {
  const previousIndex = SHIRITORI_COURSES.indexOf(previous);
  const skipPrevious = previousIndex !== -1 && SHIRITORI_COURSES.length > 1;
  let index = Math.floor(random() * (SHIRITORI_COURSES.length - Number(skipPrevious)));
  if (skipPrevious && index >= previousIndex) index++;
  return SHIRITORI_COURSES[index];
}

export const SHIRITORI_INSTRUCTION = 'さいごの おとで つなげよう';
export const SHIRITORI_CORRECT = 'つながった！';
export const soundPrompt = sound => `${sound}から はじまるのは？`;

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shiritoriChoices(course, index, random = Math.random) {
  const correct = course[index];
  const sound = lastSound(course[index - 1]);
  const used = new Set(course.slice(0, index).map(word => word.id));
  const wrong = SHIRITORI_WORDS.filter(word => !used.has(word.id)
    && word.name[0] !== sound && lastSound(word) !== 'ん');
  return shuffled([correct, ...shuffled(wrong, random).slice(0, 3)], random);
}

// Shared by browser playback and the build-time VOICEVOX generator.
const sounds = [...new Set(SHIRITORI_COURSES.flatMap(course => course.slice(0, -1).map(lastSound)))];
export const SHIRITORI_AUDIO = [
  ...SHIRITORI_WORDS.map(word => ({ filename: `shiritori-word-${word.id}.mp3`, text: word.name })),
  ...sounds.map(sound => ({ filename: `shiritori-sound-${sound.codePointAt(0)}.mp3`, text: soundPrompt(sound) })),
  { filename: 'shiritori-instruction.mp3', text: SHIRITORI_INSTRUCTION },
  { filename: 'shiritori-correct.mp3', text: SHIRITORI_CORRECT },
];
