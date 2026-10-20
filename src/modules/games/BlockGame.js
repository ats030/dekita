import { renderProgress } from '../core/Progress.js';
import { anchoredCells, canPlace, createBlockPuzzle, rotateCells, legalAnchors } from '../utils/blocks/BlockPuzzle.js';

export const BLOCK_INSTRUCTION = 'ぶろっくを うごかして わくに はめよう';
const colors = [
  ['あか', '--block-red'], ['あお', '--block-blue'],
  ['きいろ', '--block-yellow'], ['みどり', '--block-green'],
];

export class BlockGame {
  constructor(state, audio, screen) {
    this.state = state;
    this.audio = audio;
    this.screen = screen;
    this.timer = null;
    this.ownsAudio = false;
    this.locked = false;
    this.drag = null;
  }

  init(root) {
    this.root = root;
    root.getElementById('block-start-btn').addEventListener('click', () => { this.audio.init(); this.start(); });
    root.getElementById('block-reset-btn').addEventListener('click', () => this.screen.showTitle());
    const screen = root.getElementById('block-game-screen');
    screen.addEventListener('pointermove', event => this.moveDrag(event));
    screen.addEventListener('pointerup', event => this.endDrag(event));
    for (const name of ['pointercancel', 'lostpointercapture']) {
      screen.addEventListener(name, event => { if (this.drag?.pointerId === event.pointerId) this.cancelDrag(); });
    }
  }

  speak(text) {
    this.ownsAudio = true;
    this.audio.setInterAudioDelay(200);
    this.audio.playSequence([text]);
  }

  start() {
    this.screen.show('block-game-screen');
    this.state.resetScore();
    this.state.questionsAnswered = 0;
    this.state.questionsTotal = 5;
    this.state.gameMode = 'blocks';
    this.state.isAnswering = false;
    this.beginRound();
  }

  beginRound() {
    this.locked = false;
    this.state.isAnswering = false;
    this.selected = null;
    this.level = createBlockPuzzle(this.state.questionsAnswered);
    this.placements = new Map();
    const board = this.root.getElementById('block-board');
    board.replaceChildren();
    for (let row = 0; row < this.level.rows; row++) {
      for (let column = 0; column < this.level.columns; column++) {
        const button = document.createElement('button');
        button.className = 'block-cell';
        button.dataset.column = column;
        button.dataset.row = row;
        button.addEventListener('pointerdown', event => {
          const id = this.pieceAt(column, row);
          if (id !== undefined) this.startDrag(event, id, {column, row});
        });
        // Native keyboard activation is retained as an alternative to dragging.
        button.addEventListener('click', event => { if (event.detail === 0) this.tapCell(column, row); });
        board.appendChild(button);
      }
    }
    const tray = this.root.getElementById('block-tray');
    tray.style.setProperty('--piece-count', this.level.pieces.length);
    tray.replaceChildren(...this.level.pieces.map(piece => {
      const button = document.createElement('button');
      button.className = 'block-piece';
      button.dataset.piece = piece.id;
      button.style.setProperty('--block-fill', `var(${colors[piece.id][1]})`);
      button.addEventListener('pointerdown', event => this.startDrag(event, piece.id));
      button.addEventListener('click', event => { if (event.detail === 0) this.rotatePiece(piece.id); });
      return button;
    }));
    this.root.getElementById('block-feedback-area').style.display = 'none';
    this.render();
    this.speak(BLOCK_INSTRUCTION);
  }

  occupied() {
    return new Set([...this.placements.values()].flat().map(([x,y]) => `${x},${y}`));
  }

  pieceAt(column, row) {
    return [...this.placements].find(([,cells]) => cells.some(([x,y]) => x === column && y === row))?.[0];
  }

