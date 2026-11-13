// 依序執行全部測試；任何一支失敗就以非零代碼結束
const { spawnSync } = require('child_process'), path = require('path');
const list = process.argv.slice(2).length ? process.argv.slice(2) : require('fs').readdirSync(__dirname).filter(f => /_(test|ui)\.js$|^cards\.js$/.test(f)).sort();
let bad = [];
for (const t of list) {
  const t0 = Date.now(); const r = spawnSync('node', [path.join(__dirname, t)], { encoding: 'utf8', timeout: 240000 });
  const ok = r.status === 0 && !/AssertionError|FAIL|Error:/.test(r.stderr || '');
  console.log((ok ? '通過 ' : '失敗 ') + t + '  ' + Math.round((Date.now() - t0) / 1000) + 's');
  if (!ok) { bad.push(t); console.log((r.stdout || '').slice(-1500) + (r.stderr || '').slice(-1500)); }
}
console.log(bad.length ? '失敗：' + bad.join('、') : '全部通過'); process.exitCode = bad.length ? 1 : 0;
