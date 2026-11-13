const assert = require('assert');
require('./harness')(async (p, f, errs) => {
  await f.waitForSelector('#fLogin');
  await f.evaluate(() => { window.__demoSpeed = 14; });
  await f.click('#btnDemo');
  let k = 0;
  for (; k < 120; k++) {
    await p.waitForTimeout(1000);
    if (await f.$('#dEnd')) break;
    if (k === 6 || k === 14) await p.screenshot({ path: 'D_' + k + '.png' });
  }
  console.log('end screen after ~', k, 's', !!(await f.$('#dEnd')));
  await p.screenshot({ path: 'D_end.png' });
  assert(await f.$('#dEnd'));
  await f.click('#dHome'); await p.waitForTimeout(800);
  console.log('home cards', (await f.$$('.card')).length);
});
