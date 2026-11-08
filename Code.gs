/**
 * 《三國演義》閱讀檢測網站 — Code.gs
 * 綁定 Google 試算表的 Apps Script。檔案：Code.gs、Seed.gs、Index.html
 * 第一次使用：在編輯器執行 setupSheets()，授權後再部署為網頁應用程式。
 */

var SHEET = {
  SET: '設定', ROSTER: '學生名單', TEXT: '原文', QB: '題庫',
  ILL: '插圖', SAVE: '存檔', LOG: '作答紀錄'
};
var HEAD = {
  '設定': ['項目', '值', '說明'],
  '學生名單': ['帳號', '密碼', '姓名', '班級', '座號', 'Email', '身分', '學校', '建立時間', '最近登入'],
  '原文': ['回', '回次', '回目', '段落序', '內文'],
  '題庫': ['回', '題號', '類型', '題幹', 'A', 'B', 'C', 'D', '答案', '解析', '對應段落'],
  '插圖': ['回', '序', '標題', '插在第幾段之後', '圖說', '生圖提示詞', '圖片網址或雲端檔案ID'],
  '存檔': ['帳號', '回', '草稿', '已交卷', '首次得分', '最高得分', '最近得分', '作答次數', '最近作答', '首次交卷時間', '最近交卷時間', '更新時間'],
  '作答紀錄': ['時間', '帳號', '姓名', '班級', '座號', '回', '作答', '得分', '第幾次']
};
var DEFAULT_SET = [
  ['網站標題', '三國演義・閱讀試煉', '顯示在網站最上方'],
  ['副標題', '南山高中國文科', ''],
  ['教師密碼', 'nanshan', '進入教師後台的密碼，請務必修改'],
  ['允許重作', '是', '是／否：交卷後可否再作答（成績記首次、最高、最近）'],
  ['交卷後顯示解析', '是', '是／否'],
  ['開放回數', '全部', '「全部」或以逗號列出，例如 1,2,3'],
  ['開放外人註冊', '是', '是／否：不在名單內的人能否自行註冊'],
  ['訪客試讀回數', '1', '免登入即可閱讀作答的回數，逗號分隔（例：1,2）；留空＝關閉訪客模式。訪客成績不記錄'],
  ['顯示未完成插圖', '是', '是／否：圖片網址還沒填時，是否顯示「畫卷待展」框'],
  ['原文底本', '好讀《三國演義》（2012年4月7日版）|https://www.haodoo.net/', '顯示於每回文末；「|」後為連結'],
  ['參校本', '維基文庫〈三國演義・{回次}〉|https://zh.wikisource.org/zh-hant/三國演義/第{NNN}回', '{回次}＝第一回，{NNN}＝001'],
  ['校勘說明', '字形依教育部標準字體調整；少數訛字據參校本及通行本改正。', '']
];

/* ---------- 網頁入口 ---------- */
function doGet() {
  ensureSetup_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(getSettings_()['網站標題'] || '三國演義・閱讀試煉')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('三國演義閱讀檢測')
    .addItem('初始化／補建工作表', 'setupSheets')
    .addItem('清除網站快取（改完原文或題庫後按）', 'clearContentCache')
    .addToUi();
}

/* ---------- 初始化 ---------- */
function setupSheets() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(HEAD).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]])
        .setFontWeight('bold').setBackground('#efe4cc');
      sh.setFrozenRows(1);
    }
  });
  var set = ss.getSheetByName(SHEET.SET);
  if (set.getLastRow() < 2) set.getRange(2, 1, DEFAULT_SET.length, 3).setValues(DEFAULT_SET);
  else {
    var have = {};
    set.getRange(2, 1, set.getLastRow() - 1, 1).getValues().forEach(function (r) { have[str_(r[0])] = true; });
    DEFAULT_SET.forEach(function (r) { if (!have[r[0]]) set.appendRow(r); });
  }

  var tx = ss.getSheetByName(SHEET.TEXT);
  if (tx.getLastRow() < 2) {
    var rows = [];
    SEED.chapters.forEach(function (c) {
      c.paras.forEach(function (p, i) { rows.push([c.ch, c.num, c.title, i + 1, p]); });
    });
    tx.getRange(2, 1, rows.length, 5).setValues(rows);
    tx.setColumnWidth(5, 600);
  }
  var qb = ss.getSheetByName(SHEET.QB);
  if (qb.getLastRow() < 2) {
    var qr = SEED.questions.map(function (q) {
      return [q.ch, q.no, q.type, q.stem, q.opts[0], q.opts[1], q.opts[2], q.opts[3], q.ans, q.exp, q.para];
    });
    qb.getRange(2, 1, qr.length, 11).setValues(qr);
  }
  var il = ss.getSheetByName(SHEET.ILL);
  if (il.getLastRow() < 2) {
    var ir = SEED.illus.map(function (x) { return [x.ch, x.no, x.title, x.after, x.caption, x.prompt, x.url]; });
    il.getRange(2, 1, ir.length, 7).setValues(ir);
  }
  var rs = ss.getSheetByName(SHEET.ROSTER);
  rs.getRange('A:A').setNumberFormat('@'); rs.getRange('B:B').setNumberFormat('@');
  getSecret_();
  clearContentCache();
}

