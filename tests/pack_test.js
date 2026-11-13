// 內容包：匯出第一回 → 檢查 → 修改後匯入 → 狀態待審時學生看不到 → 上架後看得到
const { makeEnv } = require('./gasmock'); const assert = require('assert'); const fs = require('fs'), path = require('path');
const { ctx, main } = makeEnv(''); ctx.setupSheets();
const pk = ctx.exportPack_(1);
const v = ctx.validatePack_(pk, ctx.knownCtx_());
console.log('stats', JSON.stringify(v.stats)); console.log('errors', v.errors); console.log('warnings', v.warnings.length, v.warnings.slice(0, 8));
assert.strictEqual(v.errors.length, 0);
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'shots', 'pack1.json'), JSON.stringify(pk, null, 1));
// 壞資料應被擋下
const bad = JSON.parse(JSON.stringify(pk)); bad['戰況'][4]['錨句'] = '這句話不存在'; bad['題庫'][0]['答案'] = 'E'; bad['戰況'][8]['甲方']['兵力'] = '八百';
const vb = ctx.importPack(JSON.stringify(bad), 'import');
console.log('bad:', vb.errors); assert(!vb.imported && vb.errors.length === 3);
// 當成第六回匯入（待審）
const p6 = JSON.parse(JSON.stringify(pk)); p6['回'] = 6; p6['回次'] = '第六回'; p6['人物'] = []; p6['人物事蹟'] = []; p6['人物關係'] = [];
const r = ctx.importPack(JSON.stringify(p6), 'import', false); console.log('import6', r.done, r.status); assert(r.imported && r.status === '待審');
assert.strictEqual(ctx.chapterFull_(6).paras.length, pk['原文'].length);
assert.strictEqual(ctx.chapterFull_(6).bf.length, pk['戰況'].length);
assert(ctx.chapterFull_(6).bf.some(b => b.pq && b.po.length === 3));
assert(!ctx.apiGuestHome().chapters.some(c => c.ch === 6), '待審不該出現在訪客目錄');
main.getSheetByName('學生名單').appendRow(['s9', '1', '測', '301', '1', '', '校內']);
const tk = ctx.apiLogin('s9', '1', '').token;
assert.throws(() => ctx.apiChapter(tk, 6), /尚未開放/);
const tt = ctx.apiTeacherLogin('nanshan').token;
assert(ctx.apiTeacherPreview(tt, 6).paras.length > 0);
ctx.apiTeacherSetStatus(tt, 6, '上架');
assert.strictEqual(ctx.apiChapter(tk, 6).ch, 6);
// 重匯入同一回不會重複
ctx.importPack(JSON.stringify(p6), 'import', true); assert.strictEqual(ctx.chapterFull_(6).qs.length, pk['題庫'].length);
// 遊戲進度
ctx.apiSaveGame(tk, 1, { mx: 10, ev: [3], pd: { 8: 1 } }); const g = ctx.apiSaveGame(tk, 1, { mx: 6, ev: [5] }).g;
console.log('game', JSON.stringify(g)); assert(g.mx === 10 && g.ev.join() === '3,5' && g.pd[8] === 1);
ctx.apiSaveDraft(tk, 1, {}, 0.5, [], 10); const cx = ctx.apiCodex(tk); assert(cx.prog[1].mx === 10 && cx.people.length > 5 && cx.battles.length > 10);
console.log('codex people', cx.people.length, 'battles', cx.battles.length, 'art', cx.art.looks.length, cx.art.factions.length);
console.log('OK');
