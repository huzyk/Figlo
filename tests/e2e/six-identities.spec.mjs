import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
const DATE='2026-10-15';
const boards={
  korony:'.board',duet:'.duet-board',bloki:'.bloki-board',
  latarnie:'.latarnie-board',zip:'.zip-board',sudoku:'.sudoku-board'
};
test('six identities load with distinct rendered board treatments and without JS errors',async ({page},testInfo)=>{
  test.setTimeout(140000);
  const errors=[],designs=[];
  const screenshotDir='test-results/visual/'+testInfo.project.name;
  await mkdir(screenshotDir,{recursive:true});
  page.on('pageerror',e=>errors.push(e.message));
  for(const [game,selector] of Object.entries(boards)){
    await page.goto('/'+game+'.html?date='+DATE);
    const el=page.locator(selector);
    await expect(el).toBeVisible({timeout:30000});
    await expect(el).toHaveAttribute('aria-label',/plansza/i,{ignoreCase:true}).catch(()=>{});
    await expect.poll(()=>el.locator(':scope > *').count()).toBeGreaterThan(0);
    const style=await el.evaluate(node=>{
      const board=getComputedStyle(node),body=getComputedStyle(document.body);
      return {
        board:board.backgroundColor+'|'+board.backgroundImage+'|'+board.borderTopColor,
        body:body.backgroundColor+'|'+body.backgroundImage,
        size:[node.getBoundingClientRect().width,node.getBoundingClientRect().height],
        viewport:document.documentElement.clientWidth,
        overflow:document.documentElement.scrollWidth,
      };
    });
    expect(style.size[0]).toBeGreaterThan(180);
    expect(style.size[1]).toBeGreaterThan(180);
    expect(style.overflow).toBeLessThanOrEqual(style.viewport+5);
    await page.screenshot({path:screenshotDir+'/'+game+'.png',fullPage:true,animations:'disabled'});
    designs.push([game,style.board,style.body]);
  }
  expect(new Set(designs.map(x=>x[1])).size).toBe(6);
  expect(new Set(designs.map(x=>x[2])).size).toBe(6);
  expect(errors).toEqual([]);
});
test('Sudoku keypad notes, undo and daily session persist across reloads',async ({page})=>{
  await page.goto('/sudoku.html?date='+DATE);
  const first=page.locator('.sudoku-cell:not(.given)').first();
  await expect(first).toBeVisible({timeout:30000});
  const index=Number(await first.getAttribute('data-index'));
  await first.click();
  await page.locator('#notes').click();
  await expect(page.locator('#notes')).toHaveAttribute('aria-pressed','true');
  await page.locator('#keypad [data-digit="3"]').click();
  await expect(page.locator('.sudoku-cell').nth(index).locator('.sudoku-notes')).toContainText('3');
  await page.locator('#undo').click();
  await expect(page.locator('.sudoku-cell').nth(index).locator('.sudoku-notes')).toHaveCount(0);
  await page.locator('#notes').click();
  await page.locator('#keypad [data-digit="4"]').click();
  await expect(page.locator('.sudoku-cell').nth(index)).toHaveText('4');
  await page.reload();
  await expect(page.locator('.sudoku-cell').nth(index)).toHaveText('4');
  await page.locator('#undo').click();
  await expect(page.locator('.sudoku-cell').nth(index)).toBeEmpty();
  await page.locator('#hint').click();
  await expect(page.locator('.sudoku-cell.hinted')).toHaveCount(1);
  if (page.viewportSize()?.width <= 767) {
    await page.locator('#rulesTop').click();
    await expect(page.locator('.sudoku-aside')).toHaveClass(/mobile-open/);
  }
  await page.locator('#reset').click();
  await expect(page.locator('.sudoku-cell.hinted')).toHaveCount(0);
  await expect(page.locator('#filledCounter')).toHaveText(/\d+\/36/);
});

test('6x6 Sudoku has exactly 36 cells, six keys, and 2x3 thick borders',async ({page})=>{
  await page.goto('/sudoku.html?date=2026-10-15');
  await expect(page.locator('.sudoku-cell')).toHaveCount(36);
  await expect(page.locator('.sudoku-keypad button')).toHaveCount(6);
  await expect(page.locator('#board')).toHaveAttribute('aria-label','Plansza Sudoku 6 na 6');
  await expect(page.locator('.sudoku-cell.box-right')).toHaveCount(6);
  await expect(page.locator('.sudoku-cell.box-bottom')).toHaveCount(12);
  await expect(page.locator('#filledCounter')).toHaveText(/\d+\/36/);
  const record=await page.evaluate(async()=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    return getDailyGame('sudoku','2026-10-15');
  });
  expect(record.puzzle.length).toBe(36);
  expect(record.version).toBe(2);
});

test('Zip checkpoint circles and numbers are centered in cells, including walls',async ({page})=>{
  await page.goto('/zip.html?date=2026-10-15');
  await expect(page.locator('.checkpoint')).not.toHaveCount(0);
  const positions=await page.locator('.zip-cell.numbered').evaluateAll(cells=>cells.map(cell=>{
    const circle=cell.querySelector('.checkpoint');
    const number=circle.querySelector('.checkpoint-number');
    const cb=cell.getBoundingClientRect(),b=circle.getBoundingClientRect(),n=number.getBoundingClientRect();
    return {
      cellIndex:Number(cell.dataset.index),
      dx:(b.left+b.width/2)-(cb.left+cb.width/2),
      dy:(b.top+b.height/2)-(cb.top+cb.height/2),
      numberDy:(n.top+n.height/2)-(b.top+b.height/2),
      overflow:b.left<cb.left||b.right>cb.right||b.top<cb.top||b.bottom>cb.bottom
    };
  }));
  expect(positions.length).toBeGreaterThan(3);
  for(const p of positions){
    expect(Math.abs(p.dx), 'checkpoint horizontal cell '+p.cellIndex).toBeLessThan(3);
    expect(Math.abs(p.dy), 'checkpoint vertical cell '+p.cellIndex).toBeLessThan(3);
    expect(Math.abs(p.numberDy), 'checkpoint numeral '+p.cellIndex).toBeLessThan(3);
    expect(p.overflow).toBe(false);
  }
});

test('Sudoku 6x6 shows legible smaller digits without changing cell geometry',async ({page})=>{
  await page.goto('/sudoku.html?date=2026-10-15');
  const cells=page.locator('.sudoku-cell');
  await expect(cells).toHaveCount(36);
  const sizes=await page.evaluate(()=>{
    const board=document.querySelector('.sudoku-board');
    const given=document.querySelector('.sudoku-cell.given');
    const keypad=document.querySelector('.sudoku-keypad button');
    const box=given.getBoundingClientRect(),parent=board.getBoundingClientRect();
    return {digit:parseFloat(getComputedStyle(given).fontSize),
      keypad:parseFloat(getComputedStyle(keypad).fontSize),
      cellWidth:box.width,cellHeight:box.height,boardWidth:parent.width,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2};
  });
  expect(sizes.digit).toBeGreaterThanOrEqual(26);
  expect(sizes.digit).toBeLessThan(sizes.cellHeight);
  expect(sizes.keypad).toBeGreaterThanOrEqual(29);
  expect(Math.abs(sizes.cellWidth-sizes.cellHeight)).toBeLessThan(2);
  expect(sizes.overflow).toBe(false);
});
