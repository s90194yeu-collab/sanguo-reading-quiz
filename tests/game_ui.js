// 新功能：一鍵版面、收合、時間軸、找依據、預測、閱讀進度、圖鑑、戰報卡、勢力版圖、教師審核與預覽
const assert = require('assert');
require('./harness')(async (p, f, errs) => {
  const ctx = global.__ctx, main = global.__main;
  await f.waitForSelector('#fLogin');
  await f.fill('[name=account]', 's002'); await f.fill('[name=password]', '1234'); await f.click('#fLogin button');
  await f.waitForSelector('.card'); await f.click('.card[data-ch="1"]'); await f.waitForSelector('#bf .bf-title'); await p.waitForTimeout(800);
  // 一鍵版面
  await f.click('#btnLayout'); await f.click('#popLayout [data-lay="1"]'); await p.waitForTimeout(500);
  const vis = () => f.evaluate(() => ['txt', 'bf', 'quiz'].map(id => document.getElementById(id).offsetParent ? 1 : 0).join(''));
  console.log('圖文對照', await vis()); assert.strictEqual(await vis(), '110');
  // 捲到第 10 段開頭：大興山對陣，預測出現
  const goRow = async (title, nth = 0) => { await f.evaluate(([t, n]) => { const r = S.bfs.rows.filter(x => x.title === t)[n]; bfGoto(r); }, [title, nth]); await p.waitForTimeout(1300); };
  await goRow('大興山對陣');
  console.log('目前', await f.$eval('#bf .bf-title', e => e.textContent), await f.evaluate(() => JSON.stringify([S.bfs.cur.pq, S.game, !!S.demo, S.bfs.cur.k, S.bfs.cur.po])));
  assert(await f.$('.bf-pd'), '應出現預測'); await p.screenshot({ path: 'G1_predict.png' });
  await f.click('.bf-pd [data-pd="1"]'); await p.waitForTimeout(500);
  await goRow('張飛對鄧茂');
  console.log('目前2', await f.evaluate(() => JSON.stringify([S.bfs.cur.title, S.bfs.rows.indexOf(S.bfs.cur), S.game.pd])));
  const rv = await f.$eval('.bf-rv', e => e.textContent).catch(() => ''); console.log('揭曉:', rv); assert(/雙方先派將領/.test(rv));
  // 找依據：先點錯句，再點對句
  await goRow('張飛對鄧茂', 1);
  await f.click('.bf-ev'); await p.waitForTimeout(300);
  const pt = await f.evaluate(() => { const r = S.bfs.cur, t = evTarget(r), w = textRange(t.p, t.s0 - 4, t.s0 - 2).getClientRects()[0], ok = textRange(t.p, t.s0, t.s1).getClientRects()[0]; return { bad: [w.left + 5, w.top + w.height / 2], ok: [ok.left + 5, ok.top + ok.height / 2] }; });
  await p.mouse.click(pt.bad[0], pt.bad[1]); await p.waitForTimeout(300);
  console.log('錯句:', await f.$eval('#evBar', e => e.textContent)); assert(/還不是/.test(await f.$eval('#evBar', e => e.textContent)));
  await p.screenshot({ path: 'G2_ev_wrong.png' });
  const pt2 = await f.evaluate(() => { const r = S.bfs.cur, t = evTarget(r), ok = textRange(t.p, t.s0, t.s1).getClientRects()[0]; return [ok.left + 5, ok.top + ok.height / 2]; });
  await p.mouse.click(pt2[0], pt2[1]); await p.waitForTimeout(400);
  console.log('對句:', await f.$eval('#evBar', e => e.textContent)); assert(/找到了/.test(await f.$eval('#evBar', e => e.textContent)));
  await p.screenshot({ path: 'G3_ev_ok.png' });
  await p.waitForTimeout(2200); assert(await f.$('.bf-acts .evok'), '應顯示已找到依據');
  // 時間軸點選：跳到長社火攻
  const idx = await f.evaluate(() => S.bfs.rows.findIndex(r => r.title === '長社火攻'));
  await f.click('.bf-tl .tk[data-i="' + idx + '"]'); await p.waitForTimeout(1500);
  console.log('時間軸跳到:', await f.$eval('#bf .bf-title', e => e.textContent)); assert.strictEqual(await f.$eval('#bf .bf-title', e => e.textContent), '長社火攻');
  await p.screenshot({ path: 'G4_fire.png' });
  // 收合
  await f.click('.bf-min'); await p.waitForTimeout(300); assert(await f.$('#bf.mini')); await p.screenshot({ path: 'G5_mini.png' });
  await f.click('.bf-min'); await p.waitForTimeout(300);
  // 閱讀進度
  const w = await f.$eval('#rprog i', e => parseFloat(e.style.width)); console.log('進度條', w); assert(w > 30);
  await p.waitForTimeout(3000);
  const sv = ctx.apiCodex(ctx.apiLogin('s002', '1234', '').token).prog[1]; console.log('存檔', JSON.stringify(sv)); assert(sv.mx >= 15 && sv.ev.length === 1 && Object.keys(sv.pd).length === 1);
  // 圖鑑
  await f.click('#toHome'); await f.waitForSelector('#btnCodex'); await f.click('#btnCodex'); await f.waitForSelector('.cx-card');
  const lock = await f.$$eval('.cx-card', x => [x.length, x.filter(e => e.classList.contains('lock')).length]); console.log('人物卡/上鎖', lock); assert(lock[1] > 0 && lock[1] < lock[0]);
  await p.screenshot({ path: 'G6_codex.png' });
  await f.click('[data-cx="battle"]'); await f.waitForSelector('.cx-bt'); await p.screenshot({ path: 'G7_codex_battle.png' });
  assert.strictEqual(await f.$$eval('.cx-bt.ev', x => x.length), 1);
  await f.click('[data-cx="card"]'); const [dl] = await Promise.all([p.waitForEvent('download'), f.click('[data-rc="1"]')]);
  console.log('戰報卡', dl.suggestedFilename()); await dl.saveAs('G8_report.png');
  // 勢力版圖
  await f.click('#cxBack'); await f.waitForSelector('#btnAtlas'); await f.click('#btnAtlas'); await f.waitForSelector('[data-at="map"]'); await f.click('[data-at="map"]'); await p.waitForTimeout(600);
  await p.screenshot({ path: 'G9_map.png' }); assert(/勢力/.test(await f.$eval('#map', e => e.textContent)));
  // 教師：匯入第六回（待審）→ 預覽 → 上架
  const pk = ctx.exportPack_(1); pk['回'] = 6; pk['回次'] = '第六回'; pk['人物'] = []; ctx.importPack(JSON.stringify(pk), 'import', false);
  await f.evaluate(() => logout(true)); await p.waitForTimeout(500);
  await f.evaluate(() => { S.teacher = null; }); await f.click('.tabs [data-t="t"], #tabT').catch(() => {});
  const tt = ctx.apiTeacherLogin('nanshan').token;
  await f.evaluate(t => { S.teacher = t; setTop(); S.tTab = 'rv'; renderTeacher(); }, tt); await f.waitForSelector('[data-pv="6"]');
  await p.screenshot({ path: 'G10_review.png' });
  await f.click('[data-pv="6"]'); await f.waitForSelector('.pvbar'); await p.waitForTimeout(800);
  assert(!(await f.$('#quiz')).isVisible || !(await f.evaluate(() => document.getElementById('quiz').offsetParent)), '預覽不顯示作答');
  await p.screenshot({ path: 'G11_preview.png' });
  await f.click('#toHome'); await f.waitForSelector('[data-st="上架"][data-ch="6"]');
  p.once('dialog', d => d.accept()); await f.click('[data-st="上架"][data-ch="6"]'); await p.waitForTimeout(600);
  assert.strictEqual(ctx.chapterStatus_()[6].status, '上架');
});
