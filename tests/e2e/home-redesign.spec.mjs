import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const DATE='2026-10-15';
const IDS=['crownsCard','duetCard','blokiCard','latarnieCard','zipCard','sudokuCard'];

test('redesigned home keeps all six daily games reachable without sideways scrolling',async ({page},info)=>{
  test.setTimeout(80000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const viewport of [
    {width:320,height:568},{width:360,height:740},{width:390,height:844},
    {width:768,height:900},{width:1440,height:900}
  ]){
    await page.setViewportSize(viewport);
    await page.goto('/index.html?date='+DATE);
    await expect(page.locator('#progressRing')).toHaveText('0/6');
    await expect(page.locator('#gamesSummary')).toContainText('6 gier');
    for(const id of IDS)await expect(page.locator('#'+id)).toBeVisible();
    const snapshot=await page.evaluate(()=>{
      const tiles=[...document.querySelectorAll('.game-card')].filter(x=>!x.hidden);
      const first=tiles[0].getBoundingClientRect();
      const second=tiles[1].getBoundingClientRect();
      const area=document.querySelector('.games').getBoundingClientRect();
      const nav=document.querySelector('.site-header').getBoundingClientRect();
      return {
        viewport:document.documentElement.clientWidth,
        documentWidth:document.documentElement.scrollWidth,
        bodyWidth:document.body.scrollWidth,
        firstWidth:first.width,
        firstY:first.y,
        secondY:second.y,
        boardTop:area.top,
        headerHeight:nav.height
      };
    });
    expect(snapshot.documentWidth,'document overflow '+JSON.stringify(viewport)).toBeLessThanOrEqual(snapshot.viewport+2);
    expect(snapshot.bodyWidth,'body overflow '+JSON.stringify(viewport)).toBeLessThanOrEqual(snapshot.viewport+2);
    expect(snapshot.firstWidth,'game card unreadably narrow').toBeGreaterThanOrEqual(125);
    if(viewport.width<=600){
      expect(Math.abs(snapshot.firstY-snapshot.secondY),'tiles should start as a two-column row').toBeLessThan(2);
      if(viewport.height>=800)expect(snapshot.firstY,'games should begin within the first screen').toBeLessThan(viewport.height);
    }
  }
  expect(errors).toEqual([]);
  const path='test-results/visual/home/'+info.project.name;
  await mkdir(path,{recursive:true});
  await page.screenshot({path:path+'/desktop-home.png',fullPage:true,animations:'disabled'});
});

test('homepage completion state updates the start button and tiles without losing saves',async ({page})=>{
  await page.goto('/index.html?date='+DATE);
  await expect(page.locator('.daily-cta .btn.white')).toHaveAttribute('href','korony.html');
  await page.evaluate(async date=>{
    const {completeDailyGame}=await import('/src/storage.js');
    completeDailyGame('korony',{timeMs:30000,today:date});
  },DATE);
  await page.reload();
  await expect(page.locator('#progressRing')).toHaveText('1/6');
  await expect(page.locator('#crownsCard')).toHaveClass(/completed/);
  await expect(page.locator('#crownsCard')).toHaveAttribute('href','korony.html?mode=training');
  await expect(page.locator('#crownsStatus')).toHaveText('Zagraj ponownie');
  await expect(page.locator('.daily-cta .btn.white')).toHaveAttribute('href','duet.html');
  await expect(page.locator('#duetCard')).not.toHaveClass(/completed/);
});

test('homepage mobile menu and stat anchors work with the new header',async ({page},info)=>{
  test.skip(info.project.name!=='mobile-chromium');
  await page.goto('/index.html?date='+DATE);
  const menu=page.locator('.menu');
  const nav=page.locator('#mainNav');
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded','true');
  await expect(nav).toBeVisible();
  await nav.getByRole('link',{name:'Statystyki'}).click();
  await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/#statystyki$/);
  await page.goto('/index.html?date='+DATE);
  const path='test-results/visual/home/'+info.project.name;
  await mkdir(path,{recursive:true});
  await page.screenshot({path:path+'/mobile-home.png',fullPage:true,animations:'disabled'});
});
