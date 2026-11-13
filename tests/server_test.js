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
{ // 教師雙信箱自動登入、Google ID Token 登入、全內容解鎖、不污染學生紀錄
  ['s90194yeu@gm.nssh.ntpc.edu.tw', 'cpbl90194@gmail.com'].forEach(em => {
    const ev = makeEnv(em); ev.ctx.setupSheets();
    const ai = ev.ctx.apiInit(null);
    assert(ai.teacher && ai.auto && ai.email === em && ai.token);
    const ai2 = ev.ctx.apiInit(ai.token);
    assert(ai2.teacher && ai2.email === em);
  });
  const tokens = {
    t1: { aud: 'cid-123', email: 's90194yeu@gm.nssh.ntpc.edu.tw', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600 },
    t2: { aud: 'cid-123', email: 'cpbl90194@gmail.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600 },
    stu: { aud: 'cid-123', email: 'wang@stdmail.nssh.ntpc.edu.tw', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600 },
    stranger: { aud: 'cid-123', email: 'nobody@gmail.com', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600 },
    unverified: { aud: 'cid-123', email: 'cpbl90194@gmail.com', email_verified: 'false', exp: Math.floor(Date.now() / 1000) + 600 },
    badAud: { aud: 'other-app', email: 'cpbl90194@gmail.com', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600 }
  };
  const fetcher = url => {
    const id = decodeURIComponent(url.split('id_token=')[1] || '');
    if (!tokens[id]) return { getResponseCode: () => 400, getContentText: () => '{}' };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(tokens[id]) };
  };
  const ev = makeEnv('', fetcher); ev.ctx.setupSheets();
  const ms = ev.main;
  ms.getSheetByName('學生名單').appendRow(['s001', '', '王小明', '301', '1', 'wang@stdmail.nssh.ntpc.edu.tw', '校內']);
  // 限制學生只看第 1 回，並把第 2 回設成待審
  ms.getSheetByName('設定').d.forEach(row => {
    if (row[0] === '開放回數') row[1] = '1';
    if (row[0] === 'Google登入ClientID') row[1] = 'cid-123';
  });
  ev.ctx.clearContentCache();
  const gl1 = ev.ctx.apiGoogleLogin('t1'); assert(gl1.teacher && gl1.email === 's90194yeu@gm.nssh.ntpc.edu.tw');
  const gl2 = ev.ctx.apiGoogleLogin('t2'); assert(gl2.teacher && gl2.email === 'cpbl90194@gmail.com');
  ev.ctx.apiTeacherSetStatus(gl2.token, 2, '待審');
  const glS = ev.ctx.apiGoogleLogin('stu'); assert(!glS.teacher && glS.user.account === 's001');
  assert.throws(() => ev.ctx.apiGoogleLogin('stranger'));
  assert.throws(() => ev.ctx.apiGoogleLogin('unverified'));
  assert.throws(() => ev.ctx.apiGoogleLogin('badAud'));
  assert.throws(() => ev.ctx.apiGoogleLogin('invalid'));
  // 學生端被鎖在 1 回，教師端全解鎖
  assert(ev.ctx.apiHome(glS.token).chapters.length === 1);
  assert.throws(() => ev.ctx.apiChapter(glS.token, 2));
  assert.throws(() => ev.ctx.apiBattleStart(glS.token, 2));
  const th = ev.ctx.apiHome(gl2.token);
  assert(th.teacher && th.chapters.length === ev.ctx.catalog_().length);
  const tc2 = th.chapters.find(c => c.ch === 2);
  assert(tc2 && tc2.status === '待審' && tc2.open === false);
  const ch2 = ev.ctx.apiChapter(gl2.token, 2);
  assert(ch2.teacherRead && ch2.allUnlocked && ch2.paras.length > 0 && ch2.status === '待審');
  const cx = ev.ctx.apiCodex(gl2.token);
  assert(cx.allUnlocked && cx.chapters.length === ev.ctx.catalog_().length && cx.prog[2].done && cx.prog[2].mx === 9999);
  const at = ev.ctx.apiAtlas(gl2.token);
  assert(at.allUnlocked && at.reach === ev.ctx.catalog_().slice(-1)[0].ch && at.chapters.length === ev.ctx.catalog_().length);
  // 教師作答、存檔、遊戲、提問、訂正皆不寫入學生紀錄表
  const bt = ev.ctx.apiBattleStart(gl2.token, 2);
  assert(bt.ticket && bt.practice && bt.qs.length > 0);
  const ans = {};
  bt.qs.forEach(q => { ev.ctx.apiGuestBattleAnswer(bt.ticket, q.no, 'A'); ans[q.no] = 'A'; });
  const fin = ev.ctx.apiGuestBattleFinish(bt.ticket, ans);
  assert(fin.total === bt.qs.length && fin.review.length === bt.qs.length);
  ev.ctx.apiSaveDraft(gl2.token, 2, { 1: 'A' }, 0.5, [], 10);
  ev.ctx.apiSaveBookmarks(gl2.token, 2, [{ i: 1, t: 'x', at: 'now' }], 0.5);
  ev.ctx.apiSaveGame(gl2.token, 2, { mx: 5, ev: [0], pd: {} });
  ev.ctx.apiAskWord(gl2.token, 2, 1, '漢室');
  assert.strictEqual(ev.ctx.apiMistakes(gl2.token).length, 0);
  assert(ev.ctx.apiMarkFixed(gl2.token, [{ ch: 2, no: 1 }]) === 0);
  assert(ms.getSheetByName('存檔').getLastRow() === 1);
  assert(ms.getSheetByName('作答紀錄').getLastRow() === 1);
  assert(ms.getSheetByName('錯題訂正').getLastRow() === 1);
  assert(ms.getSheetByName('詞語提問').getLastRow() === 1);
  console.log('TEACHER GOOGLE AUTH & FULL UNLOCK TESTS PASSED'); }
