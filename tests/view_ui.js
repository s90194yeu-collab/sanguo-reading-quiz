const assert = require('assert');
require('./harness')(async (p, f, errs) => {
  await f.waitForSelector('#fLogin');
  // 音樂：上次開著，下次進站第一下就點「琴音」鈕 → 應該是開，而不是先開再關
  await f.evaluate(() => localStorage.setItem('sg_music', '1'));
  await p.reload(); await p.waitForTimeout(1500); const ff = p.frame({ url: /inner/ });
  await ff.waitForSelector('#btnMusic');
  await ff.click('#btnMusic'); await p.waitForTimeout(300);
  const on = await ff.evaluate(() => ({ on: Qin.isOn(), cls: document.querySelector('#btnMusic').classList.contains('on') }));
  console.log('music after first click:', JSON.stringify(on)); assert(on.on && on.cls);
  await ff.click('#btnMusic'); await p.waitForTimeout(200); assert(!(await ff.evaluate(() => Qin.isOn())));
  await ff.click('#btnGuest'); await ff.waitForSelector('.card'); await p.waitForTimeout(500);
  await ff.click('.card[data-ch="1"]'); await ff.waitForSelector('#txt'); await p.waitForTimeout(1500);
  const vis = async () => ff.evaluate(() => ['txt', 'bf', 'quiz'].map(id => { const e = document.getElementById(id); return id + ':' + (e && e.offsetParent !== null ? 1 : 0); }).join(' '));
  const combos = [[1, 1, 1], [1, 0, 0], [1, 1, 0], [1, 0, 1], [0, 1, 0], [0, 1, 1], [0, 0, 1]];
  const sel = async (c) => { // 以點擊把狀態調成指定組合
    const names = ['txt', 'bf', 'quiz'];
    for (let i = 0; i < 3; i++) { const on = await ff.evaluate(n => document.querySelector('.vgrp [data-v="' + n + '"]').classList.contains('on'), names[i]); if (!!c[i] !== on && c[i]) await ff.click('.vgrp [data-v="' + names[i] + '"]'); }
    for (let i = 0; i < 3; i++) { const on = await ff.evaluate(n => document.querySelector('.vgrp [data-v="' + n + '"]').classList.contains('on'), names[i]); if (!c[i] && on) await ff.click('.vgrp [data-v="' + names[i] + '"]'); }
    await p.waitForTimeout(900);
  };
  for (const c of combos) {
    await sel(c); const v = await vis(); const want = ['txt:' + c[0], 'bf:' + c[1], 'quiz:' + c[2]].join(' ');
    console.log(c.join(''), v); assert.strictEqual(v, want);
    await p.screenshot({ path: 'V_' + c.join('') + '.png' });
  }
  // 至少留一項
  await ff.click('.vgrp [data-v="quiz"]'); await p.waitForTimeout(200); console.log('last-kept:', await vis());
  // 只有戰況：上一幕／下一幕
  await sel([0, 1, 0]); const t0 = await ff.$eval('#bf .bf-title', e => e.textContent);
  await ff.click('#bf .bf-step button[data-d="1"]'); await p.waitForTimeout(400); const t1 = await ff.$eval('#bf .bf-title', e => e.textContent);
  await ff.click('#bf .bf-step button[data-d="-1"]'); await p.waitForTimeout(400); const t2 = await ff.$eval('#bf .bf-title', e => e.textContent);
  console.log('step:', t0, '→', t1, '→', t2); assert(t0 !== t1 && t0 === t2);
  // 重新整理後設定保留
  await sel([1, 1, 1]); await sel([1, 0, 1]);
  await ff.click('#toHome'); await ff.waitForSelector('.card'); await ff.click('.card[data-ch="1"]'); await ff.waitForSelector('#txt'); await p.waitForTimeout(800);
  console.log('persist:', await vis()); assert.strictEqual(await vis(), 'txt:1 bf:0 quiz:1');
  await sel([1, 1, 1]);
  // 手機
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(800);
  for (const c of [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 1, 0]]) {
    await sel(c); await p.evaluate(() => 0);
    console.log('m', c.join(''), await vis()); await p.screenshot({ path: 'VM_' + c.join('') + '.png' });
  }
});
