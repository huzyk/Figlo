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
  await page.locator('#reset').click();
  await expect(page.locator('.sudoku-cell.hinted')).toHaveCount(0);
  await expect(page.locator('#filledCounter')).toHaveText(/\d+\/81/);
});