function ensureSetup_() {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SHEET.QB) || !ss.getSheetByName(SHEET.SAVE)) setupSheets();
}

function clearContentCache() {
  var c = CacheService.getScriptCache();
  var keys = ['catalog', 'settings'];
  for (var i = 1; i <= 120; i++) keys.push('ch_' + i);
  c.removeAll(keys);
}

/* ---------- 共用工具 ---------- */
function sh_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function rows_(name) {
  var s = sh_(name); if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
}
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }

function getSettings_() {
  var c = CacheService.getScriptCache(), hit = c.get('settings');
  if (hit) return JSON.parse(hit);
  var o = {};
  rows_(SHEET.SET).forEach(function (r) { if (str_(r[0])) o[str_(r[0])] = str_(r[1]); });
  c.put('settings', JSON.stringify(o), 300);
  return o;
}
function yes_(v) { return /^(是|y|yes|true|1|開)$/i.test(str_(v)); }

function getSecret_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  return s;
}
function b64_(bytes) { return Utilities.base64EncodeWebSafe(bytes); }
function sign_(payload) {
  var body = b64_(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  var sig = b64_(Utilities.computeHmacSha256Signature(body, getSecret_()));
  return body + '.' + sig;
}
function verify_(token, role) {
  if (!token) throw new Error('請重新登入');
  var parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('請重新登入');
  var sig = b64_(Utilities.computeHmacSha256Signature(parts[0], getSecret_()));
  if (sig !== parts[1]) throw new Error('請重新登入');
  var p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (p.e < Date.now()) throw new Error('登入已逾時，請重新登入');
  if (role && p.r !== role) throw new Error('權限不足');
  return p;
}
function hash_(pw) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, getSecret_().slice(0, 16) + '|' + pw, Utilities.Charset.UTF_8);
  return 'sha256$' + raw.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function checkPw_(stored, input) {
  stored = str_(stored);
  if (stored.indexOf('sha256$') === 0) return stored === hash_(input);
  return stored === str_(input);
}

/* ---------- 名單 ---------- */
function findStudent_(account) {
  var key = str_(account).toLowerCase();
  if (!key) return null;
  var data = rows_(SHEET.ROSTER);
  for (var i = 0; i < data.length; i++) {
    if (str_(data[i][0]).toLowerCase() === key) return { row: i + 2, r: data[i] };
  }
  return null;
}
function findByEmail_(email) {
  email = str_(email).toLowerCase(); if (!email) return null;
  var data = rows_(SHEET.ROSTER);
  for (var i = 0; i < data.length; i++) {
    if (str_(data[i][5]).toLowerCase() === email) return { row: i + 2, r: data[i] };
  }
  return null;
}
function userObj_(r) {
  return { account: str_(r[0]), name: str_(r[2]), cls: str_(r[3]), seat: str_(r[4]), kind: str_(r[6]) || '校內', school: str_(r[7]) };
}
function issueStudent_(hit) {
  sh_(SHEET.ROSTER).getRange(hit.row, 10).setValue(now_());
  var u = userObj_(hit.r);
  return { token: sign_({ a: u.account, r: 's', e: Date.now() + 1000 * 60 * 60 * 24 * 14 }), user: u };
}

