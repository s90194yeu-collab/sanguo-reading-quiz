/* 三國演義閱讀檢測：教師後台、註釋、插圖（Apps Script 會把所有 .gs 合在同一個全域範圍執行） */
/* ---------- 教師後台 ---------- */
function apiTeacherLogin(pw) {
  var set = getSettings_();
  if (!str_(pw) || str_(pw) !== str_(set['教師密碼'])) throw new Error('教師密碼錯誤');
  return { token: issueTeacher_('').token };
}

/** 前端 Google Identity Services 登入：驗證 id_token，教師信箱進後台並全解鎖，學生信箱比對名單登入 */
function apiGoogleLogin(idToken) {
  var set = getSettings_(), cid = str_(set['Google登入ClientID']);
  if (!cid) throw new Error('尚未設定 Google 登入 Client ID');
  idToken = str_(idToken);
  if (!idToken) throw new Error('缺少 Google 登入憑證');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Google 身分驗證失敗，請重試');
  var info = JSON.parse(res.getContentText() || '{}');
  if (str_(info.aud) !== cid) throw new Error('Google Client ID 不符');
  if (!(info.email_verified === true || str_(info.email_verified).toLowerCase() === 'true')) throw new Error('Google 信箱尚未通過驗證');
  if (info.exp && Number(info.exp) * 1000 < Date.now()) throw new Error('Google 登入憑證已過期，請重新登入');
  var email = str_(info.email).toLowerCase();
  if (!email) throw new Error('無法取得 Google 信箱');
  if (isTeacherEmail_(email, set)) {
    var t = issueTeacher_(email);
    return { teacher: true, token: t.token, email: email };
  }
  var byMail = findByEmail_(email);
  if (byMail) {
    var iss = issueStudent_(byMail);
    iss.home = homeData_(iss.user.account);
    iss.email = email;
    return iss;
  }
  throw new Error('帳號 ' + email + ' 不是教師信箱，也尚未登錄在學生名單中');
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
    return { ch: c.ch, num: c.num, title: c.title, qn: c.qn,
      qs: f.qs.map(function (q) {
        var pr = f.paras.filter(function (x) { return x.i === q.para; })[0];
        return { no: q.no, type: q.type, stem: q.stem, ans: q.ans, para: q.para, paraText: pr ? pr.t.replace(/^〔詩〕/, '') : '' };
      }) };
  });
  var fixes = rows_(SHEET.FIX).filter(function (r) { return str_(r[0]); }).map(function (r) { return { account: str_(r[0]), ch: Number(r[1]), no: Number(r[2]) }; });
  return { roster: roster, saves: saves, chapters: chapters, anns: annAll_(), fixes: fixes, time: now_() };
}

/* ---------- 教師：公告 ---------- */
function apiTeacherSaveAnn(token, a) {
  verify_(token, 't'); a = a || {};
  var title = str_(a.title).slice(0, 60); if (!title) throw new Error('請填標題');
  var chs = (a.chs || []).map(Number).filter(Boolean).join(',');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = sh_(SHEET.ANN), data = rows_(SHEET.ANN), id = str_(a.id);
    var row = [id || ('A' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), now_(), str_(a.to) || '全部', title, str_(a.body).slice(0, 1000), chs, str_(a.due), a.pin ? '是' : ''];
    s.getRange('A:A').setNumberFormat('@'); s.getRange('F:G').setNumberFormat('@');
    for (var i = 0; i < data.length; i++) if (id && str_(data[i][0]) === id) { row[1] = str_(data[i][1]); s.getRange(i + 2, 1, 1, 8).setValues([row]); return annAll_(); }
    s.appendRow(row);
    return annAll_();
  } finally { lock.releaseLock(); }
}
function apiTeacherDelAnn(token, id) {
  verify_(token, 't');
  var data = rows_(SHEET.ANN);
  for (var i = data.length - 1; i >= 0; i--) if (str_(data[i][0]) === str_(id)) sh_(SHEET.ANN).deleteRow(i + 2);
  return annAll_();
}