  render() {
    const occupied = new Map();
    for (const [id, cells] of this.placements) for (const [x,y] of cells) occupied.set(`${x},${y}`, id);
    for (const button of this.root.querySelectorAll('#block-board .block-cell')) {
      const id = occupied.get(`${button.dataset.column},${button.dataset.row}`);
      button.classList.toggle('occupied', id !== undefined);
      button.dataset.placed = id ?? '';
      button.style.setProperty('--block-fill', id === undefined ? 'var(--color-surface)' : `var(${colors[id][1]})`);
      button.setAttribute('aria-label', id === undefined
        ? `うえから${Number(button.dataset.row)+1}、ひだりから${Number(button.dataset.column)+1}。キーで ここに おく`
        : `${colors[id][0]}の ぶろっく。はこんで うごかす。タッチで もどす`);
    }
    for (const piece of this.level.pieces) {
      const button = this.root.querySelector(`#block-tray [data-piece="${piece.id}"]`);
      button.disabled = this.placements.has(piece.id);
      button.setAttribute('aria-pressed', String(this.selected === piece.id));
      const positions = piece.cells.map(([x,y]) => `うえから${y+1}、ひだりから${x+1}`).join('。');
      const action = button.disabled ? 'おいてあるよ。わくを タッチで もどす' : 'マスを タッチで まわす。はこんで はめる';
      button.setAttribute('aria-label', `${colors[piece.id][0]}の ぶろっく。${action}。${positions}。キーでおくときは いちばんうえのひだりのマスを あわせる`);
      const preview = document.createElement('span');
      preview.className = 'block-preview';
      preview.setAttribute('aria-hidden', 'true');
      const columns = Math.max(...piece.cells.map(([x]) => x)) + 1;
      const rows = Math.max(...piece.cells.map(([,y]) => y)) + 1;
      preview.style.setProperty('--piece-columns', columns);
      preview.style.setProperty('--piece-rows', rows);
      preview.style.setProperty('--piece-span', Math.max(columns, rows));
      for (const [x,y] of piece.cells) {
        const tile = document.createElement('span');
        tile.className = 'preview-tile';
        tile.style.gridColumn = x + 1;
        tile.style.gridRow = y + 1;
        preview.appendChild(tile);
      }
      const name = document.createElement('span');
      name.textContent = colors[piece.id][0];
      button.replaceChildren(preview, name);
    }
    let instruction = 'マスを タッチで まわす・はこんで はめる';
    if (this.locked) instruction = 'ぜんぶ はまったね！';
    else if (this.selected !== null) {
      let cells = this.level.pieces[this.selected].cells;
      const occupiedCells = this.occupied();
      instruction = 'わくまで はこんでね';
      if (!legalAnchors(cells, this.level.columns, this.level.rows, occupiedCells).size) {
        let canTurnToFit = false;
        for (let turn = 0; turn < 3; turn++) {
          cells = rotateCells(cells);
          if (legalAnchors(cells, this.level.columns, this.level.rows, occupiedCells).size) canTurnToFit = true;
        }
        instruction = canTurnToFit ? 'まわして みよう' : 'おいた ぶろっくを もどしてね';
      }
    }
    this.root.getElementById('block-instruction').textContent = instruction;
    renderProgress(this.root.getElementById('block-progress'), this.state.questionsAnswered, 5);
  }

  rotatePiece(id) {
    if (this.locked || this.drag || this.placements.has(id)) return;
    this.selected = id;
    const piece = this.level.pieces[id];
    piece.cells = rotateCells(piece.cells);
    this.audio.playPopSound();
    this.root.getElementById('block-feedback-area').style.display = 'none';
    this.render();
  }