/* ---------- 內容 ---------- */
function openChapters_() {
  var s = getSettings_()['開放回數'] || '全部';
  if (s === '全部' || s === '') return null;
  var o = {};
  s.split(/[,，、\s]+/).forEach(function (x) { if (x) o[Number(x)] = true; });
  return o;
}
function catalog_() {
  var c = CacheService.getScriptCache(), hit = c.get('catalog');
  if (hit) return JSON.parse(hit);
  var seen = {}, list = [];
  rows_(SHEET.TEXT).forEach(function (r) {
    var ch = Number(r[0]);
    if (ch && !seen[ch]) { seen[ch] = true; list.push({ ch: ch, num: str_(r[1]), title: str_(r[2]) }); }
  });
  var qn = {};
  rows_(SHEET.QB).forEach(function (r) { var ch = Number(r[0]); if (ch) qn[ch] = (qn[ch] || 0) + 1; });
  list.forEach(function (x) { x.qn = qn[x.ch] || 0; });
  list.sort(function (a, b) { return a.ch - b.ch; });
  c.put('catalog', JSON.stringify(list), 600);
  return list;
}
function imgUrl_(v) {
  v = str_(v); if (!v) return '';
  if (/^embed:img_\d+_\d+$/.test(v)) return v;
  var m = v.match(/(?:\/d\/|id=)([\w-]{20,})/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w2000';
  if (/^[\w-]{25,}$/.test(v)) return 'https://drive.google.com/thumbnail?id=' + v + '&sz=w2000';
  return v;
}
/** 含答案的完整一回（僅伺服器端使用） */
function chapterFull_(ch) {
  var c = CacheService.getScriptCache(), key = 'ch_' + ch, hit = c.get(key);
  if (hit) return JSON.parse(hit);
  var paras = [], num = '', title = '';
  rows_(SHEET.TEXT).forEach(function (r) {
    if (Number(r[0]) === ch) { num = str_(r[1]); title = str_(r[2]); paras.push({ i: Number(r[3]), t: str_(r[4]) }); }
  });
  paras.sort(function (a, b) { return a.i - b.i; });
  var qs = rows_(SHEET.QB).filter(function (r) { return Number(r[0]) === ch; }).map(function (r) {
    return { no: Number(r[1]), type: str_(r[2]), stem: str_(r[3]), opts: [str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7])],
      ans: str_(r[8]).toUpperCase(), exp: str_(r[9]), para: Number(r[10]) || 0 };
  }).sort(function (a, b) { return a.no - b.no; });
  var ill = rows_(SHEET.ILL).filter(function (r) { return Number(r[0]) === ch; }).map(function (r) {
    return { no: Number(r[1]), title: str_(r[2]), after: Number(r[3]) || 0, caption: str_(r[4]), url: imgUrl_(r[6]) };
  }).sort(function (a, b) { return a.no - b.no; });
  var o = { ch: ch, num: num, title: title, paras: paras, qs: qs, ill: ill };
  try { c.put(key, JSON.stringify(o), 600); } catch (e) { }
  return o;
}

