/** Branching maze: the player follows narrow roads even if a finger drifts. */
import { renderProgress } from '../core/Progress.js';
import { PathGenerator, followRoad, canTravel } from '../utils/maze/PathGenerator.js';

export class MazeGame {
  constructor(gameState, audio, screen) {
    this.state = gameState;
    this.audio = audio;
    this.screen = screen;
    this.pathGenerator = new PathGenerator();
    this.maze = null;
    this.isDragging = false;
    this.pointerId = null;
    this.lastPointerPoint = null;
    this.nextTimer = null;
  }

  setTestMode(enabled) {
    this.state._testMode = enabled;
  }

  cleanup() {
    this.clearNextTimer();
    this.stopDragging();
  }

  clearNextTimer() {
    if (this.nextTimer !== null) {
      clearTimeout(this.nextTimer);
      this.nextTimer = null;
    }
  }

  init(rootElement) {
    this.root = rootElement;
    this.registerEventListeners();
    this.initMazeEvents();
    this.state.gameMode = 'maze';
  }

  registerEventListeners() {
    this.root.getElementById('maze-start-btn').addEventListener('click', () => {
      this.audio.init();
      this.audio.playPopSound();
      this.startMazeGame(0);
    });
    this.root.getElementById('maze-reset-btn').addEventListener('click', () => this.resetGame());
    this.root.getElementById('maze-next-btn').addEventListener('click', () => this.nextTurn());
  }

  startMazeGame(themeIndex) {
    const themes = [
      { start: '🐝', end: '🌸', text: 'はちさんが おはなまで いけるかな?' },
      { start: '🐰', end: '🥕', text: 'うさぎさんが にんじんまで いけるかな?' },
      { start: '🐱', end: '🐟', text: 'ねこさんが おさかなまで いけるかな?' },
      { start: '🐵', end: '🍌', text: 'さるさんが バナナまで いけるかな?' },
    ];
    this.state.mazeCurrentTheme = themes[themeIndex] || themes[0];
    this.state.themeEmojiStart = this.state.mazeCurrentTheme.start;
    this.state.themeEmojiEnd = this.state.mazeCurrentTheme.end;
    this.screen.showMazeGame();
    this.state.gameMode = 'maze';
    this.state.questionsAnswered = 0;
    this.state.questionsTotal = 5;
    this.state.score = 0;
    this.beginRound();
  }

  beginRound() {
    this.clearNextTimer();
    this.stopDragging();
    this.state.isAnswering = false;
    this.state.mazeActive = true;
    this.root.getElementById('maze-feedback-area').style.display = 'none';
    const canvas = this.root.getElementById('maze-canvas');
    canvas.width = 600;
    canvas.height = 600;
    this.maze = this.pathGenerator.generate(canvas.width, canvas.height);
    // Keep the solution as derived data for existing diagnostics, never draw it.
    this.state.mazePath = this.maze.path;
    this.state.mazePlayer = { ...this.maze.player };
    this.state.mazeGoal = { ...this.maze.goal };
    this.drawMaze();
    this.updateScore();
    this.audio.playSequence([this.state.mazeCurrentTheme.text]);
  }

