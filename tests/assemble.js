// 把 Index.html 的 <?!= include('檔名') ?> 展開成單一 HTML（與 Apps Script 的 createTemplateFromFile().evaluate() 相同結果）
const fs = require('fs'), path = require('path');
function assemble(dir, name) {
  const read = n => fs.readFileSync(path.join(dir, n + '.html'), 'utf8');
  return read(name || 'Index').replace(/<\?!=\s*include\('([^']+)'\)\s*\?>/g, (m, n) => read(n));
}
if (require.main === module) {
  const dir = path.resolve(__dirname, '..'), out = process.argv[2] || path.join(__dirname, 'shots', 'Index.assembled.html');
  fs.writeFileSync(out, assemble(dir)); console.log('寫出', out);
}
module.exports = { assemble };