/* ---------- 存檔 ---------- */
function findSave_(account, ch) {
  var data = rows_(SHEET.SAVE), a = str_(account).toLowerCase();
  for (var i = 0; i < data.length; i++) {
    if (str_(data[i][0]).toLowerCase() === a && Number(data[i][1]) === ch) return { row: i + 2, r: data[i] };
  }
  return null;
}
function saveObj_(r) {
  var j = function (v) { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  return { ch: Number(r[1]), draft: j(r[2]), submitted: yes_(r[3]), first: r[4] === '' ? null : Number(r[4]),
    best: r[5] === '' ? null : Number(r[5]), last: r[6] === '' ? null : Number(r[6]), tries: Number(r[7]) || 0,
    lastAns: j(r[8]), firstTime: str_(r[9]), lastTime: str_(r[10]), updated: str_(r[11]) };
}
function progress_(account) {
  var a = str_(account).toLowerCase(), o = {};
  rows_(SHEET.SAVE).forEach(function (r) {
    if (str_(r[0]).toLowerCase() === a) {
      var s = saveObj_(r);
      o[s.ch] = { submitted: s.submitted, best: s.best, last: s.last, tries: s.tries, hasDraft: !!(s.draft && s.draft.ans && Object.keys(s.draft.ans).length) };
    }
  });
  return o;
}

/* ================= 對前端開放的 API ================= */

function guestChapters_(set) {
  var o = {}, v = set['訪客試讀回數'];
  if (v === undefined) v = '1';
  str_(v).split(/[,，、\s]+/).forEach(function (x) { if (Number(x)) o[Number(x)] = true; });
  return o;
}

function apiInit(token) {
  var set = getSettings_();
  var out = { title: set['網站標題'] || '三國演義・閱讀試煉', subtitle: set['副標題'] || '',
    allowRegister: yes_(set['開放外人註冊'] || '是'), user: null, token: null,
    guestChapters: Object.keys(guestChapters_(set)).map(Number) };
  if (token) {
    try {
      var p = verify_(token);
      if (p.r === 't') { out.teacher = true; out.token = token; }
      else { var hit = findStudent_(p.a); if (hit) { out.user = userObj_(hit.r); out.token = token; } }
    } catch (e) { }
  }
  if (!out.user && !out.teacher) {
    var email = '';
    try { email = Session.getActiveUser().getEmail(); } catch (e) { }
    var byMail = findByEmail_(email);
    if (byMail) { var iss = issueStudent_(byMail); out.user = iss.user; out.token = iss.token; out.auto = true; }
    out.email = email;
  }
  if (out.user) out.home = homeData_(out.user.account);
  return out;
}

function homeData_(account) {
  var open = openChapters_();
  var list = catalog_().filter(function (x) { return !open || open[x.ch]; });
  return { chapters: list, progress: progress_(account) };
}

function apiLogin(account, password, name) {
  account = str_(account); password = str_(password);
  if (!account || !password) throw new Error('請輸入帳號與密碼');
  var hit = findStudent_(account);
  if (!hit) throw new Error('查無此帳號。名單外的同學請改用「自行註冊」。');
  var stored = str_(hit.r[1]);
  if (!stored) {
    if (!str_(name)) return { needSetup: true };
    if (str_(name) !== str_(hit.r[2])) throw new Error('姓名與名單不符，請洽老師');
    if (password.length < 4) throw new Error('密碼至少 4 個字元');
    sh_(SHEET.ROSTER).getRange(hit.row, 2).setValue(hash_(password));
  } else if (!checkPw_(stored, password)) {
    throw new Error('密碼錯誤。忘記密碼請洽老師清空密碼欄後重設。');
  } else if (stored.indexOf('sha256$') !== 0) {
    sh_(SHEET.ROSTER).getRange(hit.row, 2).setValue(hash_(password));
  }
  var iss = issueStudent_(hit);
  iss.home = homeData_(iss.user.account);
  return iss;
}

function apiRegister(f) {
  var set = getSettings_();
  if (!yes_(set['開放外人註冊'] || '是')) throw new Error('目前未開放自行註冊');
  var account = str_(f.account), pw = str_(f.password), name = str_(f.name);
  if (!/^[\w.@-]{3,40}$/.test(account)) throw new Error('帳號請用 3～40 個英數字（可含 . _ - @）');
  if (pw.length < 4) throw new Error('密碼至少 4 個字元');
  if (!name) throw new Error('請填姓名');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (findStudent_(account)) throw new Error('這個帳號已有人使用，請換一個');
    var cls = str_(f.cls) ? '【校外】' + str_(f.cls) : '【校外】';
    sh_(SHEET.ROSTER).appendRow([account, hash_(pw), name, cls, str_(f.seat), '', '自行註冊', str_(f.school), now_(), '']);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  var iss = issueStudent_(findStudent_(account));
  iss.home = homeData_(iss.user.account);
  return iss;
}

function apiHome(token) {
  var p = verify_(token, 's');
  return homeData_(p.a);
}

/* ---------- 訪客模式：免登入、不寫入任何紀錄 ---------- */
function apiGuestHome() {
  var g = guestChapters_(getSettings_());
  return { chapters: catalog_().map(function (c) { var x = JSON.parse(JSON.stringify(c)); x.guest = !!g[c.ch]; return x; }), progress: {} };
}
function apiGuestChapter(ch) {
  ch = Number(ch); var set = getSettings_();
  if (!guestChapters_(set)[ch]) throw new Error('本回需登入才能閱讀');
  var full = chapterFull_(ch);
  return { ch: ch, num: full.num, title: full.title, paras: full.paras, guest: true,
    ill: full.ill.filter(function (x) { return x.url || yes_(set['顯示未完成插圖'] || '是'); }),
    qs: full.qs.map(function (q) { return { no: q.no, type: q.type, stem: q.stem, opts: q.opts }; }),
    allowRetry: true, save: null, source: sourceOf_(set, ch, full.num) };
}
function apiGuestSubmit(ch, ans) {
  ch = Number(ch); var set = getSettings_();
  if (!guestChapters_(set)[ch]) throw new Error('本回需登入才能作答');
  var full = chapterFull_(ch); ans = ans || {};
  var missing = full.qs.filter(function (q) { return !str_(ans[q.no]); });
  if (missing.length) throw new Error('還有 ' + missing.length + ' 題未作答');
  return grade_(full, ans, yes_(set['交卷後顯示解析'] || '是'));
}

function apiChapter(token, ch) {
  var p = verify_(token, 's'); ch = Number(ch);
  var open = openChapters_();
  if (open && !open[ch]) throw new Error('本回尚未開放');
  var full = chapterFull_(ch), set = getSettings_();
  var hit = findSave_(p.a, ch), save = hit ? saveObj_(hit.r) : null;
  var showExp = yes_(set['交卷後顯示解析'] || '是');
  var out = { ch: ch, num: full.num, title: full.title, paras: full.paras,
    ill: full.ill.filter(function (x) { return x.url || yes_(set['顯示未完成插圖'] || '是'); }),
    qs: full.qs.map(function (q) { return { no: q.no, type: q.type, stem: q.stem, opts: q.opts }; }),
    allowRetry: yes_(set['允許重作'] || '是'), save: save, source: sourceOf_(set, ch, full.num) };
  if (save && save.submitted) out.result = grade_(full, save.lastAns || {}, showExp);
  return out;
}

function sourceOf_(set, ch, num) {
  var nnn = ('00' + ch).slice(-3);
  function link(v) {
    v = str_(v).replace(/\{回次\}/g, num).replace(/\{NNN\}/g, nnn); if (!v) return null;
    var i = v.indexOf('|'); return i < 0 ? { text: v, url: '' } : { text: v.slice(0, i), url: v.slice(i + 1) };
  }
  return { base: link(set['原文底本']), ref: link(set['參校本']), note: str_(set['校勘說明']) };
}

function grade_(full, ans, showExp) {
  var score = 0;
  var items = full.qs.map(function (q) {
    var mine = str_(ans[q.no]).toUpperCase(), ok = mine === q.ans;
    if (ok) score++;
    return { no: q.no, mine: mine, ans: q.ans, ok: ok, exp: showExp ? q.exp : '', para: q.para };
  });
  return { score: score, total: full.qs.length, items: items };
}

function cleanBm_(bm) {
  if (!bm || !bm.length) return [];
  return bm.slice(0, 30).map(function (x) { return { i: Number(x.i) || 0, t: str_(x.t).slice(0, 40), at: str_(x.at).slice(0, 20) }; })
    .filter(function (x) { return x.i > 0; });
}
function apiSaveDraft(token, ch, ans, pos, bm) {
  var p = verify_(token, 's'); ch = Number(ch);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var hit = findSave_(p.a, ch), t = now_();
    var old = hit ? saveObj_(hit.r).draft : null;
    var draft = JSON.stringify({ ans: ans || {}, pos: Number(pos) || 0, bm: bm ? cleanBm_(bm) : ((old && old.bm) || []) });
    if (hit) {
      var s = sh_(SHEET.SAVE);
      s.getRange(hit.row, 3).setValue(draft);
      s.getRange(hit.row, 12).setValue(t);
    } else {
      sh_(SHEET.SAVE).appendRow([p.a, ch, draft, '否', '', '', '', 0, '', '', '', t]);
    }
    return { ok: true, time: t };
  } finally { lock.releaseLock(); }
}

