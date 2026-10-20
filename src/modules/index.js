/* 
 * dekita - Preschool Edition Main Entry Point
 * ES Module version
 */

import { GameState } from './core/GameState.js';
import { AudioManager } from './core/AudioManager.js';
import { ScreenManager } from './core/ScreenManager.js';
import { CountGame } from './games/CountGame.js';
import { ColorGame } from './games/ColorGame.js';
import { AnimalGame } from './games/AnimalGame.js';
import { MazeGame } from './games/MazeGame.js';
import { MatchGame } from './games/MatchGame.js';
import { BlockGame } from './games/BlockGame.js';
import { ShiritoriGame } from './games/ShiritoriGame.js';
import { MojiGame } from './games/MojiGame.js';
import { PuzzleGame } from './games/PuzzleGame.js';

export function init() {
  const gameState = new GameState();
  const audioManager = new AudioManager();
  const screenManager = new ScreenManager();
  
  audioManager.setGameState(gameState);
  
  const gameClasses = {
    countGame: CountGame,
    colorGame: ColorGame,
    mazeGame: MazeGame,
    matchGame: MatchGame,
    puzzleGame: PuzzleGame,
    animalGame: AnimalGame,
    shiritoriGame: ShiritoriGame,
    mojiGame: MojiGame,
    blockGame: BlockGame
  };
  const games = {};
  for (const [name, GameClass] of Object.entries(gameClasses)) {
    games[name] = new GameClass(gameState, audioManager, screenManager);
  }

  // ゲームモジュールを ScreenManager に設定
  screenManager.setGameModules(games);

  // 1つのゲームの初期化失敗で他のゲームを止めない
  for (const game of Object.values(games)) {
    try {
      game.init(document);
      console.log(`[gameApp] ${game.constructor.name} initialized`);
    } catch (err) {
      console.error(`[gameApp] ${game.constructor.name} init error:`, err);
    }
  }

  document.getElementById('replay-btn').addEventListener('click', () => {
    audioManager.stopAll();
    document.getElementById(screenManager.lastGameStartButton)?.click();
  });
  document.getElementById('result-home-btn').addEventListener('click', () => {
    audioManager.stopAll();
    screenManager.showTitle();
  });

  return {
    gameState,
    audioManager,
    screenManager,
    ...games
  };
}