  drawMaze() {
    if (!this.maze) return;
    const canvas = this.root.getElementById('maze-canvas');
    const ctx = canvas.getContext('2d');
    const tokens = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = tokens.getPropertyValue('--color-surface').trim();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (const { start, end } of this.maze.passages) {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const roadWidth = Math.min(this.maze.cellWidth, this.maze.cellHeight) * .3;
    ctx.lineWidth = roadWidth + 4;
    ctx.strokeStyle = tokens.getPropertyValue('--color-blue').trim();
    ctx.stroke();
    ctx.lineWidth = roadWidth;
    ctx.strokeStyle = tokens.getPropertyValue('--color-focus').trim();
    ctx.stroke();
    ctx.font = `${Math.round(Math.min(this.maze.cellWidth, this.maze.cellHeight) * .75)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.state.themeEmojiEnd, this.state.mazeGoal.x, this.state.mazeGoal.y);
    ctx.fillText(this.state.themeEmojiStart, this.state.mazePlayer.x, this.state.mazePlayer.y);
  }

  resetGame() {
    this.screen.showTitle();
  }

  nextTurn() {
    if (this.screen.currentScreen !== 'maze-play-screen' || this.state.mazeActive) return;
    this.clearNextTimer();
    this.state.questionsAnswered++;
    if (this.state.questionsAnswered >= this.state.questionsTotal) this.endGame();
    else this.beginRound();
  }

  updateScore() {
    renderProgress(this.root.getElementById('maze-progress-text'),
      this.state.questionsAnswered + (this.state.mazeActive ? 0 : 1), this.state.questionsTotal);
  }

  pointerPoint(event) {
    const canvas = this.root.getElementById('maze-canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - canvas.clientLeft) * canvas.width / (rect.width - canvas.clientLeft * 2),
      y: (event.clientY - rect.top - canvas.clientTop) * canvas.height / (rect.height - canvas.clientTop * 2),
    };
  }

  stopDragging() {
    const canvas = this.root?.getElementById('maze-canvas');
    const pointerId = this.pointerId;
    this.pointerId = null;
    this.isDragging = false;
    this.lastPointerPoint = null;
    if (pointerId !== null && canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  initMazeEvents() {
    const canvas = this.root.getElementById('maze-canvas');
    canvas.addEventListener('pointerdown', event => {
      if (!this.state.mazeActive || this.state.isAnswering || !event.isPrimary || event.button !== 0 || this.pointerId !== null) return;
      const point = this.pointerPoint(event);
      const player = this.state.mazePlayer;
      const pickupRadius = Math.min(this.maze.cellWidth, this.maze.cellHeight) * .55;
      if (Math.hypot(point.x - player.x, point.y - player.y) > pickupRadius) return;
      event.preventDefault();
      this.pointerId = event.pointerId;
      this.isDragging = true;
      this.lastPointerPoint = point;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!this.isDragging || event.pointerId !== this.pointerId) return;
      event.preventDefault();
      const point = this.pointerPoint(event);
      this.dragPlayer(point.x, point.y);
    });
    canvas.addEventListener('pointerup', event => {
      if (!this.isDragging || event.pointerId !== this.pointerId) return;
      event.preventDefault();
      const point = this.pointerPoint(event);
      this.releasePlayer(point.x, point.y);
      this.stopDragging();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, event => {
        if (event.pointerId === this.pointerId) this.stopDragging();
      });
    }
  }

  movePlayerTo(x, y, finish = true) {
    if (!this.state.mazeActive || this.state.isAnswering || !this.maze || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const next = followRoad(this.maze, this.state.mazePlayer, { x, y });
    if (!canTravel(this.maze, this.state.mazePlayer, next)) return;
    this.state.mazePlayer = next;
    const goal = this.state.mazeGoal;
    const radius = Math.min(this.maze.cellWidth, this.maze.cellHeight) * .2;
    if (finish && Math.hypot(this.state.mazePlayer.x - goal.x, this.state.mazePlayer.y - goal.y) < radius) {
      this.winMaze(this.state.mazePlayer.x, this.state.mazePlayer.y);
    }
  }

  dragPlayer(x, y) {
    if (!this.state.mazeActive || this.state.isAnswering) return;
    const previous = this.lastPointerPoint || this.state.mazePlayer;
    const distance = Math.hypot(x - previous.x, y - previous.y);
    const steps = Math.max(1, Math.min(128, Math.ceil(distance / (Math.min(this.maze.cellWidth, this.maze.cellHeight) * .2))));
    for (let step = 1; step <= steps; step++) {
      this.movePlayerTo(previous.x + (x - previous.x) * step / steps, previous.y + (y - previous.y) * step / steps, false);
    }
    this.lastPointerPoint = { x, y };
    this.drawMaze();
  }

  releasePlayer(x, y) {
    this.dragPlayer(x, y);
    this.movePlayerTo(x, y, true);
  }

  failMaze() {
    this.stopDragging();
    this.state.mazeActive = false;
    const area = this.root.getElementById('maze-feedback-area');
    const text = this.root.getElementById('maze-feedback-text');
    area.style.display = 'block';
    this.updateScore();
    text.textContent = 'おしい！もういっかい やってみよう！';
    text.style.color = '#FF9800';
    this.audio.playSequence(['おしい！もういっかい やってみよう！']);
    this.audio.playPopSound();
  }

  winMaze(x, y) {
    if (!this.state.mazeActive) return;
    this.state.isAnswering = true;
    this.state.mazeActive = false;
    this.state.mazePlayer = { x, y };
    this.drawMaze();
    const area = this.root.getElementById('maze-feedback-area');
    const text = this.root.getElementById('maze-feedback-text');
    area.style.display = 'block';
    text.textContent = 'やったー！';
    text.style.color = '#4CAF50';
    this.state.score += 10;
    this.updateScore();
    this.audio.speak('やったー！');
    this.audio.playPopSound();
    this.nextTimer = setTimeout(() => this.nextTurn(), 1500);
  }

  endGame() {
    this.state.mazeActive = false;
    this.state.isAnswering = false;
    this.screen.showResult();
    this.state.saveScore();
    this.audio.playSequence(['ぜんぶ できたね！']);
  }
}
