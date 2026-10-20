import { test, expect } from '@playwright/test';
import { normalizeCells, rotateCells } from '../../src/modules/utils/blocks/BlockPuzzle.js';
const base = process.env.DEKITA_TEST_URL || 'http://127.0.0.1:8525';
test.use({ hasTouch: true });
test.beforeEach(async ({page}) => {
  await page.clock.install({time:new Date('2026-01-01')});
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.route('http://ubuntu-server-app:8526/**', route=>route.abort());
  await page.addInitScript(()=>{
    window.playedAudio=[];
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){window.playedAudio.push(this);return original.apply(this,args);};
  });
  await page.goto(base);
});
const cell=(page,x,y)=>page.locator(`#block-board [data-column="${x}"][data-row="${y}"]`);
const button=(page,id)=>page.locator(`#block-tray [data-piece="${id}"]`);
async function activate(locator,touch){if(touch)await locator.tap();else await locator.click();}
export async function dragTo(page, source, destination, touch=false) {
  const box=await source.boundingBox();
  const start={x:box.x+box.width/2,y:box.y+box.height/2};
  if(touch){
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[destination]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await session.detach();
  } else {
    await page.mouse.move(start.x,start.y); await page.mouse.down();
    await page.mouse.move(destination.x,destination.y,{steps:5}); await page.mouse.up();
  }
}
async function place(page,piece,touch=false){
  await activate(button(page,piece.id),touch);
  const target=JSON.stringify(normalizeCells(piece.target));
  for(let turn=0;turn<4;turn++){
    const current=await page.evaluate(id=>JSON.stringify(window.gameApp.blockGame.level.pieces[id].cells),piece.id);
    if(current===target)break;
    await activate(button(page,piece.id).locator('.preview-tile').first(),touch);
  }
  expect(await page.evaluate(id=>JSON.stringify(window.gameApp.blockGame.level.pieces[id].cells),piece.id)).toBe(target);
  const destination=await page.evaluate(({id,target})=>{
    const game=window.gameApp.blockGame, board=document.querySelector('#block-board');
    const bounds=board.getBoundingClientRect(),gap=parseFloat(getComputedStyle(board).columnGap);
    const size=(bounds.width-gap*3)/4,cells=game.level.pieces[id].cells;
    const cols=Math.max(...cells.map(([x])=>x))+1,rows=Math.max(...cells.map(([,y])=>y))+1;
    return {x:bounds.left+Math.min(...target.map(([x])=>x))*(size+gap)+(cols*size+(cols-1)*gap)/2,
      y:bounds.top+Math.min(...target.map(([,y])=>y))*(size+gap)+(rows*size+(rows-1)*gap)/2};
  },piece);
  await dragTo(page,button(page,piece.id).locator('.block-preview'),destination,touch);
}
async function fits(page){
  expect(await page.evaluate(()=>{
    const errors=[];
    for(const item of document.querySelectorAll('header, #block-game-screen, #block-game-screen *')){
      if(!item.checkVisibility())continue;
      const box=item.getBoundingClientRect();
      if(box.left<0||box.top<0||box.right>innerWidth+1||box.bottom>innerHeight+1)errors.push(item.id||item.className);
      if(item instanceof HTMLButtonElement&&(box.width<48||box.height<48||item.scrollWidth>item.clientWidth+1||item.scrollHeight>item.clientHeight+1))errors.push('clipped or small button');
    }
    if(document.documentElement.scrollHeight>innerHeight)errors.push('scroll');
    return errors;
  })).toEqual([]);
}
async function solve(page,touch=false){
  const pieces=await page.evaluate(()=>window.gameApp.blockGame.level.pieces.map(({id,target})=>({id,target})));
  for(const piece of pieces)await place(page,piece,touch);
}
for(const [width,height,touch] of [[320,568,true],[1024,768,false]]){
  test(`all five frames rotate, fill, undo and replay ${width}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.screenshot({path:`/tmp/dekita-block-home-${width}.png`});
    await page.locator('#block-start-btn').click();
    await expect(page.locator('#block-progress')).toHaveAttribute('aria-valuenow','0');
    await expect(page.locator('#block-rotate-btn')).toHaveCount(0);
    await expect(page.locator('#block-board .can-place')).toHaveCount(0);
    await expect(page.locator('#block-board button')).toHaveCount(12);
    await activate(button(page,0),touch);
    await dragTo(page,button(page,0),{x:5,y:5},touch);
    await expect(page.locator('#block-feedback-text')).toHaveText('おしい！もういっかい やってみよう！');
    await expect(page.locator('#block-board .occupied')).toHaveCount(0);
    const first=await page.evaluate(()=>({id:0,target:window.gameApp.blockGame.level.pieces[0].target}));
    await place(page,first,touch);
    await expect(page.locator('#block-board .occupied')).toHaveCount(4);
    await expect(button(page,0)).toBeDisabled();
    expect(await button(page,0).evaluate(item=>getComputedStyle(item,'::after').content)).toContain('✓');
    // Any tile belonging to a placed piece returns the whole piece.
    await activate(page.locator('#block-board .occupied').last(),touch);
    await expect(page.locator('#block-board .occupied')).toHaveCount(0);
    await expect(button(page,0)).toBeEnabled();
    await expect(button(page,0)).toHaveAttribute('aria-pressed','true');
    for(let round=0;round<5;round++){
      const area=round<2?12:16;
      await expect(page.locator('#block-board button')).toHaveCount(area);
      await expect(page.locator('#block-tray button')).toHaveCount(area/4);
      await fits(page);
      if(round===2)await page.screenshot({path:`/tmp/dekita-block-play-${width}.png`});
      await solve(page,touch);
      await expect(page.locator('#block-board .occupied')).toHaveCount(area);
      await fits(page);
      if(round===4)await page.screenshot({path:`/tmp/dekita-block-filled-${width}.png`});
      await expect(page.locator('#block-feedback-text')).toHaveText('やったー！');
      await expect(page.locator('#block-instruction')).toHaveText('ぜんぶ はまったね！');
      await expect(page.locator('#block-rotate-btn')).toHaveCount(0);
      await expect(page.locator('#block-progress')).toHaveAttribute('aria-valuenow',String(round+1));
      // Completed frames stay filled until the single automatic transition.
      await activate(page.locator('#block-board .occupied').first(),touch);
      await expect(page.locator('#block-board .occupied')).toHaveCount(area);
      await page.clock.runFor(2100);
      expect(await page.evaluate(()=>window.gameApp.gameState.questionsAnswered)).toBe(round+1);
    }
    await expect(page.locator('#result-screen')).toBeVisible();
    await expect(page.locator('.completion-star')).toBeVisible();
    expect(await page.evaluate(()=>window.gameApp.gameState.score)).toBe(100);
    await page.locator('#replay-btn').click();
    await expect(page.locator('#block-game-screen')).toBeVisible();
    await expect(page.locator('#block-progress')).toHaveAttribute('aria-valuenow','0');
    await expect(page.locator('#block-board .occupied')).toHaveCount(0);
    await expect(page.locator('#block-tray button')).toHaveCount(3);
  });
}

for (const touch of [false, true]) {
  test(`tile activation rotates once and drag preserves orientation (${touch ? 'touch' : 'mouse'})`, async ({page}) => {
    await page.locator('#block-start-btn').click();
    await page.evaluate(() => {const g=window.gameApp.blockGame;g.level.pieces[0].cells=[[0,0],[0,1],[1,1],[2,1]];g.render();});
    let expected=await page.evaluate(()=>window.gameApp.blockGame.level.pieces[0].cells);
    for(let turn=0;turn<4;turn++) {
      await activate(button(page,0).locator('.preview-tile').last(),touch);
      expected=rotateCells(expected);
      expect(await page.evaluate(()=>window.gameApp.blockGame.level.pieces[0].cells)).toEqual(expected);
    }
    await dragTo(page,button(page,0).locator('.preview-tile').first(),{x:5,y:5},touch);
    expect(await page.evaluate(()=>window.gameApp.blockGame.level.pieces[0].cells)).toEqual(expected);
    await expect(page.locator('#block-board .occupied')).toHaveCount(0);
  });
}

test('keyboard rotation and placement keep the shape accessible',async({page})=>{
  await page.locator('#block-start-btn').click();
  await button(page,0).focus(); await page.keyboard.press('Enter');
  const original=await page.evaluate(()=>window.gameApp.blockGame.level.pieces[0].cells);
  for(let i=0;i<4;i++){
    await page.keyboard.press(i%2 ? 'Space' : 'Enter');
    await expect(button(page,0)).toBeFocused();
  }
  expect(await page.evaluate(()=>window.gameApp.blockGame.level.pieces[0].cells)).toEqual(original);
  // Use a known legal orientation and anchor through keyboard activation.
  await page.evaluate(()=>{const g=window.gameApp.blockGame;g.level.pieces[0].cells=[[0,0],[1,0],[2,0],[3,0]];g.render();});
  await cell(page,0,0).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#block-board .occupied')).toHaveCount(4);
  await expect(page.locator('.anchor, .can-place')).toHaveCount(0);
});

test('leaving a finished frame stops speech and pending next; re-entering starts fresh',async({page})=>{
  await page.locator('#block-start-btn').click();
  await solve(page);
  await page.locator('#block-reset-btn').click();
  expect(await page.evaluate(()=>window.playedAudio.every(audio=>audio.paused))).toBe(true);
  await page.locator('#color-start-btn').click();
  await page.clock.runFor(3000);
  await expect(page.locator('#color-game-screen')).toBeVisible();
  expect(await page.evaluate(()=>window.gameApp.gameState.questionsAnswered)).toBe(0);
  await page.locator('#color-reset-btn').click();
  await page.locator('#block-start-btn').click();
  await expect(page.locator('#block-board .occupied')).toHaveCount(0);
  await expect(page.locator('#block-progress')).toHaveAttribute('aria-valuenow','0');
  const response=await page.request.get(`${base}/audio/block-instruction.mp3`);
  expect(response.status()).toBe(200);
  expect((await response.body()).length).toBeGreaterThan(1000);
  await expect.poll(()=>page.evaluate(()=>{
    const audio=window.gameApp.audioManager.currentAudio;
    return audio&&!audio.paused?new URL(audio.src).pathname:null;
  })).toBe('/audio/block-instruction.mp3');
});

test('drag preview, overlap, move, cancel and leaving preserve pieces',async({page})=>{
  await page.locator('#block-start-btn').click();
  await page.evaluate(()=>{const g=window.gameApp.blockGame;g.level.pieces.forEach((p,id)=>{p.cells=[[0,0],[1,0],[2,0],[3,0]];p.target=p.cells.map(([x,y])=>[x,y+id]);});g.render();});
  // A release just outside the board must not snap a near-edge grab into it.
  const preview=await button(page,0).locator('.preview-tile').first().boundingBox();
  const board=await page.locator('#block-board').boundingBox();
  await page.mouse.move(preview.x+preview.width/2,preview.y+1);await page.mouse.down();
  await page.mouse.move(board.x+24,board.y-1,{steps:5});await page.mouse.up();
  await expect(page.locator('#block-board .occupied')).toHaveCount(0);
  await place(page,{id:0,target:[[0,0],[1,0],[2,0],[3,0]]});
  await place(page,{id:1,target:[[0,0],[1,0],[2,0],[3,0]]});
  await expect(page.locator('#block-board .occupied')).toHaveCount(4);
  const first=await cell(page,0,0).boundingBox(),second=await cell(page,0,1).boundingBox();
  await dragTo(page,cell(page,0,0),{x:second.x+second.width/2,y:second.y+second.height/2});
  await expect(cell(page,0,1)).toHaveClass(/occupied/);
  await page.mouse.move(second.x+24,second.y+24);await page.mouse.down();await page.mouse.move(first.x+24,first.y+24);
  await expect(page.locator('.block-drag-preview')).toBeVisible();
  await expect(page.locator('.drop-preview')).toHaveCount(4);
  const ghost=await page.locator('.block-drag-tile').first().boundingBox();
  expect(ghost.width).toBeCloseTo(first.width,0);
  await page.evaluate(()=>document.querySelector('#block-game-screen').dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.gameApp.blockGame.drag.pointerId,bubbles:true})));
  await page.mouse.up();
  await expect(cell(page,0,1)).toHaveClass(/occupied/);
  await expect(page.locator('.block-drag-preview')).toHaveCount(0);
  await dragTo(page,cell(page,0,1),{x:5,y:5});
  await expect(page.locator('#block-board .occupied')).toHaveCount(0);
  await expect(button(page,0)).toBeEnabled();
  await page.mouse.move(first.x+24,first.y+24);
  const tray=await button(page,0).boundingBox();await page.mouse.move(tray.x+24,tray.y+24);await page.mouse.down();await page.mouse.move(first.x+24,first.y+24);
  await page.evaluate(()=>window.gameApp.screenManager.showTitle());
  await page.mouse.up();await expect(page.locator('.block-drag-preview')).toHaveCount(0);
});
