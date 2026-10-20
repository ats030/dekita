/* 
 * dekita - Preschool Edition Game Base
 * Base class for game modules
 */

import { renderProgress } from './Progress.js';

export class GameBase {
  constructor(state, audioManager, screenManager) {
    this.state = state;
    this.audio = audioManager;
    this.screen = screenManager;
    this.root = null;
    this.feedbackScreenId = 'game-screen';
  }

  init(rootElement) {
    this.root = rootElement;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }
  }

  start() {
    this.state.resetScore();
    this.state.resetQuestionsAnswered();
    this.updateScore();
  }

  endGame() {
    this.screen.showResult();
  }

  updateScore() {
    this.updateProgress();
  }

  updateProgress() {
    const root = this.root || document;
    const element = root.getElementById(this.feedbackScreenId)?.querySelector('.progress-dots');
    renderProgress(element, this.state.questionsAnswered + (this.state.isAnswering ? 1 : 0), this.state.questionsTotal);
  }

  getFeedbackElements() {
    const root = this.root || document;
    const screen = root.getElementById(this.feedbackScreenId);
    return {
      area: screen?.querySelector('.feedback-area'),
      text: screen?.querySelector('.feedback-text'),
    };
  }

  playCorrectFeedback() {
    const { area, text } = this.getFeedbackElements();
    if (area && text) {
      area.classList.remove('hidden');
      area.style.display = 'block';
      area.dataset.feedback = 'correct';
      text.textContent = 'やったー！';
      this.audio.speak('やったー！');
      this.audio.playPopSound();
    }
  }

  playWrongFeedback() {
    const { area, text } = this.getFeedbackElements();
    if (area && text) {
      area.classList.remove('hidden');
      area.style.display = 'block';
      area.dataset.feedback = 'wrong';
      text.textContent = 'だいじょうぶ！つぎも やってみよう！';
      this.audio.playSequence(['だいじょうぶ！つぎも やってみよう！']);
    }
  }

  hideFeedback() {
    const { area } = this.getFeedbackElements();
    if (area) area.style.display = 'none';
  }

  cleanup() {
    // 空実装 - 各ゲームモジュールで必要に応じてオーバーライド
  }
}
