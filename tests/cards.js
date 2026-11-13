require('./harness')(async (p, f, errs) => {
  await f.waitForSelector('#fLogin'); await f.click('#btnGuest'); await f.waitForSelector('.card'); await p.waitForTimeout(600);
  const c = await f.$('.card[data-ch="1"]'); await c.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const bb = await c.boundingBox(); await p.screenshot({ path: 'V1_card.png', clip: { x: Math.max(0,bb.x-10), y: bb.y-10, width: 440, height: bb.height+20 } });
  console.log(await f.$$eval('.card[data-ch="1"] .vt span', x => x.map(s => s.textContent + '|' + Math.round(s.getBoundingClientRect().left))));
}, 1366, 768);
