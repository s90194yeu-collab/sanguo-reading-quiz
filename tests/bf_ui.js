const assert = require('assert');
require('./harness')(async (p, f, errs) => {
  await f.waitForSelector('#fLogin'); await f.click('#btnGuest'); await f.waitForSelector('.card'); await p.waitForTimeout(500);
  await f.click('.card[data-ch="1"]'); await f.waitForSelector('#txt'); await p.waitForTimeout(1500);
  const seen = [];
  const title = async () => (await f.$eval('#bf .bf-title', e => e.textContent).catch(() => '(none)'));
  const n = await f.$$eval('#txt p[data-i]', x => x.length); console.log('paras', n);
  for (const i of [1, 4, 6, 10, 12, 15, 16, 18]) {
    await f.evaluate(i => { const e = document.querySelector('#txt p[data-i="' + i + '"]'); const t = document.querySelector('#txt'); t.scrollTop = e.offsetTop - 40; }, i);
    await p.waitForTimeout(1300);
    const t = await title(); seen.push(i + ':' + t);
    if ([6, 10, 15].includes(i)) await p.screenshot({ path: 'W_p' + i + '.png' });
  }
  console.log(seen.join(' | '));
  // scroll within para 10
  const out = [];
  for (const fr of [0.05, 0.35, 0.6, 0.8, 0.95]) {
    await f.evaluate(fr => { const e = document.querySelector('#txt p[data-i="10"]'); const t = document.querySelector('#txt'); t.scrollTop = e.offsetTop + e.offsetHeight * fr - t.clientHeight * 0.3; }, fr);
    await p.waitForTimeout(1200); out.push(fr + ':' + await title());
    if (fr === 0.6) await p.screenshot({ path: 'W_duel.png' });
  }
  console.log(out.join(' | '));
  await f.evaluate(() => { document.querySelector('#txt').scrollTop = 0; }); await p.waitForTimeout(800); console.log('back to top:', await title());
  // vertical mode
  await f.click('#tgVert'); await p.waitForTimeout(1200); await p.screenshot({ path: 'W_vert.png' }); console.log('vert:', await title());
  await f.click('#tgVert'); await p.waitForTimeout(500);
  // mobile
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(800);
  await f.evaluate(() => { const e = document.querySelector('#txt p[data-i="10"]'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 260); }); await p.waitForTimeout(1200);
  await p.screenshot({ path: 'W_mobile.png' }); console.log('mobile:', await title());
});
