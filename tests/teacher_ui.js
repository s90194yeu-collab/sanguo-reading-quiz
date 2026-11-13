const { SUB } = require('./gasmock');
require('./harness')(async (p, f, errs) => {
  const ctx = global.__ctx, main = global.__main;
  main.getSheetByName('學生名單').appendRow(['s003', '1', '陳大同', '301', '3', '', '校內']);
  const tk = a => ctx.apiLogin(a, a === 's002' ? '1234' : '1', '').token;
  const full = ctx.chapterFull_(1), right = {}; full.qs.forEach(q => right[q.no] = q.ans);
  SUB(ctx, tk('s002'), 1, right, 0, 300); SUB(ctx, tk('s003'), 1, {}, 0, 200);
  await f.waitForSelector('.tab[data-t="tea"]'); await f.click('.tab[data-t="tea"]');
  await f.fill('[name=pw]', 'nanshan'); await f.click('#fTea button'); await f.waitForSelector('table.grid'); await p.waitForTimeout(600);
  await p.screenshot({ path: 'T_teacher.png', fullPage: true });
  console.log('kpi', (await f.$$eval('.kpi', xs => xs.map(x => x.textContent.replace(/\s+/g, ' ')))).join(' / '));
  await f.click('tr.clk >> nth=0'); await f.waitForSelector('.modal, #modal, .sc').catch(() => { }); await p.waitForTimeout(400);
  await p.screenshot({ path: 'T_detail.png' });
});
