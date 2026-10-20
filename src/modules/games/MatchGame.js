/**
 * dekita - Preschool Edition Match Game Module
 * Memory card matching game (grid layout)
 */

import { renderProgress } from '../core/Progress.js';
import { GameBase } from '../core/GameBase.js';

export class MatchGame extends GameBase {
  constructor(gameState, audio, screen) {
    super(gameState, audio, screen);
    this.gridSize = 4;
    this.emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
    this.grid = [];
    this.score = 0;
    this.moves = 0;
    this.matchesFound = 0;
    this.maxMatches = Math.floor((this.gridSize * this.gridSize) / 2);
    this.selectedCells = [];
    this.matchedIndices = new Set();
    this.gameOver = false;
    this.mismatchTimer = null;
    this.ownsAudio = false;
  }

  init(rootElement) {
    this.root = rootElement;
    this.registerEventListeners();
  }

  registerEventListeners() {
    const matchStartBtn = this.root.getElementById('match-start-btn');
    if (matchStartBtn) {
      matchStartBtn.addEventListener('click', () => {
        this.audio.init();
        this.audio.playPopSound();
        this.start();
      });
    }

    const matchResetBtn = this.root.getElementById('match-reset-btn');
    if (matchResetBtn) {
      matchResetBtn.addEventListener('click', () => {
        this.resetGame();
      });
    }

    const matchNextBtn = this.root.getElementById('match-next-btn');
    if (matchNextBtn) {
      matchNextBtn.addEventListener('click', () => {
        this.audio.playPopSound();
        this.nextRound();
      });
    }
  }

  start() {
    this.score = 0;
    this.moves = 0;
    this.matchesFound = 0;
    this.maxMatches = Math.floor((this.gridSize * this.gridSize) / 2);
    this.selectedCells = [];
    this.matchedIndices = new Set();
    this.gameOver = false;
    
    this.screen.showMatchGame();
    this.initGrid();
    this.ownsAudio = true;
    this.audio.playSequence(['ペアを見つけてね']);
    this.updateScore();
  }

  initGrid() {
    const totalCells = this.gridSize * this.gridSize;
    const pairsNeeded = totalCells / 2;
    let cellValues = [];

    // Create pairs
    for (let i = 0; i < pairsNeeded; i++) {
      const emoji = this.emojis[i % this.emojis.length];
      cellValues.push(emoji, emoji);
    }

    // Shuffle
    for (let i = cellValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cellValues[i], cellValues[j]] = [cellValues[j], cellValues[i]];
    }

    // Build 2D grid
    this.grid = [];
    for (let y = 0; y < this.gridSize; y++) {
      const row = [];
      for (let x = 0; x < this.gridSize; x++) {
        row.push({
          x,
          y,
          value: cellValues[y * this.gridSize + x],
          revealed: false,
          matched: false
        });
      }
      this.grid.push(row);
    }

    this.renderGrid();
  }

  renderGrid() {
    const gridArea = this.root.getElementById('match-grid');
    if (!gridArea) return;

    gridArea.innerHTML = '';

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cell = this.grid[y][x];
        const card = document.createElement('button');
        card.className = 'match-card';
        card.dataset.x = x;
        card.dataset.y = y;
         card.textContent = '💭';
        
        card.addEventListener('click', () => this.handleCardClick(x, y));
        gridArea.appendChild(card);
      }
    }
  }

  handleCardClick(x, y) {
    if (this.gameOver || this.selectedCells.length >= 2) return;
    
    const cell = this.grid[y][x];
    if (cell.matched || cell.revealed) return;
    
    cell.revealed = true;
    const cardBtn = this.getCardButton(x, y);
    if (cardBtn) {
      cardBtn.textContent = cell.value;
      cardBtn.classList.add('revealed');
    }
    
    this.selectedCells.push(cell);
    
    if (this.selectedCells.length === 2) {
      this.moves++;
      this.checkMatch();
    }
  }

  getCardButton(x, y) {
    return this.root.querySelector(`.match-card[data-x="${x}"][data-y="${y}"]`);
  }

  checkMatch() {
    const [cell1, cell2] = this.selectedCells;
    const isMatch = cell1.value === cell2.value;

    if (isMatch) {
      cell1.matched = true;
      cell2.matched = true;
      this.matchedIndices.add(cell1.y * this.gridSize + cell1.x);
      this.matchedIndices.add(cell2.y * this.gridSize + cell2.x);
      this.score += 10;
      this.matchesFound++;
      this.selectedCells = [];
      
      // Update card UI
      const btn1 = this.getCardButton(cell1.x, cell1.y);
      const btn2 = this.getCardButton(cell2.x, cell2.y);
      if (btn1) {
        btn1.classList.add('matched');
      }
      if (btn2) {
        btn2.classList.add('matched');
      }
      
      this.updateScore();
      
      if (this.matchesFound >= this.maxMatches) {
        this.endGame();
      } else {
        this.audio.playSequence(['やったー！']);
      }
    } else {
      this.audio.playSequence(['おしい！もういっかい やってみよう！']);
      this.mismatchTimer = setTimeout(() => {
        this.mismatchTimer = null;
        cell1.revealed = false;
        cell2.revealed = false;
        const btn1 = this.getCardButton(cell1.x, cell1.y);
        const btn2 = this.getCardButton(cell2.x, cell2.y);
        if (btn1) {
            btn1.textContent = '💭';
          btn1.classList.remove('revealed');
        }
        if (btn2) {
            btn2.textContent = '💭';
          btn2.classList.remove('revealed');
        }
        this.selectedCells = [];
      }, 800);
    }
  }

  updateScore() {
    renderProgress(this.root?.getElementById('match-progress-text'), this.matchesFound, this.maxMatches);
  }

  nextRound() {
    this.screen.showTitle();
  }

  resetGame() {
    this.screen.showTitle();
  }

  endGame() {
    super.endGame();
    this.gameOver = true;
    if (this.root) {
      const feedbackArea = this.root.getElementById('match-feedback-area');
      const feedbackText = this.root.getElementById('match-feedback-text');
      if (feedbackArea && feedbackText) {
        feedbackArea.style.display = 'block';
        feedbackText.textContent = 'やったー！';
      }
    }
    this.ownsAudio = true;
    this.audio.playSequence(['ぜんぶ できたね！']);
    this.audio.playPopSound();
  }

  cleanup() {
    if (this.mismatchTimer !== null) {
      clearTimeout(this.mismatchTimer);
      this.mismatchTimer = null;
    }
    if (this.ownsAudio) {
      this.audio.stop();
      this.ownsAudio = false;
    }
    this.selectedCells = [];
    this.matchedIndices = new Set();
    this.gameOver = false;
  }
}
