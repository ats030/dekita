import { GameBase } from '../core/GameBase.js';
import { SOUNDS, SOUND_QUESTION } from '../data/SoundData.js';

export class AnimalGame extends GameBase {
  constructor(gameState, audio, screen) {
    super(gameState, audio, screen);
    this.feedbackScreenId = 'animal-game-screen';
  }

  init(rootElement) {
    this.root = rootElement;
    this.registerEventListeners();
    this.state.gameMode = 'animal';
    this.audio.init();
    this.audio.setInterAudioDelay(100);
  }

  registerEventListeners() {
    const startBtn = this.root.getElementById('animal-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        console.log('[AnimalGame] Start button clicked');
        this.audio.init();
        console.log('[AnimalGame] audioContext state:', this.audio.audioContext.state);
        this.audio.playPopSound();
        console.log('[AnimalGame] Playing start sound');
        this.start();
      });
    } else {
      console.error('[AnimalGame] animal-start-btn not found!');
    }

    const resetBtn = this.root.getElementById('animal-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetGame();
      });
    }

    const nextBtn = this.root.getElementById('animal-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.nextQuestion();
      });
    }
  }

  start() {
    super.start();
    this.state.questionsTotal = 8;
    this.screen.showAnimalGame();
    this.updateScore();
    this.generateQuestion();
  }

  generateQuestion() {
    this.updateProgress();
    this.hideFeedback();
    if (this.state.isGameOver()) {
      this.endGame();
      return;
    }

    const animals = SOUNDS;

    const correct = animals[Math.floor(Math.random() * animals.length)];
    const incorrect = animals.filter(a => a !== correct);

    const pictureArea = this.root.getElementById('animal-picture-area');
    pictureArea.innerHTML = '';
    
    const soundIcon = document.createElement('button');
    soundIcon.className = 'sound-icon';
    soundIcon.textContent = '🔊';
    soundIcon.type = 'button';
    soundIcon.setAttribute('aria-label', 'もういちど きく');
    soundIcon.onclick = () => this.replaySound(correct.sound);
    pictureArea.appendChild(soundIcon);

    this.audio.init();
    this.audio.setInterAudioDelay(100);
    this.audio.playSequence([SOUND_QUESTION, correct.sound]);

    const questionText = this.root.getElementById('animal-question-text');
    questionText.textContent = SOUND_QUESTION;

    const answerButtons = this.root.getElementById('animal-answer-buttons');
    answerButtons.innerHTML = '';

    const options = [correct, ...incorrect.sort(() => Math.random() - 0.5).slice(0, 3)];
    options.sort(() => Math.random() - 0.5);

    options.forEach(animal => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      const emoji = document.createElement('span');
      emoji.className = 'animal-emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = animal.emoji;
      const name = document.createElement('span');
      name.className = 'animal-name';
      name.textContent = animal.name;
      btn.setAttribute('aria-label', animal.name);
      btn.onclick = () => this.checkAnswer(animal, correct);
      btn.append(emoji, name);
      answerButtons.appendChild(btn);
    });
  }

  checkAnswer(selected, correct) {
    if (this.state.isAnswering) return;
    this.state.isAnswering = true;
    this.audio.stop();
    
    if (selected === correct) {
      this.state.addScore(10);
      super.playCorrectFeedback();
    } else {
      super.playWrongFeedback();
    }

    super.updateScore();

    // 不正解の声(約3.1秒)が次の問題の声と重ならないよう、言い終わるまで待つ
    setTimeout(() => {
      this.state.isAnswering = false;
      this.nextQuestion();
    }, (selected === correct) ? 2000 : 3300);
  }

  nextQuestion() {
    this.state.incrementQuestionsAnswered();
    super.updateScore();
    if (this.root) {
      this.hideFeedback();
    }

    if (this.state.isGameOver()) {
      this.endGame();
    } else {
      this.audio.init();
      this.audio.setInterAudioDelay(100);
      this.generateQuestion();
    }
  }

  endGame() {
    super.endGame();
    this.state.saveScore();
    this.audio.playSequence(['ぜんぶ できたね！']);
  }

  resetGame() {
    this.screen.showTitle();
  }

  replaySound(soundText) {
    this.audio.init();
    this.audio.setInterAudioDelay(100);
    this.audio.playSequence([SOUND_QUESTION, soundText]);
  }

  cleanup() {
    this.state.isAnswering = false;
  }
}
