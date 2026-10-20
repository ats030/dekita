import { renderProgress } from '../core/Progress.js';
import { GOJUON_ROWS, MOJI_QUESTIONS, chooseMojiWords } from '../data/MojiData.js';

const WRONG_TEXT = 'おしい！もういっかい やってみよう！';
const CORRECT_TEXT = 'やったー！';

export class MojiGame {
  constructor(state, audio, screen) {
    this.state = state;
    this.audio = audio;
    this.screen = screen;
    this.timer = null;
    this.ownsAudio = false;
    this.locked = false;
    this.typed = 0;
  }

  init(root) {
    this.root = root;
    root.getElementById('moji-start-btn').addEventListener('click', () => {
      this.audio.init();
      this.start();
    });
    root.getElementById('moji-reset-btn').addEventListener('click', () => this.screen.showTitle());
    root.getElementById('moji-current').addEventListener('click', () => {
      if (!this.locked) this.speak([this.word.name]);
    });
    this.renderChart();
  }

  start() {
    this.screen.show('moji-game-screen');
    this.state.resetScore();
    this.state.questionsAnswered = 0;
    this.state.questionsTotal = MOJI_QUESTIONS;
    this.state.gameMode = 'moji';
    this.state.isAnswering = false;
    this.course = chooseMojiWords();
    this.showWord();
  }

  speak(texts) {
    this.ownsAudio = true;
    this.audio.setInterAudioDelay(200);
    this.audio.playSequence(texts);
  }

  renderChart() {
    const chart = this.root.getElementById('moji-chart');
    const cells = [];
    for (let column = 0; column < GOJUON_ROWS[0].length; column++) {
      for (const row of GOJUON_ROWS) {
        const char = row[column];
        if (!char) {
          const gap = document.createElement('span');
          gap.className = 'moji-gap';
          cells.push(gap);
          continue;
        }
        const button = document.createElement('button');
        button.className = 'moji-key';
        button.textContent = char;
        button.addEventListener('click', () => this.press(char, button));
        cells.push(button);
      }
    }
    chart.replaceChildren(...cells);
  }

  showWord() {
    this.word = this.course[this.state.questionsAnswered];
    this.typed = 0;
    this.locked = false;
    this.state.isAnswering = false;
    this.root.getElementById('moji-feedback-area').style.display = 'none';
    this.root.getElementById('moji-current-emoji').textContent = this.word.emoji;
    this.root.getElementById('moji-current').setAttribute('aria-label', 'もういちど きく');
    this.renderSlots();
    renderProgress(this.root.getElementById('moji-progress'), this.state.questionsAnswered, MOJI_QUESTIONS);
    this.speak([this.word.name]);
  }

  renderSlots() {
    const chars = [...this.word.name];
    this.root.getElementById('moji-slots').replaceChildren(...chars.map((char, index) => {
      const slot = document.createElement('li');
      const filled = index < this.typed;
      slot.className = filled ? 'moji-slot filled' : 'moji-slot';
      slot.textContent = filled ? char : '';
      return slot;
    }));
  }

  showFeedback(correct, text) {
    const area = this.root.getElementById('moji-feedback-area');
    area.style.display = 'block';
    area.dataset.feedback = correct ? 'correct' : 'wrong';
    this.root.getElementById('moji-feedback-text').textContent = text;
  }

  press(char, button) {
    if (this.locked || this.screen.currentScreen !== 'moji-game-screen') return;
    const chars = [...this.word.name];
    if (char === chars[this.typed]) {
      this.typed++;
      this.renderSlots();
      if (this.typed < chars.length) {
        this.root.getElementById('moji-feedback-area').style.display = 'none';
        this.speak([char]);
        return;
      }
      this.finishWord(char);
      return;
    }
    this.locked = true;
    this.state.isAnswering = true;
    button.classList.add('wrong');
    this.showFeedback(false, WRONG_TEXT);
    this.speak([char, WRONG_TEXT]);
    this.timer = setTimeout(() => {
      this.timer = null;
      button.classList.remove('wrong');
      this.root.getElementById('moji-feedback-area').style.display = 'none';
      this.state.isAnswering = false;
      this.locked = false;
    }, 800);
  }

  finishWord(lastChar) {
    this.locked = true;
    this.state.isAnswering = true;
    this.state.questionsAnswered++;
    this.state.addScore(10);
    renderProgress(this.root.getElementById('moji-progress'), this.state.questionsAnswered, MOJI_QUESTIONS);
    this.showFeedback(true, CORRECT_TEXT);
    this.speak([lastChar, this.word.name, CORRECT_TEXT]);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.state.isAnswering = false;
      if (this.state.questionsAnswered >= MOJI_QUESTIONS) this.endGame();
      else this.showWord();
    }, 2500);
  }

  endGame() {
    this.state.saveScore();
    this.screen.showResult();
    this.speak(['ぜんぶ できたね！']);
  }

  cleanup() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.locked = false;
    if (this.ownsAudio) {
      this.audio.stopAll();
      this.state.isAnswering = false;
      this.ownsAudio = false;
    }
  }
}
