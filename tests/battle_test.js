const { makeEnv, SUB } = require('./gasmock'); const assert = require('assert');
const { ctx, main } = makeEnv(''); ctx.setupSheets();
const g = n => main.getSheetByName(n);
// 先模擬「已部署的舊專案」：題庫只有舊的 5 題、無「人物」欄 → 執行 applyQuestionBank1 後應有 20 題
const qb = g('題庫'); console.log('seed rows', qb.getLastRow() - 1, 'cols', qb.getLastColumn());
assert(qb.getLastRow() - 1 === SEEDN());
function SEEDN() { return ctx.SEED.questions.length; }
console.log(ctx.applyQuestionBank1());
const f1 = ctx.chapterFull_(1); assert(f1.qs.length === 20, 'bank 20'); assert(f1.qs.filter(q => q.who).length >= 10);
const types = {}; f1.qs.forEach(q => types[q.type] = (types[q.type] || 0) + 1); console.log('types', JSON.stringify(types));
const letters = {}; f1.qs.forEach(q => letters[q.ans] = (letters[q.ans] || 0) + 1); console.log('ans dist', JSON.stringify(letters));
g('學生名單').appendRow(['s001', '1111', '王小明', '301', '1', '', '校內']); g('學生名單').appendRow(['s002', '1234', '李小華', '301', '2', '', '校內']);
const t1 = ctx.apiLogin('s001', '1111', '').token, t2 = ctx.apiLogin('s002', '1234', '').token;
ctx.clearContentCache();
const home = ctx.apiHome(t1); const c1h = home.chapters.find(c => c.ch === 1); console.log('qn', c1h.qn); assert(c1h.qn === 10);
// 開啟章節：不抽題、不洩漏
let c = ctx.apiChapter(t1, 1); assert(c.qs === undefined && c.bt.state === 'none' && c.qn === 10);
// 出征：10 題、分層 4/4/2、選項是 4 個且不含正解字母
let v = ctx.apiBattleStart(t1, 1); assert(v.qs.length === 10 && v.state === 'ongoing');
const grp = q => /人物/.test(q.type) ? 'p' : /概念/.test(q.type) ? 'c' : 't'; const cnt = { t: 0, p: 0, c: 0 };
v.qs.forEach(q => { cnt[grp(q)]++; assert(q.opts.length === 4 && q.ans === undefined); }); console.log('draw', JSON.stringify(cnt)); assert(cnt.t === 4 && cnt.p === 4 && cnt.c === 2);
assert(new Set(v.qs.map(q => q.no)).size === 10);
// 重新整理（再叫一次）→ 同一題組、同一排列
const v2 = ctx.apiBattleStart(t1, 1); assert(JSON.stringify(v2.qs) === JSON.stringify(v.qs), 'resume same draw');
c = ctx.apiChapter(t1, 1); assert(c.bt.state === 'ongoing' && JSON.stringify(c.bt.qs) === JSON.stringify(v.qs));
// 答題：回報正解的「顯示字母」，且與原文對得上
const q0 = v.qs[0], fq0 = f1.qs.find(x => x.no === q0.no), right = 'ABCD'[q0.opts.indexOf(fq0.opts['ABCD'.indexOf(fq0.ans)])];
const wrong = 'ABCD'.split('').find(L => L !== right);
let r = ctx.apiBattleAnswer(t1, 1, q0.no, wrong); assert(!r.ok && r.ans === right && r.exp && r.n === 1);
assert.throws(() => ctx.apiBattleAnswer(t1, 1, q0.no, right), /已經作答/);
assert.throws(() => ctx.apiBattleAnswer(t1, 1, 99, 'A'), /不在本次/);
assert.throws(() => ctx.apiBattleFinish(t1, 1, 0, 10), /未作答/);
// 中途重整：已答的題帶著結果回來
c = ctx.apiChapter(t1, 1); assert(c.bt.done[q0.no] && c.bt.done[q0.no].ok === false);
// 其餘全部答對
v.qs.slice(1).forEach(q => { const f = f1.qs.find(x => x.no === q.no); const L = 'ABCD'[q.opts.indexOf(f.opts['ABCD'.indexOf(f.ans)])]; const rr = ctx.apiBattleAnswer(t1, 1, q.no, L); assert(rr.ok); });
const fin = ctx.apiBattleFinish(t1, 1, 0, 120); console.log('score', fin.score, '/', fin.total); assert(fin.score === 9 && fin.total === 10 && fin.review.length === 10 && fin.tries === 1);
assert.throws(() => ctx.apiBattleFinish(t1, 1, 0, 10), /沒有進行中/);
// 再次開啟：顯示成績與逐題檢討
c = ctx.apiChapter(t1, 1); assert(c.result.score === 9 && c.result.review.length === 10 && c.bt.state === 'done');
// 錯題本：只含答錯、且只含被抽到的題
let mist = ctx.apiMistakes(t1); assert(mist.length === 1 && mist[0].no === q0.no, 'mistakes ' + mist.length);
// 再戰：優先抽沒出現過的題 → 與上一輪完全不重複
const first = new Set(v.qs.map(q => q.no)); const w = ctx.apiBattleStart(t1, 1); const overlap = w.qs.filter(q => first.has(q.no)).length; console.log('overlap with 1st', overlap); assert(overlap === 0);
SUB(ctx, t1, 1, {}, 0, 5); // 開著未完成的出征時 SUB 會接續該題組 → 作答並結算
const fin2 = ctx.apiHome(t1); assert(fin2.progress[1].tries === 2);
// 第三輪：全題庫都出過，重新計
const x3 = ctx.apiBattleStart(t1, 1); assert(x3.qs.length === 10);
// 其他回題數 ≤ 10：全出
const w2 = ctx.apiBattleStart(t2, 2); assert(w2.qs.length === 5);
// 位置洗牌確實隨機：同題 40 次出現的選項排列不只一種
const perms = new Set(); for (let i = 0; i < 40; i++) { const tk = ctx.apiGuestBattleStart(1); const q = tk.qs.find(x => x.no === 3); if (q) perms.add(q.opts.join('|')); }
console.log('distinct perms of Q3 over draws', perms.size); assert(perms.size > 3);
// 訪客：票證
const gs = ctx.apiGuestBattleStart(1); assert(gs.ticket && gs.qs.length === 10);
const gr = ctx.apiGuestBattleAnswer(gs.ticket, gs.qs[0].no, 'A'); assert(typeof gr.ok === 'boolean' && 'ABCD'.includes(gr.ans));
const ga = {}; gs.qs.forEach(q => ga[q.no] = 'A'); const gf = ctx.apiGuestBattleFinish(gs.ticket, ga); assert(gf.total === 10 && gf.review.length === 10);
assert.throws(() => ctx.apiGuestBattleFinish(gs.ticket, {}), /未作答/);
assert.throws(() => ctx.apiGuestBattleStart(2), /需登入/);
assert.throws(() => ctx.apiGuestBattleAnswer(gs.ticket + 'x', 1, 'A'), /重新登入/);
// 老師後台：每回 qn、不因沒被抽到而算錯
const tt = ctx.apiTeacherLogin('nanshan').token; const td = ctx.apiTeacherData(tt); const tc = td.chapters.find(c => c.ch === 1); assert(tc.qs.length === 20 && tc.qn === 10);
// 老師新增題：型別可用「概念」，且編輯不洗掉 人物 欄
const before = g('題庫').getLastRow(); ctx.apiTeacherSaveQ(tt, { ch: 1, no: 3, type: '人物', stem: f1.qs[2].stem, opts: f1.qs[2].opts, ans: f1.qs[2].ans, exp: 'x', para: 16 });
assert(ctx.chapterFull_(1).qs.find(q => q.no === 3).who === '曹操', 'who kept');
console.log('OK battle_test');
