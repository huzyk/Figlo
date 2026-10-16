import{test,expect}from'@playwright/test';
const DATE='2026-08-26';
async function fresh(page,path=`/latarnie.html?date=${DATE}`){await page.goto(path);await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('#gameLoader')).toBeHidden({timeout:30000});}
test('Latarnie Daily renders a playable board',async({page})=>{await fresh(page);const cells=page.locator('#board .latarnia-cell');expect(await cells.count()).toBeGreaterThan(0);await expect(page.locator('#loadError')).toBeHidden();await expect(page.locator('#done')).toBeHidden();await expect(page.locator('#roundLabel')).toHaveText('Dzisiaj');});
test('Latarnie board cells are equal squares and board fits viewport',async({page})=>{await fresh(page);const geometry=await page.locator('#board').evaluate(board=>{const br=board.getBoundingClientRect(),boxes=[...board.children].map(node=>{const r=node.getBoundingClientRect();return{w:r.width,h:r.height};});return{board:{left:br.left,right:br.right,width:br.width},viewport:window.innerWidth,boxes};});expect(geometry.boxes.length).toBeGreaterThan(1);const first=geometry.boxes[0];for(const box of geometry.boxes){expect(Math.abs(box.w-box.h)).toBeLessThan(.5);expect(Math.abs(box.w-first.w)).toBeLessThan(.5);expect(Math.abs(box.h-first.h)).toBeLessThan(.5);}expect(geometry.board.left).toBeGreaterThanOrEqual(-.5);expect(geometry.board.right).toBeLessThanOrEqual(geometry.viewport+.5);});
test('Latarnie interaction cycles bulb and cross',async({page})=>{await fresh(page);const cell=page.locator('#board .latarnia-cell').first();await cell.click();await expect(cell).toHaveClass(/has-bulb/);await cell.click();await expect(cell).toHaveClass(/has-cross/);await cell.click();await expect(cell).not.toHaveClass(/has-cross/);});
test('Latarnie training opens directly from query param',async({page})=>{await fresh(page,`/latarnie.html?date=${DATE}&mode=training`);await expect(page.locator('#roundLabel')).toContainText('Trening');await expect(page.locator('#done')).toBeHidden();expect(await page.locator('#board .latarnia-cell').count()).toBeGreaterThan(0);});
test('Latarnie mobile hint is revealed in viewport',async({page},info)=>{test.skip(info.project.name!=='mobile-chromium','mobile only');await fresh(page);await page.locator('#mobileHint').click();await expect(page.locator('#feedback')).toHaveClass(/hint-feedback/);await expect(page.locator('#feedback')).toBeInViewport();await expect(page.locator('#hintCard')).toBeHidden();expect(await page.evaluate(()=>scrollY)).toBe(0);});

test('wrong bulb hint is unambiguous and stays visible until dismissed or corrected',async({page},info)=>{
  await fresh(page,'/latarnie.html?date=2026-10-15');
  const wrong=await page.evaluate(async()=>{
    const {getDailyGame}=await import('/src/services/daily-service.js');
    const record=await getDailyGame('latarnie','2026-10-15');
    const solved=new Set(record.solution);
    const walls=new Set(record.puzzle.walls.map(w=>w.index));
    return Array.from({length:record.puzzle.rows*record.puzzle.cols},(_,i)=>i)
      .find(i=>!solved.has(i)&&!walls.has(i));
  });
  expect(wrong).toBeDefined();
  await page.locator('.latarnia-cell[data-index="'+wrong+'"]').click();
  const button=info.project.name==='mobile-chromium'?'#mobileHint':'#hint';
  await page.locator(button).click();
  const wrongCell=page.locator('.latarnia-cell[data-index="'+wrong+'"]');
  await expect(wrongCell).toHaveClass(/hint-action-remove/);
  await expect(wrongCell).toHaveAttribute('aria-description','Podpowiedź: usuń tę latarnię');
  const appearance=await wrongCell.evaluate(el=>({
    ring:getComputedStyle(el).boxShadow,
    badge:getComputedStyle(el,'::after').content,
    bulb:el.querySelector('.bulb')!==null
  }));
  expect(appearance.ring).toContain('rgb(165, 28, 56)');
  expect(appearance.badge).toContain('×');
  expect(appearance.bulb).toBe(true);
  await page.waitForTimeout(3900);
  await expect(wrongCell).toHaveClass(/hint-action-remove/);
  await expect(wrongCell).toHaveAttribute('aria-description','Podpowiedź: usuń tę latarnię');
  if(info.project.name==='mobile-chromium'){
    await page.locator('.mobile-hint-close').click();
    await expect(wrongCell).not.toHaveClass(/hint-target/);
  }else{
    await page.locator('#hintClose').click();
    await expect(wrongCell).not.toHaveClass(/hint-target/);
  }
  await page.locator(button).click();
  await expect(wrongCell).toHaveClass(/hint-action-remove/);
  await wrongCell.click();
  await expect(wrongCell).not.toHaveClass(/hint-target/);
  await expect(wrongCell).not.toHaveClass(/has-bulb/);
});

test('Latarnie hint has a single clearly highlighted action and a distinct source clue',async({page},info)=>{
  await fresh(page,'/latarnie.html?date=2026-10-15');
  const step=await page.evaluate(async()=>{
    const [{getDailyGame},{nextHumanStep}]=await Promise.all([
      import('/src/services/daily-service.js'),
      import('/src/latarnie/human-solver.js')
    ]);
    const {puzzle}=await getDailyGame('latarnie','2026-10-15');
    return nextHumanStep(puzzle,{bulbs:new Set(),noBulbs:new Set(),preferBulbs:true});
  });
  expect(step).not.toBeNull();
  expect(step.indices).toEqual([step.index]);
  const button=info.project.name==='mobile-chromium'?'#mobileHint':'#hint';
  await page.locator(button).click();
  await expect(page.locator('#board .hint-target')).toHaveCount(1);
  await expect(page.locator('#board .hint-target')).toHaveAttribute('data-index',String(step.index));
  await expect(page.locator('#board .hint-source')).toHaveCount(step.sourceIndex==null?0:1);
  if(step.sourceIndex!=null){
    await expect(page.locator('#board .hint-source')).toHaveAttribute('data-index',String(step.sourceIndex));
    const source=page.locator('#board .hint-source');
    const ring=await source.evaluate(el=>getComputedStyle(el).boxShadow);
    expect(ring).toMatch(/rgb\(/);
  }
  const location='wiersz '+(Math.floor(step.index/7)+1)+', kolumna '+(step.index%7+1);
  if(info.project.name==='mobile-chromium'){
    await expect(page.locator('#feedback .mobile-hint-action')).toContainText(location);
    await expect(page.locator('#feedback .mobile-hint-action strong')).toHaveText('Co zrobić:');
    const h=await page.locator('#feedback').evaluate(el=>el.getBoundingClientRect().height);
    expect(h).toBeLessThanOrEqual(190);
  } else {
    await expect(page.locator('#hintText')).toContainText(location);
  }
  await page.locator('#board .hint-target').click();
  await expect(page.locator('#board .hint-target')).toHaveCount(0);
  await expect(page.locator('#board .hint-source')).toHaveCount(0);
});
