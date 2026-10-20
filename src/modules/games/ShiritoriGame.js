import { renderProgress } from '../core/Progress.js';
import { chooseShiritoriCourse, SHIRITORI_INSTRUCTION, SHIRITORI_CORRECT,
  lastSound, soundPrompt, shiritoriChoices } from '../data/ShiritoriWords.js';

export class ShiritoriGame {
  constructor(state, audio, screen) {
    this.state = state;
    this.audio = audio;
    this.screen = screen;
    this.timer = null;
    this.ownsAudio = false;
    this.locked = false;
    this.chain = [];
  }

  init(root) {
    this.root = root;
    root.getElementById('shiritori-start-btn').addEventListener('click', () => {
      this.audio.init();
      this.start();
    });
    root.getElementById('shiritori-reset-btn').addEventListener('click', () => this.screen.showTitle());
    root.getElementById('shiritori-current').addEventListener('click', () => {
      if (!this.locked) this.playQuestion();
    });
  }

  start() {
    this.screen.show('shiritori-game-screen');
    this.state.resetScore();
    this.state.questionsAnswered = 0;
    this.state.questionsTotal = 9;
    this.state.gameMode = 'shiritori';
    this.state.isAnswering = false;
    this.course = chooseShiritoriCourse(this.course);
    this.chain = [this.course[0]];
    this.showQuestion(true);
  }

  speak(texts) {
    this.ownsAudio = true;
    this.audio.setInterAudioDelay(200);
    this.audio.playSequence(texts);
  }

  playQuestion(includeInstruction = false) {
    const current = this.chain.at(-1);
    this.speak([...(includeInstruction ? [SHIRITORI_INSTRUCTION] : []), current.name, soundPrompt(lastSound(current))]);
  }

  renderChain() {
    const chain = this.root.getElementById('shiritori-chain');
    chain.replaceChildren(...Array.from({ length: 10 }, (_, index) => {
      const item = document.createElement('li');
      const word = this.chain[index];
      item.className = word ? 'chain-item filled' : 'chain-item';
      item.textContent = word ? word.emoji : '·';
      item.setAttribute('aria-label', word ? word.name : 'まだ つながっていないよ');
      return item;
    }));
    renderProgress(this.root.getElementById('shiritori-progress'), this.chain.length, 10);
  }

  showQuestion(first = false) {
    this.locked = false;
    this.state.isAnswering = false;
    this.root.getElementById('shiritori-feedback-area').style.display = 'none';
    this.renderChain();
    const current = this.chain.at(-1);
    this.root.getElementById('shiritori-current-emoji').textContent = current.emoji;
    const name = this.root.getElementById('shiritori-current-name');
    name.replaceChildren(document.createTextNode(current.name.slice(0, -1)));
    const tail = document.createElement('span');
    tail.className = 'shiritori-tail';
    tail.textContent = lastSound(current);
    name.appendChild(tail);
    this.root.getElementById('shiritori-current').setAttribute('aria-label', `${current.name}。もういちど きく`);
    this.root.getElementById('shiritori-prompt').textContent = `「${lastSound(current)}」から はじまるのは？`;
    this.choices = shiritoriChoices(this.course, this.chain.length);
    const area = this.root.getElementById('shiritori-answers');
    area.replaceChildren(...this.choices.map(word => {
      const button = document.createElement('button');
      button.className = 'answer-btn shiritori-answer';
      button.dataset.word = word.id;
      const emoji = document.createElement('span');
      emoji.className = 'animal-emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = word.emoji;
      const label = document.createElement('span');
      label.className = 'animal-name';
      label.textContent = word.name;
      button.append(emoji, label);
      button.addEventListener('click', () => this.answer(word));
      return button;
    }));
    this.playQuestion(first);
  }

  answer(word) {
    if (this.locked || this.screen.currentScreen !== 'shiritori-game-screen') return;
    this.locked = true;
    this.state.isAnswering = true;
    const correct = word.id === this.course[this.chain.length].id;
    const area = this.root.getElementById('shiritori-feedback-area');
    const text = this.root.getElementById('shiritori-feedback-text');
    area.style.display = 'block';
    area.dataset.feedback = correct ? 'correct' : 'wrong';
    text.textContent = correct ? SHIRITORI_CORRECT : 'おしい！もういっかい やってみよう！';
    if (correct) {
      this.chain.push(word);
      this.state.questionsAnswered++;
      this.state.addScore(10);
      this.renderChain();
      this.speak([word.name, SHIRITORI_CORRECT]);
    } else {
      this.speak([word.name, 'おしい！もういっかい やってみよう！']);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.state.isAnswering = false;
      if (!correct) {
        this.locked = false;
      } else if (this.chain.length === 10) {
        this.endGame();
      } else {
        this.showQuestion();
      }
    }, correct ? 3000 : 800);
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
