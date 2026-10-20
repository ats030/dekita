/**
 * dekita - Preschool Edition Count Game Module
 * For 3-year-olds: visual learning, no reading required
 */

import { GameBase } from '../core/GameBase.js';
import { createPictureLayout } from '../utils/pictureLayout.js';

export class CountGame extends GameBase {
  constructor(gameState, audio, screen) {
    super(gameState, audio, screen);
  }

  init(rootElement) {
    super.init(rootElement);
    this.registerEventListeners();
    this.state.gameMode = 'number';
    this.pictureResizeObserver = new ResizeObserver(() => this.layoutPictures());
    this.pictureResizeObserver.observe(this.root.getElementById('picture-area'));
    this.updateScore();
  }

  registerEventListeners() {
    const startBtn = this.root.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.audio.init();
        this.audio.setInterAudioDelay(300);
        this.audio.playPopSound();
        this.start();
      });
    } else {
      console.error('start-btn not found!');
    }

    const resetBtn = this.root.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetGame();
      });
    }
  }

  start() {
    this.state.questionsTotal = 10;
    super.start();
    this.state.gameMode = 'number';
    this.screen.showGame();
    this.generateQuestion();
  }

  renderNumberGrid() {
    const grid = this.root.getElementById('number-grid');
    if (grid) {
      grid.innerHTML = '';
      for (let i = 1; i <= this.state.maxNumber; i++) {
        const btn = document.createElement('button');
        btn.className = 'number-btn';
        btn.textContent = i;
        btn.addEventListener('click', () => {
          this.audio.playPopSound();
          this.state.currentNumber = i;
          this.startGameWithNumber(i);
        });
        grid.appendChild(btn);
      }
    }
  }

  startGameWithNumber(number) {
    this.state.currentNumber = number;
    this.screen.showGame();
    this.generateQuestionForNumber(number);
  }

  generateQuestionForNumber(number) {
    if (this.state.isGameOver()) {
      this.endGame();
      return;
    }

    const emoji = this.getRandomPicture();
    this.state.currentAnswer = number;

    this.state.currentQuestion = { emoji, emojiCount: number };
    this.renderQuestion(emoji, number);
  }

  getRandomPicture() {
    const pictures = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑'];
    return pictures[Math.floor(Math.random() * pictures.length)];
  }

  renderQuestion(emoji, emojiCount) {
    const pictureArea = this.root.getElementById('picture-area');
    const answerButtons = this.root.getElementById('answer-buttons');
    const questionText = this.root.getElementById('question-text');

    answerButtons.innerHTML = '';
    pictureArea.innerHTML = '';

    // エモジと問題文を表示
    questionText.textContent = 'いくつあるかな？';
    for (let i = 0; i < emojiCount; i++) {
      const span = document.createElement('span');
      span.className = 'picture-item';
      span.textContent = emoji;
      pictureArea.appendChild(span);
    }

    this.layoutPictures(true);

    const answers = this.generateAnswers(emojiCount);
    answers.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = a;
      btn.onclick = () => this.checkAnswer(a);
      answerButtons.appendChild(btn);
    });

    this.audio.speak('いくつあるかな？');
  }

  layoutPictures(newQuestion = false) {
    const area = this.root.getElementById('picture-area');
    const { width, height } = area.getBoundingClientRect();
    if (!width || !height || !area.children.length) return;
    if (!newQuestion && this.pictureWidth === width && this.pictureHeight === height) return;
    this.pictureWidth = width;
    this.pictureHeight = height;
    const preferredSize = parseFloat(getComputedStyle(area).fontSize) * 1.25;
    const { size, positions } = createPictureLayout(area.children.length, width, height, preferredSize);
    area.style.setProperty('--picture-size', `${size}px`);
    [...area.children].forEach((item, index) => {
      item.style.left = `${positions[index].x}px`;
      item.style.top = `${positions[index].y}px`;
    });
  }

  generateAnswers(correct) {
    const answers = [correct];
    const choices = Math.min(4, this.state.maxNumber);
    while (answers.length < choices) {
      const wrong = Math.floor(Math.random() * this.state.maxNumber) + 1;
      if (!answers.includes(wrong)) {
        answers.push(wrong);
      }
    }
    answers.sort(() => Math.random() - 0.5);
    return answers.slice(0, 4);
  }

  checkAnswer(selected) {
    const correct = this.state.currentAnswer;

    if (this.state.isAnswering) return;
    this.state.isAnswering = true;

    if (correct === selected) {
      this.state.addScore(10);
      this.playCorrectFeedback();
    } else {
      this.playWrongFeedback();
    }

    this.updateScore();

    // 不正解の声(約3.1秒)が次の問題の声と重ならないよう、言い終わるまで待つ
    setTimeout(() => {
      this.state.isAnswering = false;
      this.nextQuestion();
    }, (correct === selected) ? 2000 : 3300);
  }

  nextQuestion() {
    this.state.incrementQuestionsAnswered();
    super.updateScore();
    super.updateProgress();
    if (this.root) {
      this.hideFeedback();
    }

    if (this.state.isGameOver()) {
      this.endGame();
    } else {
      this.audio.init();
      this.audio.setInterAudioDelay(300);
      this.generateQuestion();
    }
  }

  generateQuestion() {
    this.updateProgress();
    this.hideFeedback();
    if (this.state.isGameOver()) {
      this.endGame();
      return;
    }

    const emoji = this.getRandomPicture();
    const emojiCount = Math.floor(Math.random() * this.state.maxNumber) + 1;
    this.state.currentAnswer = emojiCount;
    this.state.currentQuestion = { emoji, emojiCount };
    this.renderQuestion(emoji, emojiCount);
  }

  endGame() {
    super.endGame();
    this.state.saveScore();
    this.audio.playSequence(['ぜんぶ できたね！']);
  }

  resetGame() {
    this.screen.showTitle();
  }

  cleanup() {
    this.state.isAnswering = false;
  }
}
