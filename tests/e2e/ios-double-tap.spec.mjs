import { test, expect } from '@playwright/test';

const games = ['korony','duet','bloki','latarnie','zip','sudoku'];

test('all puzzle pages prevent iOS-style double-tap zoom without disabling pinch zoom', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile-chromium');
  test.setTimeout(90000);

  for(const game of games){
    await page.goto('/'+game+'.html?date=2026-10-15');
    const values=await page.evaluate(()=>{
      const viewport=document.querySelector('meta[name="viewport"]')?.content||'';
      const button=document.querySelector('button');
      return {
        viewport,
        html:getComputedStyle(document.documentElement).touchAction,
        body:getComputedStyle(document.body).touchAction,
        button:button?getComputedStyle(button).touchAction:'',
        css:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.getAttribute('href'))
      };
    });
    expect(values.html,game+' html double-tap').toBe('manipulation');
    expect(values.body,game+' body double-tap').toBe('manipulation');
    expect(values.button,game+' buttons double-tap').toBe('manipulation');
    expect(values.viewport,game+' keeps native pinch').not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
    expect(values.css.some(href=>href?.includes('ios-tap')),game+' uses current CSS').toBe(true);
  }
});
