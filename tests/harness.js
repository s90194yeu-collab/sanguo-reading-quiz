// 瀏覽器測試骨架：用 gasmock 在 node 執行全部 .gs，以 Playwright 開啟合併後的頁面，google.script.run 轉接到 node
// 用法：require('./harness')(async (page, frame, errs) => { ... }, 寬, 高)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { makeEnv } = require('./gasmock');
const { assemble } = require('./assemble');
const SRC = process.env.SRC_DIR || path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true }); process.chdir(SHOTS);
const { ctx, main } = makeEnv(''); ctx.setupSheets();
main.getSheetByName('學生名單').appendRow(['s002', '1234', '李小華', '301', '2', '', '校內']);
global.__ctx = ctx; global.__main = main;
const shim = `<script>window.google={script:{run:(function mk(ok,ng){return new Proxy({}, {get(_,k){
 if(k==='withSuccessHandler')return f=>mk(f,ng); if(k==='withFailureHandler')return f=>mk(ok,f);
 return (...a)=>parent.__gas(k,JSON.stringify(a)).then(r=>{r=JSON.parse(r); if(r.err) ng&&ng(new Error(r.err)); else ok&&ok(r.v);});}})})()}};</script>`;
const NM = path.join(__dirname, 'node_modules');
function fontCss() {
  const fsrc = path.join(NM, '@fontsource'); let s = '';
  for (const f of ['noto-serif-tc/400.css', 'noto-serif-tc/600.css', 'noto-serif-tc/900.css', 'lxgw-wenkai-tc/400.css', 'lxgw-wenkai-tc/700.css']) {
    const p = path.join(fsrc, f); if (!fs.existsSync(p)) continue;
    s += fs.readFileSync(p, 'utf8').replace(/url\(\.\/files\//g, 'url(http://app/fonts/' + f.split('/')[0] + '/');
  }
  return s;
}
module.exports = async function (cb, vw, vh) {
  const html = assemble(SRC);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: vw || 1366, height: vh || 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.exposeFunction('__gas', (k, a) => { try { if (ctx.memoReset_) ctx.memoReset_();   // 真實 Apps Script 每次呼叫都是新的執行環境
    const v = ctx[k](...JSON.parse(a)); return JSON.stringify({ v: v === undefined ? null : v }); } catch (e) { return JSON.stringify({ err: e.message }); } });
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://app/inner')) return r.fulfill({ body: html.replace('<head>', '<head>' + shim), contentType: 'text/html' });
    if (u.startsWith('http://app/fonts/')) { const [, dir, file] = u.match(/fonts\/([^/]+)\/(.+)$/); return r.fulfill({ body: fs.readFileSync(path.join(NM, '@fontsource', dir, 'files', file)), contentType: 'font/woff2' }); }
    if (u.includes('fonts.googleapis.com')) return r.fulfill({ body: fontCss(), contentType: 'text/css' });
    if (u.includes('xlsx.full.min.js') && fs.existsSync(path.join(NM, 'xlsx/dist/xlsx.full.min.js'))) return r.fulfill({ body: fs.readFileSync(path.join(NM, 'xlsx/dist/xlsx.full.min.js')), contentType: 'text/javascript' });
    if (u === 'http://app/') return r.fulfill({ body: '<html><body style="margin:0"><iframe id="f" src="http://app/inner" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe></body></html>', contentType: 'text/html' });
    return r.abort();
  });
  await p.goto('http://app/'); const f = () => p.frame({ url: /inner/ }); await p.waitForTimeout(1500);
  let ok = true;
  try { await cb(p, f(), errs); } catch (e) { ok = false; console.error('FAIL', e.message); }
  console.log('errors:', errs); if (errs.length) ok = false;
  await b.close(); if (!ok) process.exitCode = 1;
};
