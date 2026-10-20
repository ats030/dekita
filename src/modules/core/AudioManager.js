/* 
 * dekita - Preschool Edition Audio Manager
 */

import { SHIRITORI_AUDIO } from '../data/ShiritoriWords.js';
import { SOUND_AUDIO } from '../data/SoundData.js';
import { MOJI_AUDIO } from '../data/MojiData.js';

export class AudioManager {
  constructor() {
    this.enabled = true;
    this.volume = 1.0;
    this.audioContext = null;
    this.state = null;
    this.interAudioDelay = 300;
    this.isPlaying = false;
    this.playbackQueue = [];
    this.currentAudio = null;
    this.sequenceId = 0;
    this.singleSounds = new Set();
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume audioContext if it's suspended (browser policy requirement)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  setGameState(state) {
    this.state = state;
  }

  getAudioFilePath(text) {
    const audioMap = {
      'ぶろっくを うごかして わくに はめよう': 'audio/block-instruction.mp3',
      ...Object.fromEntries(SHIRITORI_AUDIO.map(({ text, filename }) => [text, `audio/${filename}`])),
      ...Object.fromEntries(SOUND_AUDIO.map(({ text, filename }) => [text, `audio/${filename}`])),
      ...Object.fromEntries(MOJI_AUDIO.map(({ text, filename }) => [text, `audio/${filename}`])),
      'いくつあるかな？': 'audio/count-question.mp3',
      'ワンワン！': 'audio/dog-sound.mp3',
      'ニャー！': 'audio/cat-sound.mp3',
      'モー！': 'audio/cow-sound.mp3',
      'ブヒブヒ！': 'audio/pig-sound.mp3',
      'ピーピー！': 'audio/bird-sound.mp3',
      'ガオー！': 'audio/lion-sound.mp3',
      'パオーン！': 'audio/elephant-sound.mp3',
      'ウキキ！': 'audio/monkey-sound.mp3',
      'やったー！': 'audio/correct.mp3',
      'だいじょうぶ！つぎも やってみよう！': 'audio/wrong.mp3',
      'おしい！もういっかい やってみよう！': 'audio/retry.mp3',
      'いいえ': 'audio/incorrect.mp3',
      'ぜんぶ できたね！': 'audio/game-over.mp3',
      'せいかい!': 'audio/correct-feedback.mp3',
      'これは なにいろかな？': 'audio/color-question.mp3',
      'ペアを見つけてね': 'audio/match-instruction.mp3',
      'はちさんが おはなまで いけるかな?': 'audio/maze-hachi.mp3',
      'うさぎさんが にんじんまで いけるかな?': 'audio/maze-usagi.mp3',
      'ねこさんが おさかなまで いけるかな?': 'audio/maze-neko.mp3',
      'さるさんが バナナまで いけるかな?': 'audio/maze-saru.mp3',
      '10てん！': 'audio/maze-win10.mp3',
      'おなじ かたちを タッチしてね': 'audio/puzzle-instruction.mp3'
    };
    return audioMap[text] || null;
  }

  speak(text) {
    if (!this.enabled) return;
    
    // Map text to audio file path
    const audioFile = this.getAudioFilePath(text);
    if (!audioFile) {
      console.warn('[AudioManager] No audio file for text:', text);
      return;
    }
    
    // Resume audioContext if it's suspended (browser policy requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Play audio file
    const audio = new Audio(audioFile);
    audio.volume = this.volume;
    this.trackSingleSound(audio);
    audio.play().catch(err => {
      this.singleSounds.delete(audio);
      console.error('[AudioManager] Failed to play audio:', audioFile, 'error:', err);
    });
  }

  playPopSound() {
    if (!this.enabled) return;
    
    // Resume audioContext if it's suspended (browser policy requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Play pop sound using audio file
    const audio = new Audio('audio/pop.mp3');
    audio.volume = this.volume;
    this.trackSingleSound(audio);
    audio.play().catch(err => {
      this.singleSounds.delete(audio);
      console.error('[AudioManager] Failed to play pop sound:', err);
    });
  }

  playCorrectSound() {
    if (!this.enabled) return;
    
    // Resume audioContext if it's suspended (browser policy requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Play correct sound using audio file
    const audio = new Audio('audio/correct.mp3');
    audio.volume = this.volume;
    this.trackSingleSound(audio);
    audio.play().catch(err => {
      this.singleSounds.delete(audio);
      console.error('[AudioManager] Failed to play correct sound:', err);
    });
  }

  playWrongSound() {
    if (!this.enabled) return;
    
    // Resume audioContext if it's suspended (browser policy requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Play wrong sound using audio file
    const audio = new Audio('audio/wrong.mp3');
    audio.volume = this.volume;
    this.trackSingleSound(audio);
    audio.play().catch(err => {
      this.singleSounds.delete(audio);
      console.error('[AudioManager] Failed to play wrong sound:', err);
    });
  }

  playErrorSound() {
    if (!this.enabled) return;
    
    // Resume audioContext if it's suspended (browser policy requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Play error sound using audio file
    const audio = new Audio('audio/error.mp3');
    audio.volume = this.volume;
    this.trackSingleSound(audio);
    audio.play().catch(err => {
      this.singleSounds.delete(audio);
      console.error('[AudioManager] Failed to play error sound:', err);
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setInterAudioDelay(delay) {
    this.interAudioDelay = delay;
  }

  setVolume(volume) {
    if (volume >= 0 && volume <= 1) {
      this.volume = volume;
    } else {
      console.warn('[AudioManager] Volume must be between 0 and 1');
    }
  }

  playSequence(texts) {
    if (!this.enabled || !texts || texts.length === 0) return;
    
    const queue = texts.map(text => this.getAudioFilePath(text)).filter(path => path !== null);
    
    if (queue.length === 0) return;
    
    // 前の再生キューを止めて、遅れた音声が次の画面で鳴らないようにする
    this.stop();
    this.isPlaying = true;
    // 先に全ファイルを読み込み、次の音声までの間に読み込み待ちが入らないようにする
    const audios = queue.map(path => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = this.volume;
      return audio;
    });
    this.playAudioQueue(audios, 0, this.sequenceId);
  }

  /**
   * playAudioQueue(queue, index, id) - Play audio files in sequence
   * Waits interAudioDelay after each file ends; a newer sequence or stop() cancels the rest
   */
  playAudioQueue(queue, index, id) {
    if (id !== this.sequenceId) return;
    if (index >= queue.length) {
      this.isPlaying = false;
      this.currentAudio = null;
      return;
    }

    const audio = queue[index];
    this.currentAudio = audio;

    const playNext = (delay) => {
      if (id !== this.sequenceId) return;
      this.currentAudio = null;
      setTimeout(() => {
        this.playAudioQueue(queue, index + 1, id);
      }, delay);
    };

    audio.onended = () => playNext(this.interAudioDelay);

    audio.play().catch(err => {
      console.error('[AudioManager] Failed to play audio:', audio.src, err);
      playNext(100);
    });
  }

  saveScore(score) {
    if (score > this.state.highScore) {
      localStorage.setItem('gakushuGameHighScore', score);
    }
  }

  trackSingleSound(audio) {
    this.singleSounds.add(audio);
    const release = () => this.singleSounds.delete(audio);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
  }

  stopAll() {
    this.stop();
    this.singleSounds.forEach(audio => audio.pause());
    this.singleSounds.clear();
  }

  stop() {
    this.sequenceId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
    this.playbackQueue = [];
  }

  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
