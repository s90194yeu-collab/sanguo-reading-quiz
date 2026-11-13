// 最小 Google Apps Script 模擬環境，用來在 node 實際執行 Code.gs
const crypto = require('crypto'), fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = process.env.SRC_DIR || path.resolve(__dirname, '..');
const { assemble } = require('./assemble');
function colIdx(a) { let n = 0; for (const ch of a) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh.set(this.r, this.c, x); return this; }
  setFontWeight() { return this; } setBackground() { return this; } setNumberFormat() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.d = []; }
  set(r, c, v) { while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getLastRow() { let n = this.d.length; while (n > 0 && this.d[n - 1].every(x => x === '' || x === undefined)) n--; return n; }
  getLastColumn() { return Math.max(0, ...this.d.map(r => r.length)); }
  getRange(r, c, nr, nc) { if (typeof r === 'string') { const m = r.match(/^([A-Z]+)/); return new Range(this, 1, colIdx(m[1]), 1, 1); } return new Range(this, r, c, nr || 1, nc || 1); }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, j) => this.set(r, j + 1, v)); }
  deleteRow(n) { this.d.splice(n - 1, 1); }
  setFrozenRows() { } setColumnWidth() { } setName(n) { this.name = n; return this; }
}
class SS {
  constructor() { this.sheets = []; this.id = 'SSID' + Math.random().toString(36).slice(2); }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; } getId() { return this.id; } getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
}
function makeEnv(email, fetcher) {
  const main = new SS(); main.insertSheet('工作表1'); const created = [];
  const cache = {}, props = {};
  const toBytes = s => Array.from(Buffer.from(s, 'utf8')).map(b => b > 127 ? b - 256 : b);
  const fromBytes = a => Buffer.from(a.map(b => b & 255));
  const ctx = {
    console,
    UrlFetchApp: { fetch: fetcher || (() => ({ getResponseCode: () => 500, getContentText: () => '{}' })) },
    SpreadsheetApp: { getActive: () => main, flush() { }, create(n) { const s = new SS(); s.insertSheet('Sheet1'); s.title = n; created.push(s); return s; }, getUi: () => ({}) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { if (Buffer.byteLength(v) > 100000) throw new Error('too big'); cache[k] = v; }, remove: k => delete cache[k], removeAll: ks => ks.forEach(k => delete cache[k]) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
    Session: { getActiveUser: () => ({ getEmail: () => email || '' }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d) => { const t = new Date(d.getTime() + 8 * 3600e3), p = n => String(n).padStart(2, '0'); return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`; },
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', k).update(v).digest()).map(b => b > 127 ? b - 256 : b),
      computeDigest: (alg, v) => Array.from(crypto.createHash('sha256').update(v, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      base64EncodeWebSafe: a => fromBytes(a).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => toBytes(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')),
      newBlob: x => ({ getBytes: () => toBytes(x), getDataAsString: () => fromBytes(x).toString('utf8') }),
    },
    HtmlService: {
      createHtmlOutputFromFile: n => ({ getContent: () => fs.readFileSync(path.join(SRC, n + '.html'), 'utf8') }),
      createTemplateFromFile: n => ({ evaluate: () => ({ getContent: () => assemble(SRC, n) }) })
    },
  };
  vm.createContext(ctx);
  // Apps Script 把所有 .gs 放在同一個全域範圍：Seed.gs 先載入，其餘依檔名
  const gs = fs.readdirSync(SRC).filter(f => f.endsWith('.gs')).sort((a, b) => (a === 'Seed.gs' ? -1 : b === 'Seed.gs' ? 1 : a.localeCompare(b)));
  vm.runInContext(gs.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n'), ctx);
  return { ctx, main, created, cache };
}
/** 測試用：以「原文字母」作答，經由出征 API 完成一回（沒指定的題一律答 A） */
function SUB(ctx, t, ch, ans, pos, spent) {
  const v = ctx.apiBattleStart(t, ch), full = ctx.chapterFull_(ch);
  v.qs.forEach(q => {
    const fq = full.qs.find(x => x.no === q.no), want = (ans && ans[q.no]) || 'A';
    const L = 'ABCD'[q.opts.indexOf(fq.opts['ABCD'.indexOf(want)])];
    ctx.apiBattleAnswer(t, ch, q.no, L);
  });
  return ctx.apiBattleFinish(t, ch, pos || 0, spent || 0);
}
module.exports = { makeEnv, SUB };