/* ---------- 教師：題庫管理 ---------- */
function apiTeacherQs(token, ch) {
  verify_(token, 't'); ch = Number(ch);
  var f = chapterFull_(ch);
  return { ch: ch, num: f.num, title: f.title, nParas: f.paras.length,
    qs: rows_(SHEET.QB).filter(function (r) { return Number(r[0]) === ch; }).map(function (r) {
      return { no: Number(r[1]), type: str_(r[2]), stem: str_(r[3]), opts: [str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7])], ans: str_(r[8]).toUpperCase(), exp: str_(r[9]), para: Number(r[10]) || 0, who: str_(r[11]) };
    }).sort(function (a, b) { return a.no - b.no; }) };
}
function apiTeacherSaveQ(token, q) {
  verify_(token, 't'); q = q || {};
  var ch = Number(q.ch), stem = str_(q.stem), opts = (q.opts || []).map(str_), ans = str_(q.ans).toUpperCase();
  if (!ch) throw new Error('回次錯誤');
  if (!stem) throw new Error('請填題幹');
  if (opts.length !== 4 || opts.some(function (o) { return !o; })) throw new Error('四個選項都要填');
  if ('ABCD'.indexOf(ans) < 0 || ans.length !== 1) throw new Error('答案請選 A～D');
  var type = ['文意理解', '人物', '概念', '劇情', '意象', '修辭'].indexOf(str_(q.type)) >= 0 ? str_(q.type) : '文意理解';
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = sh_(SHEET.QB), data = rows_(SHEET.QB), no = Number(q.no) || 0, max = 0;
    var row = [ch, no, type, stem, opts[0], opts[1], opts[2], opts[3], ans, str_(q.exp), Number(q.para) || '', str_(q.who)];
    for (var i = 0; i < data.length; i++) {
      if (Number(data[i][0]) !== ch) continue;
      max = Math.max(max, Number(data[i][1]) || 0);
      if (no && Number(data[i][1]) === no) { if (q.who === undefined) row[11] = str_(data[i][11]); s.getRange(i + 2, 1, 1, 12).setValues([row]); clearContentCache(); return apiTeacherQs(token, ch); }
    }
    row[1] = max + 1; s.appendRow(row);
    clearContentCache();
    return apiTeacherQs(token, ch);
  } finally { lock.releaseLock(); }
}
function apiTeacherDelQ(token, ch, no) {
  verify_(token, 't'); ch = Number(ch); no = Number(no);
  var data = rows_(SHEET.QB);
  for (var i = data.length - 1; i >= 0; i--) if (Number(data[i][0]) === ch && Number(data[i][1]) === no) sh_(SHEET.QB).deleteRow(i + 2);
  clearContentCache();
  return apiTeacherQs(token, ch);
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

/** 對話氣泡：每行「類型|說話者|x|y|寬|尾x|尾y|文字」，座標與寬度為圖片寬高的百分比；類型：說／想／吼／白 */
function parseTalk_(v) {
  return str_(v).split(/\n+/).map(function (ln) {
    var a = ln.split('|');
    if (a.length < 8) return null;
    var n = function (i) { return Math.max(0, Math.min(100, Number(a[i]) || 0)); };
    return { k: str_(a[0]).trim(), who: str_(a[1]).trim(), x: n(2), y: n(3), w: n(4) || 30, tx: n(5), ty: n(6), t: a.slice(7).join('|').trim() };
  }).filter(function (b) { return b && b.t; });
}

/** 第1回改為三格漫畫版：以 Seed 內容取代「插圖」工作表第1回的列（其餘回不動），並清除快取 */
function applyComicChapter1() {
  var sh = sh_(SHEET.ILL), data = rows_(SHEET.ILL);
  for (var i = data.length - 1; i >= 0; i--) if (Number(data[i][0]) === 1) sh.deleteRow(i + 2);
  var rows = SEED.illus.filter(function (x) { return x.ch === 1; })
    .map(function (x) { return [x.ch, x.no, x.title, x.after, x.caption, x.prompt, x.url, x.talk || '']; });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  clearContentCache();
  return rows.length;
}

/** 更新用：把 Seed 裡新增的註釋與專名補進試算表（已有的不動），並清除快取 */
function syncNotesAndNames() {
  var add = function (name, seed, key, row) {
    var have = {}, sh = sh_(name);
    rows_(name).forEach(function (r) { have[key(r[0], r[1])] = 1; });
    var rows = (seed || []).filter(function (x) { return !have[key(x.ch, x.w)]; }).map(row);
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return rows.length;
  };
  var k = function (c, w) { return (Number(c) || 0) + '|' + str_(w); };
  var n1 = add(SHEET.NOTE, SEED.notes, k, function (x) { return [x.ch, x.w, x.zy, x.exp]; });
  var n2 = add(SHEET.NAME, SEED.names, k, function (x) { return [x.ch, x.w, x.k, x.note]; });
  clearContentCache();
  return '新增註釋 ' + n1 + ' 條、專名 ' + n2 + ' 條';
}

/* ---------- 學生標記看不懂的詞語 → 教師加註 ---------- */
function apiAskWord(token, ch, para, word) {
  var p = authAny_(token); if (p.r === 't') return { ok: true, skipped: true };
  ch = Number(ch); word = str_(word).replace(/[\s，。、；：？！「」『』（）]/g, '').slice(0, 12);
  if (!ch || word.length < 1) throw new Error('請選取要詢問的詞語');
  var a = str_(p.a).toLowerCase(), mine = 0;
  var data = rows_(SHEET.ASK);
  for (var i = 0; i < data.length; i++) {
    if (str_(data[i][1]).toLowerCase() !== a || Number(data[i][4]) !== ch) continue;
    if (str_(data[i][6]) === word) return { ok: true, dup: true };
    mine++;
  }
  if (mine >= 40) throw new Error('本回已標記很多詞語了，先請老師整理吧');
  var st = findStudent_(p.a), u = st ? userObj_(st.r) : { name: '', cls: '' };
  sh_(SHEET.ASK).appendRow([now_(), p.a, u.name, u.cls, ch, Number(para) || '', word]);
  return { ok: true };
}
function apiTeacherWords(token) {
  verify_(token, 't');
  var noted = {};
  rows_(SHEET.NOTE).forEach(function (r) { noted[Number(r[0]) + '|' + str_(r[1])] = 1; });
  var g = {};
  rows_(SHEET.ASK).forEach(function (r) {
    var ch = Number(r[4]), w = str_(r[6]); if (!ch || !w) return;
    var k = ch + '|' + w, x = g[k] = g[k] || { ch: ch, w: w, n: 0, cls: {}, paras: {}, last: '' };
    x.n++; if (str_(r[3])) x.cls[str_(r[3])] = 1; if (Number(r[5])) x.paras[Number(r[5])] = 1;
    var t = str_(r[0]); if (t > x.last) x.last = t;
  });
  var list = Object.keys(g).map(function (k) {
    var x = g[k]; return { ch: x.ch, w: x.w, n: x.n, cls: Object.keys(x.cls), paras: Object.keys(x.paras).map(Number), last: x.last, noted: !!noted[k] };
  });
  list.sort(function (a, b) { return (a.noted - b.noted) || b.n - a.n || a.ch - b.ch; });
  return { words: list, chapters: catalog_().map(function (c) { return { ch: c.ch, num: c.num }; }) };
}
function apiTeacherAddNote(token, x) {
  verify_(token, 't'); x = x || {};
  var ch = Number(x.ch), w = str_(x.w), exp = str_(x.exp);
  if (!ch || !w) throw new Error('請填回次與詞語');
  if (!exp) throw new Error('請填解釋');
  var data = rows_(SHEET.NOTE), sh = sh_(SHEET.NOTE), row = [ch, w, str_(x.zy), exp];
  var hit = -1;
  for (var i = 0; i < data.length; i++) if (Number(data[i][0]) === ch && str_(data[i][1]) === w) hit = i;
  if (hit >= 0) sh.getRange(hit + 2, 1, 1, 4).setValues([row]); else sh.appendRow(row);
  clearContentCache();
  return apiTeacherWords(token);
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

