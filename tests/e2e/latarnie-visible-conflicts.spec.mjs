import {test,expect} from '@playwright/test';

test('Latarnie show visible red conflict and instruct user how to fix it',async ({page})=>{
  await page.goto('/latarnie.html?date=2026-10-15');
  await expect(page.locator('.latarnia-cell')).not.toHaveCount(0);

  const adjacent=await page.evaluate(()=>{
    const board=document.querySelector('.latarnie-board');
    const cols=Number(getComputedStyle(board).getPropertyValue('--cols'));
    const available=new Set([...board.querySelectorAll('.latarnia-cell')].map(el=>Number(el.dataset.index)));
    for(const index of available){
      if(index%cols < cols-1 && available.has(index+1))return [index,index+1];
    }
    return null;
  });
  expect(adjacent,'puzzle must have two adjacent white cells').not.toBeNull();

  const [first,second]=adjacent;
  await page.locator('.latarnia-cell[data-index="'+first+'"]').click();
  await page.locator('.latarnia-cell[data-index="'+second+'"]').click();
  await expect(page.locator('.latarnia-cell.conflict')).toHaveCount(2);
  const glow=await page.locator('.latarnia-cell[data-index="'+second+'"]').evaluate(
    el=>getComputedStyle(el).boxShadow
  );
  expect(glow).toContain('rgb(245, 70, 92)');
  await expect(page.locator('#feedback')).toHaveClass(/error/);
  await expect(page.locator('#feedback')).toContainText(/oświetlają się nawzajem/i);

  await page.locator('.latarnia-cell[data-index="'+second+'"]').click();
  await expect(page.locator('.latarnia-cell.conflict')).toHaveCount(0);
  await expect(page.locator('#feedback')).not.toContainText(/oświetlają się nawzajem/i);
});
