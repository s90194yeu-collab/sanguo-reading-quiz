const { makeEnv, SUB } = require('./gasmock');
const assert = require('assert');
const { ctx, main, created } = makeEnv('');
ctx.setupSheets();
const g = n => main.getSheetByName(n);
console.log('sheets', main.sheets.map(s => s.name + ':' + s.getLastRow()).join(' '));
// 名單
const r = g('學生名單');
r.appendRow(['s001', '', '王小明', '301', '1', 'wang@stdmail.nssh.ntpc.edu.tw', '校內']);
r.appendRow(['s002', '1234', '李小華', '301', '2', '', '校內']);
r.appendRow(['s003', '', '陳大同', '302', '1', '', '']);
let init = ctx.apiInit(null); assert(!init.user); console.log('init title', init.title);
// 首次登入需設定
let x = ctx.apiLogin('s001', 'abcd', ''); assert(x.needSetup);
assert.throws(() => ctx.apiLogin('s001', 'abcd', '王大明'));
x = ctx.apiLogin('s001', 'abcd', '王小明'); assert(x.token);
assert(String(r.d[1][1]).startsWith('sha256$'));
assert.throws(() => ctx.apiLogin('s001', 'wrong', ''));
const t1 = ctx.apiLogin('S001', 'abcd', '').token;
// 明文密碼升級
const t2 = ctx.apiLogin('s002', '1234', '').token; assert(String(r.d[2][1]).startsWith('sha256$'));
// 註冊
const t9 = ctx.apiRegister({ account: 'guest_9', password: 'zzzz', name: '外校生', school: '竹林高中', cls: '201', seat: '9' }).token;
assert.throws(() => ctx.apiRegister({ account: 'guest_9', password: 'zzzz', name: 'x' }));
// 自動登入
const env2 = makeEnv('wang@stdmail.nssh.ntpc.edu.tw'); env2.ctx.setupSheets(); env2.main.getSheetByName('學生名單').appendRow(['s001', '', '王小明', '301', '1', 'wang@stdmail.nssh.ntpc.edu.tw']);
const ai = env2.ctx.apiInit(null); assert(ai.auto && ai.user.name === '王小明'); console.log('auto ok');
// 章節
const home = ctx.apiHome(t1); console.log('home', home.chapters.map(c => c.ch + c.title + '(' + c.qn + ')').join(' | '));
const c1 = ctx.apiChapter(t1, 1);
assert(c1.qs === undefined && c1.qn === 10 && c1.paras.length > 10 && c1.ill.length === 3);
ctx.apiSaveDraft(t1, 1, { 1: 'B', 2: 'C' }, 0.4);
const c1b = ctx.apiChapter(t1, 1); assert.deepStrictEqual(JSON.parse(JSON.stringify(c1b.save.draft)), { ans: { 1: 'B', 2: 'C' }, pos: 0.4, bm: [] });
const keyOf = ch => { const o = {}, b = {}; ctx.chapterFull_(ch).qs.forEach(q => { o[q.no] = q.ans; b[q.no] = q.ans === 'A' ? 'B' : 'A'; }); return { right: o, bad: b }; };
let res = SUB(ctx, t1, 1, keyOf(1).bad); console.log('score', res.score, res.total); assert(res.score === 0 && res.total === 10);
res = SUB(ctx, t1, 1, keyOf(1).right); assert(res.score === 10 && res.tries === 2 && res.best === 10);
const c1c = ctx.apiChapter(t1, 1); assert(c1c.result.score === 10 && c1c.save.first === 0);
SUB(ctx, t2, 1, { 1: 'A', 2: 'C', 3: 'A', 4: 'D', 5: 'C' });
SUB(ctx, t9, 2, { 1: 'D', 2: 'A', 3: 'C', 4: 'B', 5: 'A' });
ctx.apiSaveDraft(t2, 3, { 1: 'C' }, 0);
// 教師
assert.throws(() => ctx.apiTeacherLogin('x'));
const tt = ctx.apiTeacherLogin('nanshan').token;
assert.throws(() => ctx.apiTeacherData(t1));
const td = ctx.apiTeacherData(tt); console.log('teacher roster', td.roster.length, 'saves', td.saves.length, 'chapters', td.chapters.length);
const ex = ctx.apiTeacherExportDrive(tt, [{ name: '班級總表', rows: [['a', 'b'], [1]] }, { name: '明細', rows: [['x']] }], 'test');
console.log('export', ex.url, created[0].sheets.map(s => s.name + ':' + s.getLastRow()));
// 開放回數
g('設定').d.forEach(row => { if (row[0] === '開放回數') row[1] = '1,2'; });
ctx.clearContentCache();
assert(ctx.apiHome(t1).chapters.length === 2); assert.throws(() => ctx.apiChapter(t1, 4));
// 插圖網址
ctx.setIllustration(1, 1, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing');
console.log('img', ctx.apiChapter(t1, 1).ill[0].url);
// 竄改 token
assert.throws(() => ctx.apiHome(t1.slice(0, -3) + 'abc'));
// 驗證題庫：答案皆為正解位置
const qb = g('題庫').d.slice(1);
const seedAns = {}; ctx.SEED.questions.forEach(q => seedAns[q.ch + '-' + q.no] = q.ans);
qb.forEach(q => assert(q[8] === seedAns[q[0] + '-' + q[1]]));
console.log('ALL SERVER TESTS PASSED');
module.exports = {};
{ const { makeEnv } = require('./gasmock'); const e = makeEnv(''); e.ctx.setupSheets();
  const h = e.ctx.apiGuestHome(); if (!(h.chapters[0].guest && !h.chapters[1].guest)) throw 'guest home';
  const c = e.ctx.apiGuestChapter(1); if (c.qs !== undefined || c.qn !== 10) throw 'leak';
  let thrown = false; try { e.ctx.apiGuestChapter(2); } catch (x) { thrown = true; } if (!thrown) throw 'guest ch2';
  const gs = e.ctx.apiGuestBattleStart(1), ga = {}; gs.qs.forEach(q => ga[q.no] = 'A'); const r = e.ctx.apiGuestBattleFinish(gs.ticket, ga); if (r.total !== 10) throw 'guest total';
  if (e.main.getSheetByName('存檔').getLastRow() !== 1 || e.main.getSheetByName('作答紀錄').getLastRow() !== 1) throw 'guest wrote records';
  // existing sheet gets new setting row
  const s = e.main.getSheetByName('設定'); s.d = s.d.filter(r => r[0] !== '訪客試讀回數'); e.ctx.setupSheets();
  if (!s.d.some(r => r[0] === '訪客試讀回數')) throw 'setting not added';
  console.log('GUEST TESTS PASSED'); }