/** 只更新書籤與閱讀位置（交卷後仍可用） */
function apiSaveBookmarks(token, ch, bm, pos) {
  var p = verify_(token, 's'); ch = Number(ch);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var hit = findSave_(p.a, ch), t = now_();
    if (hit) {
      var d = saveObj_(hit.r).draft || { ans: {} };
      d.bm = cleanBm_(bm); if (pos !== undefined && pos !== null) d.pos = Number(pos) || 0;
      sh_(SHEET.SAVE).getRange(hit.row, 3).setValue(JSON.stringify(d));
    } else {
      sh_(SHEET.SAVE).appendRow([p.a, ch, JSON.stringify({ ans: {}, pos: Number(pos) || 0, bm: cleanBm_(bm) }), '否', '', '', '', 0, '', '', '', t]);
    }
    return { ok: true, time: t };
  } finally { lock.releaseLock(); }
}

function apiSubmit(token, ch, ans, pos) {
  var p = verify_(token, 's'); ch = Number(ch);
  var full = chapterFull_(ch), set = getSettings_();
  ans = ans || {};
  var missing = full.qs.filter(function (q) { return !str_(ans[q.no]); });
  if (missing.length) throw new Error('還有 ' + missing.length + ' 題未作答');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var hit = findSave_(p.a, ch), s = sh_(SHEET.SAVE), t = now_();
    var prev = hit ? saveObj_(hit.r) : null;
    if (prev && prev.submitted && !yes_(set['允許重作'] || '是')) throw new Error('本回已交卷，老師未開放重作');
    var res = grade_(full, ans, yes_(set['交卷後顯示解析'] || '是'));
    var tries = (prev ? prev.tries : 0) + 1;
    var first = prev && prev.first !== null ? prev.first : res.score;
    var best = prev && prev.best !== null ? Math.max(prev.best, res.score) : res.score;
    var row = [p.a, ch, JSON.stringify({ ans: ans, pos: Number(pos) || 0, bm: (prev && prev.draft && prev.draft.bm) || [] }), '是', first, best, res.score, tries,
      JSON.stringify(ans), prev && prev.firstTime ? prev.firstTime : t, t, t];
    if (hit) s.getRange(hit.row, 1, 1, row.length).setValues([row]); else s.appendRow(row);
    var st = findStudent_(p.a), u = st ? userObj_(st.r) : { name: '', cls: '', seat: '' };
    sh_(SHEET.LOG).appendRow([t, p.a, u.name, u.cls, u.seat, ch, JSON.stringify(ans), res.score, tries]);
    res.tries = tries; res.best = best;
    return res;
  } finally { lock.releaseLock(); }
}

