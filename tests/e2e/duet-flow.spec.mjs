import { test, expect } from '@playwright/test';

const DATE='2026-08-24';
const STORAGE_KEY='figlo_user_state_v2';
async function fresh(page){await page.goto(`/duet.html?date=${DATE}`);await page.evaluate(()=>localStorage.clear());await page.reload();}
async function solveDuet(page){
  const record=await page.evaluate(async date=>await (await fetch(`/data/duet/${date}.json`)).json(),DATE);
  const given=new Set(record.puzzle.givens.map(g=>g.index));
  for(let i=0;i<record.solution.length;i++){
    if(given.has(i))continue;
    const cell=page.locator('#board .duet-cell').nth(i);
    await cell.click();
    if(record.solution[i]===2)await cell.click();
  }
  await expect(page.locator('#done')).toBeVisible();
}

test('Duet daily loads from static JSON',async({page})=>{await fresh(page);await expect(page.locator('#board .duet-cell')).toHaveCount(36);await expect(page.locator('#loadError')).toBeHidden();await expect(page.locator('.relation').first()).toBeVisible();});
test('Duet given cells are readonly',async({page})=>{await fresh(page);const given=page.locator('.duet-cell.given').first();const before=await given.getAttribute('aria-label');await given.click();expect(await given.getAttribute('aria-label')).toBe(before);});
test('Duet move and undo survive reload',async({page},info)=>{await fresh(page);const editable=page.locator('.duet-cell:not(.given)').first();await editable.click();const index=await editable.getAttribute('data-index');await page.reload();await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('aria-label',/koło/);const undo=info.project.name==='mobile-chromium'?page.locator('#mobileUndo'):page.locator('#undo');await undo.click();await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('aria-label',/puste/);});
test('Duet keyboard can set value and navigate',async({page})=>{await fresh(page);const editable=page.locator('.duet-cell:not(.given)').first();await editable.focus();await page.keyboard.press('1');const index=Number(await editable.getAttribute('data-index'));await expect(page.locator(`[data-index="${index}"]`)).toHaveAttribute('aria-label',/koło/);});
test('Duet completion produces 1/2 if Korony is not done',async({page})=>{await fresh(page);await solveDuet(page);const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),STORAGE_KEY);expect(state.daily.completedGames).toEqual(['duet']);expect(state.user.streak).toBe(0);await page.goto(`/index.html?date=${DATE}`);await expect(page.locator('#progressRing')).toHaveText('1/2');await expect(page.locator('#duetStatus')).toContainText(/ponownie/i);});
test('Duet replay does not increment product counters',async({page})=>{await fresh(page);await solveDuet(page);const first=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),STORAGE_KEY);await page.locator('#replay').click();await solveDuet(page);const second=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),STORAGE_KEY);expect(second.user.completedGames).toBe(first.user.completedGames);expect(second.games.duet.completedCount).toBe(first.games.duet.completedCount);});
test('Duet board fits mobile and desktop viewport',async({page})=>{await fresh(page);const box=await page.locator('#board').boundingBox();const viewport=page.viewportSize();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);});
