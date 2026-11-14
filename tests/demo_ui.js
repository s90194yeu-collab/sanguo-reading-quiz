const assert = require('assert');
require('./harness')(async (p, f, errs) => {
  await f.waitForSelector('#fLogin');
  // 1) 展示中途按頂欄「目錄」：應乾淨結束展示、回到訪客目錄、不報錯
  await f.evaluate(() => { window.__demoSpeed = 6; });
  await f.click('#btnDemo');
  await f.waitForSelector('#bf .bf-title', { timeout: 20000 });
  await p.waitForTimeout(1500);
  await f.click('#btnHome');
  await f.waitForSelector('.card[data-ch="1"]', { timeout: 15000 });
  await p.waitForTimeout(1500);
  assert(!(await f.$('#dTag')) && !(await f.$('#dBar')) && !(await f.$('#dCur')), 'demo overlay removed after 目錄');
  assert(await f.evaluate(() => !S.demo), 'demo stopped');

  // 2) 完整跑一次：每一幕的說明出現時，戰況面板必須正好停在那一幕
  await f.evaluate(() => { localStorage.removeItem('sg_game_guest_1'); logout(true); window.__demoSpeed = 14; });
  await f.waitForSelector('#btnDemo'); await f.click('#btnDemo');
  let last = '', mism = [], seen = { pd: false, comic: false, codex: false, atlas: false }, k = 0;
  for (; k < 600; k++) {
    await p.waitForTimeout(150);
    if (await f.$('#dEnd')) break;
    const c = await f.evaluate(() => {
      const b = document.querySelector('#dBar'), t = document.querySelector('#bf .bf-title');
      return { cap: b && !b.classList.contains('hide') ? b.innerText.replace(/\s+/g, ' ') : '', panel: t ? t.innerText.replace(/\s+/g, '') : '', pd: !!document.querySelector('.bf-pd'), cx: !!document.querySelector('#cxBody'), at: !!document.querySelector('#graph,#map') };
    });
    if (c.pd) seen.pd = true; if (c.cx) seen.codex = true; if (c.at) seen.atlas = true;
    if (/連環畫/.test(c.cap)) seen.comic = true;
    if (c.cap && c.cap !== last) {
      last = c.cap;
      if (/^第 \d+ 段/.test(c.cap) && c.panel && c.cap.indexOf(c.panel + '：') < 0) mism.push(c.panel + ' ≠ ' + c.cap.slice(0, 40));
    }
  }
  console.log('end after', (k * 0.15).toFixed(0), 's', seen, 'mismatch', mism);
  await p.screenshot({ path: 'D_end.png' });
  assert(await f.$('#dEnd'), 'reached end screen');
  assert(seen.pd && seen.comic && seen.codex && seen.atlas, 'all showcase steps ran');
  assert.strictEqual(mism.length, 0, 'panel in sync with captions');
  assert.strictEqual(await f.evaluate(() => localStorage.getItem('sg_game_guest_1')), null, 'demo leaves no guest progress behind');
  await f.click('#dHome'); await p.waitForTimeout(800);
});