/* ---------- 教師後台 ---------- */
function apiTeacherLogin(pw) {
  var set = getSettings_();
  if (!str_(pw) || str_(pw) !== str_(set['教師密碼'])) throw new Error('教師密碼錯誤');
  return { token: sign_({ a: 'teacher', r: 't', e: Date.now() + 1000 * 60 * 60 * 12 }) };
}

function apiTeacherData(token) {
  verify_(token, 't');
  var roster = rows_(SHEET.ROSTER).filter(function (r) { return str_(r[0]); }).map(function (r) {
    return { account: str_(r[0]), name: str_(r[2]), cls: str_(r[3]), seat: str_(r[4]), kind: str_(r[6]) || '校內',
      school: str_(r[7]), last: str_(r[9]), pwSet: !!str_(r[1]) };
  });
  var saves = rows_(SHEET.SAVE).filter(function (r) { return str_(r[0]); }).map(function (r) {
    var s = saveObj_(r); s.account = str_(r[0]); delete s.draft; return s;
  });
  var chapters = catalog_().map(function (c) {
    var f = chapterFull_(c.ch);
    return { ch: c.ch, num: c.num, title: c.title,
      qs: f.qs.map(function (q) { return { no: q.no, type: q.type, stem: q.stem, ans: q.ans }; }) };
  });
  return { roster: roster, saves: saves, chapters: chapters, time: now_() };
}

/** 另一種下載：在雲端硬碟產生一份試算表並回傳 xlsx 下載連結 */
function apiTeacherExportDrive(token, sheets, fileName) {
  verify_(token, 't');
  var ss = SpreadsheetApp.create(fileName || ('三國演義閱讀檢測_' + now_().replace(/[\/: ]/g, '')));
  sheets.forEach(function (s, i) {
    var sh = i === 0 ? ss.getSheets()[0].setName(s.name) : ss.insertSheet(s.name);
    if (s.rows.length) {
      var w = s.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
      var data = s.rows.map(function (r) { while (r.length < w) r.push(''); return r; });
      sh.getRange(1, 1, data.length, w).setValues(data);
      sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground('#efe4cc');
      sh.setFrozenRows(1);
    }
  });
  SpreadsheetApp.flush();
  return { url: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', sheetUrl: ss.getUrl() };
}

/** 內嵌插圖：專案內 img_回_序 檔案存放 JPEG 的 base64 */
function apiImage(name) {
  name = str_(name).replace(/^embed:/, '');
  if (!/^img_\d+_\d+$/.test(name)) throw new Error('圖片名稱錯誤');
  return 'data:image/jpeg;base64,' + HtmlService.createHtmlOutputFromFile(name).getContent().replace(/\s+/g, '');
}

/* ---------- 給之後插圖流程用：填入某回某張插圖的網址 ---------- */
function setIllustration(ch, no, urlOrId) {
  var data = rows_(SHEET.ILL);
  for (var i = 0; i < data.length; i++) {
    if (Number(data[i][0]) === Number(ch) && Number(data[i][1]) === Number(no)) {
      sh_(SHEET.ILL).getRange(i + 2, 7).setValue(urlOrId);
      CacheService.getScriptCache().remove('ch_' + ch);
      return true;
    }
  }
  return false;
}
