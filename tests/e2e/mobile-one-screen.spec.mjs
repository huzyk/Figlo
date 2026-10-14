import {test,expect} from '@playwright/test';

const DATE='2026-10-15';
const games=[
  {id:'korony',board:'#board',controls:'.mobile-controls'},
  {id:'duet',board:'.duet-board',controls:'.mobile-controls'},
  {id:'bloki',board:'.bloki-board',controls:'.mobile-controls'},
  {id:'latarnie',board:'.latarnie-board',controls:'.mobile-controls'},
  {id:'zip',board:'.zip-board',controls:'.mobile-controls'},
  {id:'sudoku',board:'.sudoku-board',controls:'.sudoku-keypad'},
];

test('all six mobile games fit their board, feedback and action buttons without scrolling after hints',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium');
  test.setTimeout(210000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const viewport of [{width:390,height:844},{width:360,height:640},{width:320,height:568}]){
    await page.setViewportSize(viewport);
    for(const game of games){
      await page.goto('/'+game.id+'.html?date='+DATE);
      const board=page.locator(game.board);
      await expect(board).toBeVisible({timeout:30000});
      await expect.poll(()=>board.locator(':scope > *').count()).toBeGreaterThan(0);
      const feedback=page.locator(game.id==='sudoku'?'#feedback':'.play-area #feedback, .board-column #feedback');
      await expect(feedback).toBeVisible();
      const actions=page.locator(game.controls);
      await expect(actions).toBeVisible();
      const snapshot=await page.evaluate(({id,board,controls})=>{
        const b=document.querySelector(board).getBoundingClientRect();
        const f=document.querySelector(id==='sudoku'?'#feedback':'.play-area #feedback, .board-column #feedback').getBoundingClientRect();
        const a=document.querySelector(controls).getBoundingClientRect();
        const rounded=r=>({top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width)});
        return {board:rounded(b),feedback:rounded(f),actions:rounded(a),
          height:innerHeight,width:innerWidth,scrollY:scrollY,
          rootOverflow:getComputedStyle(document.body).overflowY};
      },game);
      expect(snapshot.board.width,'board too small '+game.id+JSON.stringify(viewport)).toBeGreaterThan(175);
      expect(snapshot.board.top,'board above viewport '+game.id).toBeGreaterThanOrEqual(0);
      expect(snapshot.board.bottom,'board clipped '+game.id+JSON.stringify(snapshot)).toBeLessThanOrEqual(viewport.height-3);
      expect(snapshot.feedback.top,'feedback hidden '+game.id+JSON.stringify(snapshot)).toBeGreaterThanOrEqual(snapshot.board.bottom-1);
      expect(snapshot.feedback.bottom,'feedback clipped '+game.id+JSON.stringify(snapshot)).toBeLessThanOrEqual(viewport.height-3);
      expect(snapshot.actions.bottom,'controls clipped '+game.id).toBeLessThanOrEqual(viewport.height+1);
      if(game.id==='sudoku'){
        expect(snapshot.actions.top,'keypad below screen '+JSON.stringify(snapshot)).toBeGreaterThanOrEqual(snapshot.feedback.bottom-1);
        await expect(page.locator('#keypad button')).toHaveCount(6);
        await expect(page.locator('#keypad button').last()).toBeInViewport();
      }else{
        expect(snapshot.actions.top,'control overlap '+game.id+JSON.stringify(snapshot)).toBeGreaterThanOrEqual(snapshot.feedback.bottom-2);
      }
      const scrollBefore=await page.evaluate(()=>scrollY);
      const hint=page.locator(game.id==='sudoku'?'#hint':'#mobileHint');
      await hint.click();
      if(game.id==='sudoku')await expect(page.locator('.sudoku-cell.hinted')).toHaveCount(1);
      await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(scrollBefore);
      await expect(board).toBeInViewport();
      await expect(feedback).toBeInViewport();
      if(game.id==='sudoku')await expect(page.locator('#keypad button').last()).toBeInViewport();
      if(['duet','latarnie','zip','korony'].includes(game.id)){
        await expect(feedback).toHaveClass(/hint-feedback/);
        if(game.id!=='korony')await expect(page.locator('#hintCard')).toBeHidden();
      }
    }
  }
  expect(errors).toEqual([]);
});

test('Zip partition wall shows reflective highlight on both axes',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium');
  await page.goto('/zip.html?date='+DATE);
  await expect(page.locator('.zip-cell')).not.toHaveCount(0);
  const walls=await page.evaluate(()=>{
    const right=[...document.querySelectorAll('.zip-cell.wall-r')];
    const bottom=[...document.querySelectorAll('.zip-cell.wall-b')];
    const read=(cell,pseudo)=>({
      content:getComputedStyle(cell,pseudo).content,
      color:getComputedStyle(cell).borderRightColor,
      background:getComputedStyle(cell,pseudo).backgroundImage,
    });
    return {right:right.length,bottom:bottom.length,
      vertical:right.length?read(right[0],'::after'):null,
      horizontal:bottom.length?read(bottom[0],'::before'):null};
  });
  expect(walls.right).toBeGreaterThan(0);
  expect(walls.bottom).toBeGreaterThan(0);
  expect(walls.vertical.content).not.toBe('none');
  expect(walls.vertical.background).toContain('linear-gradient');
  expect(walls.horizontal.content).not.toBe('none');
  expect(walls.horizontal.background).toContain('linear-gradient');
});
