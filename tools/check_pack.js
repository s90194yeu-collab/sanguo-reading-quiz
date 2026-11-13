#!/usr/bin/env node
// 離線檢查內容包（與試算表「匯入內容包」用的是同一套 validatePack_ 規則）
// 用法：node tools/check_pack.js packs/第六回.json [更多檔案…]
// 已知人物與勢力取自 Seed.gs（第 1～5 回）＋同一批檔案裡的「人物」「勢力」
const fs = require('fs'), path = require('path');
const { makeEnv } = require('../tests/gasmock');
const { ctx } = makeEnv(''); ctx.setupSheets();
const files = process.argv.slice(2);
if (!files.length) { console.log('用法：node tools/check_pack.js 內容包.json …'); process.exit(2); }
const known = ctx.knownCtx_(), packs = files.map(f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log('✕ ' + f + '：JSON 格式錯誤 ' + e.message); process.exitCode = 1; return null; } });
packs.forEach(p => { if (p) { (p['人物'] || []).forEach(x => known.people.push(x['姓名'])); (p['勢力'] || []).forEach(x => known.factions.push(x['勢力'])); } });
packs.forEach((pk, i) => {
  if (!pk) return;
  const v = ctx.validatePack_(pk, known);
  console.log('\n■ ' + path.basename(files[i]) + '　' + JSON.stringify(v.stats));
  v.errors.forEach(e => console.log('  ✕ ' + e));
  v.warnings.forEach(e => console.log('  △ ' + e));
  console.log(v.errors.length ? '  → 有 ' + v.errors.length + ' 個錯誤，匯入會被擋下' : '  → 通過（提醒 ' + v.warnings.length + ' 則）');
  if (v.errors.length) process.exitCode = 1;
});