  startDrag(event, id, source = null) {
    if (this.locked || this.drag || event.button !== 0 || (!source && this.placements.has(id))) return;
    event.preventDefault();
    const board = this.root.getElementById('block-board');
    const bounds = board.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(board).columnGap);
    const size = (bounds.width - gap * (this.level.columns - 1)) / this.level.columns;
    const cells = this.level.pieces[id].cells.map(cell => [...cell]);
    const columns = Math.max(...cells.map(([x]) => x)) + 1;
    const rows = Math.max(...cells.map(([,y]) => y)) + 1;
    const width = columns * size + (columns - 1) * gap;
    const height = rows * size + (rows - 1) * gap;
    let pieceBounds;
    if (source) {
      const original = this.placements.get(id);
      pieceBounds = {left:bounds.left + Math.min(...original.map(([x]) => x)) * (size+gap),
        top:bounds.top + Math.min(...original.map(([,y]) => y)) * (size+gap), width, height};
    } else {
      const tiles = [...event.currentTarget.querySelectorAll('.preview-tile')].map(tile => tile.getBoundingClientRect());
      const left = Math.min(...tiles.map(tile => tile.left)), top = Math.min(...tiles.map(tile => tile.top));
      pieceBounds = {left, top, width:Math.max(...tiles.map(tile => tile.right))-left,
        height:Math.max(...tiles.map(tile => tile.bottom))-top};
    }
    const clamp = value => Math.max(0, Math.min(1, value));
    this.drag = {pointerId:event.pointerId, id, source, original:this.placements.get(id), cells,
      startX:event.clientX, startY:event.clientY, grabX:clamp((event.clientX-pieceBounds.left)/pieceBounds.width)*width,
      grabY:clamp((event.clientY-pieceBounds.top)/pieceBounds.height)*height, columns, rows, size, gap, moved:false, candidate:null};
    if (!source) this.selected = id;
    this.root.getElementById('block-game-screen').setPointerCapture(event.pointerId);
    this.render();
  }

  moveDrag(event) {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX-drag.startX, event.clientY-drag.startY) < 6) return;
      drag.moved = true;
      if (drag.source) this.placements.delete(drag.id);
      this.selected = drag.id;
      this.root.getElementById('block-feedback-area').style.display = 'none';
      this.render();
      const ghost = document.createElement('div');
      ghost.className = 'block-drag-preview';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.setProperty('--block-fill', `var(${colors[drag.id][1]})`);
      ghost.style.gridTemplateColumns = `repeat(${drag.columns}, ${drag.size}px)`;
      ghost.style.gridTemplateRows = `repeat(${drag.rows}, ${drag.size}px)`;
      ghost.style.gap = `${drag.gap}px`;
      for (const [x,y] of drag.cells) {
        const tile = document.createElement('span');
        tile.className = 'block-drag-tile';
        tile.style.gridColumn = x+1;
        tile.style.gridRow = y+1;
        ghost.appendChild(tile);
      }
      this.root.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    const bounds = this.root.getElementById('block-board').getBoundingClientRect();
    const left = event.clientX-drag.grabX, top = event.clientY-drag.grabY;
    const column = Math.round((left-bounds.left)/(drag.size+drag.gap));
    const row = Math.round((top-bounds.top)/(drag.size+drag.gap));
    const cells = drag.cells.map(([x,y]) => [x+column,y+row]);
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    drag.candidate = inside && canPlace(cells,this.level.columns,this.level.rows,this.occupied()) ? cells : null;
    this.clearDropPreview();
    if (drag.candidate) {
      for (const [x,y] of drag.candidate) {
        const tile = this.root.querySelector(`#block-board [data-column="${x}"][data-row="${y}"]`);
        tile.classList.add('drop-preview');
        tile.style.setProperty('--drop-fill', `var(${colors[drag.id][1]})`);
      }
    }
    drag.ghost.classList.toggle('cannot-drop', !drag.candidate);
    drag.ghost.style.left = `${drag.candidate ? bounds.left+column*(drag.size+drag.gap) : left}px`;
    drag.ghost.style.top = `${drag.candidate ? bounds.top+row*(drag.size+drag.gap) : top}px`;
  }

  clearDropPreview() {
    for (const tile of this.root.querySelectorAll('#block-board .drop-preview')) {
      tile.classList.remove('drop-preview');
      tile.style.removeProperty('--drop-fill');
    }
  }

  releaseDrag() {
    const drag = this.drag;
    this.drag = null;
    drag?.ghost?.remove();
    this.clearDropPreview();
    const screen = this.root.getElementById('block-game-screen');
    if (drag && screen.hasPointerCapture(drag.pointerId)) screen.releasePointerCapture(drag.pointerId);
    return drag;
  }

  endDrag(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    this.moveDrag(event);
    const drag = this.releaseDrag();
    if (!drag.moved) {
      if (drag.source) this.tapCell(drag.source.column,drag.source.row);
      else this.rotatePiece(drag.id);
      return;
    }
    if (drag.candidate) { this.commitPlacement(drag.id,drag.candidate); return; }
    this.selected = drag.id;
    this.render();
    const tray = this.root.getElementById('block-tray').getBoundingClientRect();
    if (event.clientX < tray.left || event.clientX > tray.right || event.clientY < tray.top || event.clientY > tray.bottom) {
      this.feedback('おしい！もういっかい やってみよう！','wrong');
    }
  }

  cancelDrag(restore = true) {
    const drag = this.releaseDrag();
    if (!drag) return;
    if (restore && drag.original) this.placements.set(drag.id,drag.original);
    this.selected = drag.original ? null : drag.id;
    if (restore && this.screen.currentScreen === 'block-game-screen') this.render();
  }

  tapCell(column, row) {
    if (this.locked || this.drag) return;
    const id = this.pieceAt(column,row);
    if (id !== undefined) {
      this.placements.delete(id);
      this.selected = id;
      this.audio.playPopSound();
      this.root.getElementById('block-feedback-area').style.display = 'none';
      this.render();
      return;
    }
    if (this.selected === null) return;
    const cells = anchoredCells(this.level.pieces[this.selected].cells,column,row);
    if (canPlace(cells,this.level.columns,this.level.rows,this.occupied())) this.commitPlacement(this.selected,cells);
    else this.feedback('おしい！もういっかい やってみよう！','wrong');
  }

  commitPlacement(id, cells) {
    this.placements.set(id,cells);
    this.selected = null;
    this.audio.playPopSound();
    this.root.getElementById('block-feedback-area').style.display = 'none';
    if (this.placements.size === this.level.pieces.length) {
      this.locked = true;
      this.state.isAnswering = true;
      this.state.questionsAnswered++;
      this.state.addScore(20);
      this.feedback('やったー！','correct');
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.state.questionsAnswered === 5) this.endGame();
        else this.beginRound();
      },2000);
    }
    this.render();
  }

  feedback(text, kind) {
    const area = this.root.getElementById('block-feedback-area');
    area.dataset.feedback = kind;
    area.style.display = 'block';
    this.root.getElementById('block-feedback-text').textContent = text;
    this.speak(text);
  }

  endGame() {
    this.state.saveScore();
    this.screen.showResult();
    this.speak('ぜんぶ できたね！');
  }

  cleanup() {
    this.cancelDrag(false);
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
