/** "おと" game: every emoji has a sound to match; animals first, then everyday things. */
export const SOUND_QUESTION = 'なんの おとかな？';

export const SOUNDS = [
  { name: 'いぬ', emoji: '🐶', sound: 'ワンワン！' },
  { name: 'ねこ', emoji: '🐱', sound: 'ニャー！' },
  { name: 'うし', emoji: '🐮', sound: 'モー！' },
  { name: 'ぶた', emoji: '🐷', sound: 'ブヒブヒ！' },
  { name: 'とり', emoji: '🐦', sound: 'ピーピー！' },
  { name: 'らいおん', emoji: '🦁', sound: 'ガオー！' },
  { name: 'ぞう', emoji: '🐘', sound: 'パオーン！' },
  { name: 'さる', emoji: '🐒', sound: 'ウキキ！' },
  { name: 'かえる', emoji: '🐸', sound: 'ゲロゲロ！', filename: 'sound-frog.mp3' },
  { name: 'にわとり', emoji: '🐔', sound: 'コケコッコー！', filename: 'sound-chicken.mp3' },
  { name: 'くるま', emoji: '🚗', sound: 'ブーブー！', filename: 'sound-car.mp3' },
  { name: 'でんしゃ', emoji: '🚃', sound: 'ガタンゴトン！', filename: 'sound-train.mp3' },
  { name: 'きゅうきゅうしゃ', emoji: '🚑', sound: 'ピーポーピーポー！', filename: 'sound-ambulance.mp3' },
  { name: 'ベル', emoji: '🔔', sound: 'リンリン！', filename: 'sound-bell.mp3' },
  { name: 'たいこ', emoji: '🥁', sound: 'ドンドン！', filename: 'sound-drum.mp3' },
  { name: 'ピアノ', emoji: '🎹', sound: 'ポロロン！', filename: 'sound-piano.mp3' },
];

// Voice lines generated at build time (the first eight animals already ship).
export const SOUND_AUDIO = [
  { filename: 'sound-question.mp3', text: SOUND_QUESTION },
  ...SOUNDS.filter(item => item.filename).map(({ filename, sound }) => ({ filename, text: sound })),
];
