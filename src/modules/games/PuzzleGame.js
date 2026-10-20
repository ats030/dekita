/**
 * dekita - Preschool Edition Puzzle Game Module
 * For 3-year-olds: tap the silhouette that matches the colorful emoji shown above
 * 3x3 grid; tap works with both finger and mouse
 */

import { renderProgress } from '../core/Progress.js';
import { GameBase } from '../core/GameBase.js';

const PUZZLE_INSTRUCTION = 'おなじ かたちを タッチしてね';

export class PuzzleGame extends GameBase {
  constructor(gameState, audio, screen) {
    super(gameState, audio, screen);
    this.gridSize = 3;
    this.locked = false;
    this.wrongCooldown = false;
    this.nextTimer = null;
    this.score = 0;
    this.moves = 0;
    this.gameOver = false;
    this.theme = null;
    this.silhouettes = [];
    this.correctIndex = 0;
    this.correctEmoji = '';
    this.emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨'];
  }

  init(rootElement) {
    this.root = rootElement;
    this.registerEventListeners();
    this.state.gameMode = 'puzzle';
  }

  registerEventListeners() {
    const puzzleStartBtn = this.root.getElementById('puzzle-start-btn');
    if (puzzleStartBtn) {
      puzzleStartBtn.addEventListener('click', () => {
        this.audio.init();
        this.audio.playPopSound();
        this.start();
      });
    }

    const puzzleResetBtn = this.root.getElementById('puzzle-reset-btn');
    if (puzzleResetBtn) {
      puzzleResetBtn.addEventListener('click', () => {
        this.screen.showTitle();
      });
    }
  }

  start() {
    this.clearTimers();
    super.start();
    this.score = 0;
    this.moves = 0;
    this.gameOver = false;
    this.state.questionsAnswered = 0;
    this.state.questionsTotal = 5;
    this.screen.showPuzzleGame();
    this.generatePuzzle();
    this.audio.setInterAudioDelay(300);
    this.audio.playSequence([PUZZLE_INSTRUCTION]);
  }

  getGridArea() {
    return this.root.getElementById('puzzle-grid');
  }

  generatePuzzle() {
    const themes = [
      { name: 'どうぶつ', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨'] },
      { name: 'くだもの', emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒'] },
      { name: 'のりもの', emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒'] }
    ];

    this.theme = themes[Math.floor(Math.random() * themes.length)];
    const shuffledEmojis = [...this.theme.emojis].sort(() => Math.random() - 0.5);
    this.silhouettes = shuffledEmojis.slice(0, 9);
    this.correctIndex = Math.floor(Math.random() * 9);
    this.correctEmoji = this.silhouettes[this.correctIndex];
    this.locked = false;

    const target = this.root.getElementById('puzzle-drag-emoji');
    if (target) {
      target.textContent = this.correctEmoji;
    }

    this.createGrid();
  }

  createGrid() {
    const gridArea = this.getGridArea();
    if (!gridArea) return;

    gridArea.innerHTML = '';

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'puzzle-silhouette';
      slot.dataset.index = i;
      slot.dataset.emoji = this.silhouettes[i];
      const shape = document.createElement('span');
      shape.className = 'puzzle-shape';
      shape.textContent = this.silhouettes[i];
      slot.appendChild(shape);
      slot.addEventListener('click', () => this.handleTap(slot));
      gridArea.appendChild(slot);
    }

    this.updateProgress();
  }

  updateProgress() {
    renderProgress(this.root?.getElementById('puzzle-progress-text'),
      this.state.questionsAnswered + (this.locked ? 1 : 0), this.state.questionsTotal);
  }

  handleTap(slot) {
    if (this.locked) return;
    this.moves++;

    if (slot.dataset.emoji === this.correctEmoji) {
      this.checkWin();
    } else {
      // 連打で音が重ならないよう、誤答の合図は 800ms に1回だけ
      if (this.wrongCooldown) return;
      this.wrongCooldown = true;
      setTimeout(() => { this.wrongCooldown = false; }, 800);
      this.audio.playErrorSound();
      // 連続の誤タップでは前の声を止めて言い直し、声が重ならないようにする
      this.audio.playSequence(['おしい！もういっかい やってみよう！']);
      slot.classList.add('wrong');
      setTimeout(() => slot.classList.remove('wrong'), 500);
    }
  }

  checkWin() {
    this.locked = true;
    const gridArea = this.getGridArea();
    if (gridArea && gridArea.children[this.correctIndex]) {
      gridArea.children[this.correctIndex].classList.add('revealed');
    }

    this.state.addScore(20);
    this.updateProgress();
    this.playCorrectFeedback();

    this.nextTimer = setTimeout(() => {
      this.nextTimer = null;
      this.nextQuestion();
    }, 2000);
  }

  playCorrectFeedback() {
    const area = this.root.getElementById('puzzle-feedback-area');
    const text = this.root.getElementById('puzzle-feedback-text');
    if (area && text) {
      text.textContent = 'やったー！';
      text.style.color = '#4CAF50';
      area.style.display = 'block';
    }
    this.audio.init();
    this.audio.speak('やったー！');
    this.audio.playPopSound();
  }

  nextQuestion() {
    this.state.incrementQuestionsAnswered();
    this.root.getElementById('puzzle-feedback-area').style.display = 'none';
    
    if (this.state.isGameOver()) {
      this.endGame();
    } else {
      this.generatePuzzle();
    }
  }

  nextRound() {
    this.screen.showTitle();
  }

  endGame() {
    this.screen.showResult();
    this.audio.playSequence(['ぜんぶ できたね！']);
  }

  clearTimers() {
    if (this.nextTimer) {
      clearTimeout(this.nextTimer);
      this.nextTimer = null;
    }
  }

  cleanup() {
    this.clearTimers();
    this.locked = false;
    this.gameOver = false;
  }
}
