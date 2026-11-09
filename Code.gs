/**
 * 《三國演義》閱讀檢測網站 — Code.gs
 * 綁定 Google 試算表的 Apps Script。檔案：Code.gs、Seed.gs、Index.html
 * 第一次使用：在編輯器執行 setupSheets()，授權後再部署為網頁應用程式。
 */

var SHEET = {
  SET: '設定', ROSTER: '學生名單', TEXT: '原文', QB: '題庫',
  ILL: '插圖', SAVE: '存檔', LOG: '作答紀錄',
  NOTE: '註釋', PEOPLE: '人物', DEED: '人物事蹟', SUM: '回末小結',
  REL: '人物關係', PLACE: '地點事件', ANN: '公告', FIX: '錯題訂正', NAME: '專名', ASK: '詞語提問'
};
var HEAD = {
  '設定': ['項目', '值', '說明'],
  '學生名單': ['帳號', '密碼', '姓名', '班級', '座號', 'Email', '身分', '學校', '建立時間', '最近登入'],
  '原文': ['回', '回次', '回目', '段落序', '內文'],
  '題庫': ['回', '題號', '類型', '題幹', 'A', 'B', 'C', 'D', '答案', '解析', '對應段落'],
  '插圖': ['回', '序', '標題', '插在第幾段之後', '圖說', '生圖提示詞', '圖片網址或雲端檔案ID', '對話氣泡'],
  '存檔': ['帳號', '回', '草稿', '已交卷', '首次得分', '最高得分', '最近得分', '作答次數', '最近作答', '首次交卷時間', '最近交卷時間', '更新時間', '累計閱讀作答秒數', '首次開啟時間'],
  '作答紀錄': ['時間', '帳號', '姓名', '班級', '座號', '回', '作答', '得分', '第幾次', '累計閱讀作答秒數'],
  '註釋': ['回', '詞語', '注音', '解釋'],
  '人物': ['姓名', '別稱（逗號分隔）', '陣營', '首次出場回', '簡介（勿劇透）'],
  '人物事蹟': ['姓名', '回', '事蹟'],
  '回末小結': ['回', '本回大事（一行一件）', '名句', '想一想'],
  '人物關係': ['人物甲', '人物乙', '關係', '從第幾回起'],
  '地點事件': ['回', '序', '年代', '地點', '事件', '經度', '緯度'],
  '公告': ['編號', '建立時間', '對象班級（全部或逗號分隔）', '標題', '內容', '必讀回次（逗號分隔）', '截止日期', '置頂'],
  '錯題訂正': ['帳號', '回', '題號', '訂正時間'],
  '專名': ['回（0＝各回通用）', '詞', '類別（人名／地名／朝代／年號／書名）', '說明（選填，點詞時顯示）'],
  '詞語提問': ['時間', '帳號', '姓名', '班級', '回', '段落', '詞語']
};
var DEFAULT_SET = [
  ['網站標題', '三國演義・閱讀試煉', '顯示在網站最上方'],
  ['副標題', '古典小說閱讀檢測', ''],
  ['教師密碼', 'nanshan', '進入教師後台的密碼，請務必修改'],
  ['允許重作', '是', '是／否：交卷後可否再作答（成績記首次、最高、最近）'],
  ['交卷後顯示解析', '是', '是／否'],
  ['開放回數', '全部', '「全部」或以逗號列出，例如 1,2,3'],
  ['開放外人註冊', '是', '是／否：不在名單內的人能否自行註冊'],
  ['訪客試讀回數', '1', '免登入即可閱讀作答的回數，逗號分隔（例：1,2）；留空＝關閉訪客模式。訪客成績不記錄'],
  ['顯示未完成插圖', '是', '是／否：圖片網址還沒填時，是否顯示「畫卷待展」框'],
  ['原文底本', '好讀《三國演義》（2012年4月7日版）|https://www.haodoo.net/', '顯示於每回文末；「|」後為連結'],
  ['參校本', '維基文庫〈三國演義・{回次}〉|https://zh.wikisource.org/zh-hant/三國演義/第{NNN}回', '{回次}＝第一回，{NNN}＝001'],
  ['校勘說明', '字形依教育部標準字體調整；少數訛字據參校本及通行本改正。', ''],
  ['製作者', '闕宏宇', '顯示於「製作與版權說明」頁'],
  ['聯絡方式', '', '選填，例如電子郵件；顯示於說明頁'],
  ['排行榜', '是', '是／否：學生首頁顯示「班級挑戰與排行榜」'],
  ['排行榜姓名顯示', '遮蔽', '完整／遮蔽（遮蔽時顯示為「王○明」）'],
  ['全班挑戰目標', '80', '全班完成率目標（%）：全班已完成回次 ÷（人數 × 開放回數）'],
  ['授權聲明', '本站自行撰寫的題目、解析、註釋、人物小卡與回末小結，採用創用 CC「姓名標示─非商業性─相同方式分享 4.0」授權（CC BY-NC-SA 4.0），歡迎教學使用，請註明出處。', '顯示於說明頁，可自行改寫']
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
    } else if (sh.getLastColumn() < HEAD[name].length) {
      var from = sh.getLastColumn() + 1, add = HEAD[name].slice(from - 1);
      sh.getRange(1, from, 1, add.length).setValues([add]).setFontWeight('bold').setBackground('#efe4cc');
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
    var ir = SEED.illus.map(function (x) { return [x.ch, x.no, x.title, x.after, x.caption, x.prompt, x.url, x.talk || '']; });
    il.getRange(2, 1, ir.length, 8).setValues(ir);
  }
  seedIfEmpty_(SHEET.NOTE, (SEED.notes || []).map(function (x) { return [x.ch, x.w, x.zy, x.exp]; }));
  seedIfEmpty_(SHEET.PEOPLE, (SEED.people || []).map(function (x) { return [x.name, x.alias, x.camp, x.first, x.intro]; }));
  seedIfEmpty_(SHEET.DEED, (SEED.deeds || []).map(function (x) { return [x.name, x.ch, x.text]; }));
  seedIfEmpty_(SHEET.NAME, (SEED.names || []).map(function (x) { return [x.ch, x.w, x.k, x.note]; }));
  seedIfEmpty_(SHEET.REL, (SEED.rels || []).map(function (x) { return [x.a, x.b, x.rel, x.ch]; }));
  seedIfEmpty_(SHEET.PLACE, (SEED.places || []).map(function (x) { return [x.ch, x.no, x.year, x.place, x.event, x.lon, x.lat]; }));
  seedIfEmpty_(SHEET.SUM, (SEED.summary || []).map(function (x) { return [x.ch, x.events, x.quote, x.think]; }));
  var rs = ss.getSheetByName(SHEET.ROSTER);
  rs.getRange('A:A').setNumberFormat('@'); rs.getRange('B:B').setNumberFormat('@');
  getSecret_();
  clearContentCache();
}

function seedIfEmpty_(name, rows) {
  var sh = sh_(name);
  if (sh && sh.getLastRow() < 2 && rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function ensureSetup_() {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SHEET.QB) || !ss.getSheetByName(SHEET.SAVE) || !ss.getSheetByName(SHEET.SUM)) setupSheets();
}

function clearContentCache() {
  var c = CacheService.getScriptCache();
  var keys = ['catalog', 'settings', 'people', 'atlas'];
  for (var i = 1; i <= 120; i++) keys.push('ch_' + i);
  c.removeAll(keys);
}

/* ---------- 共用工具 ---------- */
function sh_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function rows_(name) {
  var s = sh_(name); if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
}
function str_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  return String(v).trim();
}
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
    return { no: Number(r[1]), title: str_(r[2]), after: Number(r[3]) || 0, caption: str_(r[4]), url: imgUrl_(r[6]), talk: parseTalk_(r[7]) };
  }).sort(function (a, b) { return a.no - b.no; });
  var notes = rows_(SHEET.NOTE).filter(function (r) { return Number(r[0]) === ch && str_(r[1]); })
    .map(function (r) { return { w: str_(r[1]), zy: str_(r[2]), exp: str_(r[3]) }; });
  var names = rows_(SHEET.NAME).filter(function (r) { var c = Number(r[0]) || 0; return (c === 0 || c === ch) && str_(r[1]); })
    .map(function (r) { return { w: str_(r[1]), k: str_(r[2]) || '人名', note: str_(r[3]) }; });
  var sm = rows_(SHEET.SUM).filter(function (r) { return Number(r[0]) === ch; })[0];
  var summary = sm ? { events: str_(sm[1]).split(/\n+/).filter(String), quote: str_(sm[2]), think: str_(sm[3]) } : null;
  var o = { ch: ch, num: num, title: title, paras: paras, qs: qs, ill: ill, notes: notes, names: names, summary: summary };
  try { c.put(key, JSON.stringify(o), 600); } catch (e) { }
  return o;
}

/* ---------- 人物 ---------- */
function peopleAll_() {
  var c = CacheService.getScriptCache(), hit = c.get('people');
  if (hit) return JSON.parse(hit);
  var deeds = {};
  rows_(SHEET.DEED).forEach(function (r) { var n = str_(r[0]); if (n) (deeds[n] = deeds[n] || []).push({ ch: Number(r[1]) || 0, t: str_(r[2]) }); });
  var list = rows_(SHEET.PEOPLE).filter(function (r) { return str_(r[0]); }).map(function (r) {
    var n = str_(r[0]);
    return { name: n, alias: str_(r[1]).split(/[,，、]/).map(str_).filter(function (x) { return x.length >= 2; }),
      camp: str_(r[2]), first: Number(r[3]) || 1, intro: str_(r[4]),
      deeds: (deeds[n] || []).sort(function (a, b) { return a.ch - b.ch; }) };
  });
  try { c.put('people', JSON.stringify(list), 600); } catch (e) { }
  return list;
}
/** 只給讀到第 ch 回為止的資訊，避免劇透 */
function peopleFor_(ch) {
  return peopleAll_().filter(function (p) { return p.first <= ch; }).map(function (p) {
    return { name: p.name, alias: p.alias, camp: p.camp, first: p.first, intro: p.intro, deeds: p.deeds.filter(function (d) { return d.ch <= ch; }) };
  });
}

/* ---------- 人物關係圖・地圖與時間軸（只給已讀到的回次） ---------- */
function atlasAll_() {
  var c = CacheService.getScriptCache(), hit = c.get('atlas');
  if (hit) return JSON.parse(hit);
  var o = {
    rels: rows_(SHEET.REL).filter(function (r) { return str_(r[0]) && str_(r[1]); })
      .map(function (r) { return { a: str_(r[0]), b: str_(r[1]), rel: str_(r[2]), ch: Number(r[3]) || 1 }; }),
    places: rows_(SHEET.PLACE).filter(function (r) { return Number(r[0]) && str_(r[3]); })
      .map(function (r) { return { ch: Number(r[0]), no: Number(r[1]) || 0, year: str_(r[2]), place: str_(r[3]), event: str_(r[4]), lon: Number(r[5]), lat: Number(r[6]) }; })
      .sort(function (a, b) { return a.ch - b.ch || a.no - b.no; })
  };
  try { c.put('atlas', JSON.stringify(o), 600); } catch (e) { }
  return o;
}
function atlas_(reach) {
  var all = atlasAll_();
  return { reach: reach, chapters: catalog_().map(function (c) { return { ch: c.ch, num: c.num, title: c.title }; }),
    people: peopleFor_(reach), rels: all.rels.filter(function (r) { return r.ch <= reach; }),
    places: all.places.filter(function (p) { return p.ch <= reach; }) };
}
function apiAtlas(token) {
  var p = verify_(token, 's'), pr = progress_(p.a), reach = 1;
  Object.keys(pr).forEach(function (k) { reach = Math.max(reach, Number(k)); });
  return atlas_(reach);
}
function apiGuestAtlas() {
  var g = Object.keys(guestChapters_(getSettings_())).map(Number);
  if (!g.length) throw new Error('訪客模式未開放');
  return atlas_(Math.max.apply(null, g));
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
    lastAns: j(r[8]), firstTime: str_(r[9]), lastTime: str_(r[10]), updated: str_(r[11]),
    spent: Number(r[12]) || 0, opened: str_(r[13]) };
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
    guestChapters: Object.keys(guestChapters_(set)).map(Number),
    about: { maker: set['製作者'] || '', contact: set['聯絡方式'] || '', license: set['授權聲明'] || '',
      base: sourceOf_(set, 1, '第一回').base, refRoot: 'https://zh.wikisource.org/zh-hant/三國演義', note: set['校勘說明'] || '' } };
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
  var st = findStudent_(account), cls = st ? str_(st.r[3]) : '';
  var out = { chapters: list, progress: progress_(account), ann: annFor_(cls) };
  try { out.board = board_(account, cls, list.length); } catch (e) { out.board = null; }
  return out;
}

/* ---------- 公告與必讀 ---------- */
function annAll_() {
  return rows_(SHEET.ANN).filter(function (r) { return str_(r[0]) && str_(r[3]); }).map(function (r) {
    return { id: str_(r[0]), time: str_(r[1]), to: str_(r[2]) || '全部', title: str_(r[3]), body: str_(r[4]),
      chs: str_(r[5]).split(/[,，、\s]+/).map(Number).filter(Boolean), due: dateStr_(r[6]), pin: yes_(r[7]) };
  });
}
function dateStr_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy/MM/dd');
  return str_(v).replace(/-/g, '/').slice(0, 10);
}
function annFor_(cls) {
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
  return annAll_().filter(function (a) {
    var to = a.to.split(/[,，、\s]+/).filter(String);
    var hit = a.to === '全部' || to.indexOf('全部') >= 0 || (cls && to.indexOf(cls) >= 0);
    var alive = !a.due || a.due >= today || a.pin;
    return hit && alive;
  }).sort(function (x, y) { return (y.pin - x.pin) || (y.time > x.time ? 1 : -1); }).slice(0, 8);
}

/* ---------- 班級挑戰與排行榜 ---------- */
function maskName_(n) {
  n = str_(n); if (n.length <= 1) return n || '同學';
  if (n.length === 2) return n[0] + '○';
  return n[0] + new Array(n.length - 1).join('○') + n[n.length - 1];
}
function board_(account, cls, nOpen) {
  var set = getSettings_();
  if (!yes_(set['排行榜'] || '是') || !cls) return null;
  var me = str_(account).toLowerCase(), full = str_(set['排行榜姓名顯示']) === '完整';
  var mates = {};
  rows_(SHEET.ROSTER).forEach(function (r) {
    if (str_(r[0]) && str_(r[3]) === cls) mates[str_(r[0]).toLowerCase()] = { name: str_(r[2]), done: 0, best: 0, perfect: 0, last: '' };
  });
  var qn = {}; catalog_().forEach(function (c) { qn[c.ch] = c.qn; });
  var open = openChapters_();
  rows_(SHEET.SAVE).forEach(function (r) {
    var a = str_(r[0]).toLowerCase(), m = mates[a]; if (!m) return;
    var s = saveObj_(r); if (!s.submitted || (open && !open[s.ch])) return;
    m.done++; m.best += s.best || 0; if (qn[s.ch] && s.best === qn[s.ch]) m.perfect++;
    if (s.firstTime > m.last) m.last = s.firstTime;
  });
  var list = Object.keys(mates).map(function (k) { var m = mates[k]; m.acc = k; return m; });
  list.sort(function (x, y) { return y.done - x.done || y.best - x.best || y.perfect - x.perfect || (x.last < y.last ? -1 : 1); });
  var rank = 0, prev = null;
  list.forEach(function (m, i) { var key = m.done + '/' + m.best; if (key !== prev) rank = i + 1; prev = key; m.rank = rank; });
  var shown = function (m) { return { rank: m.rank, name: m.acc === me || full ? m.name : maskName_(m.name), done: m.done, best: m.best, perfect: m.perfect, me: m.acc === me }; };
  var mine = list.filter(function (m) { return m.acc === me; })[0];
  var done = list.reduce(function (t, m) { return t + m.done; }, 0), possible = list.length * nOpen;
  var target = Math.max(1, Math.min(100, Number(set['全班挑戰目標']) || 80));
  return { cls: cls, n: list.length, top: list.filter(function (m) { return m.done > 0; }).slice(0, 10).map(shown), me: mine ? shown(mine) : null,
    challenge: { done: done, possible: possible, goal: Math.ceil(possible * target / 100), target: target } };
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
    allowRetry: true, save: null, source: sourceOf_(set, ch, full.num), notes: full.notes || [], names: full.names || [], people: peopleFor_(ch) };
}
function apiGuestSubmit(ch, ans) {
  ch = Number(ch); var set = getSettings_();
  if (!guestChapters_(set)[ch]) throw new Error('本回需登入才能作答');
  var full = chapterFull_(ch); ans = ans || {};
  var missing = full.qs.filter(function (q) { return !str_(ans[q.no]); });
  if (missing.length) throw new Error('還有 ' + missing.length + ' 題未作答');
  var g = grade_(full, ans, yes_(set['交卷後顯示解析'] || '是')); g.summary = full.summary; return g;
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
    allowRetry: yes_(set['允許重作'] || '是'), save: save, source: sourceOf_(set, ch, full.num),
    notes: full.notes || [], names: full.names || [], people: peopleFor_(ch) };
  if (save && save.submitted) { out.result = grade_(full, save.lastAns || {}, showExp); out.result.summary = full.summary; }
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
function cleanSpent_(v, prev) {
  v = Math.round(Number(v) || 0);
  if (v < 0) v = 0;
  if (v > 86400) v = 86400;
  return Math.max(v, prev || 0);
}
function apiSaveDraft(token, ch, ans, pos, bm, spent) {
  var p = verify_(token, 's'); ch = Number(ch);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var hit = findSave_(p.a, ch), t = now_();
    var prevObj = hit ? saveObj_(hit.r) : null, old = prevObj ? prevObj.draft : null;
    var draft = JSON.stringify({ ans: ans || {}, pos: Number(pos) || 0, bm: bm ? cleanBm_(bm) : ((old && old.bm) || []) });
    var sp = cleanSpent_(spent, prevObj ? prevObj.spent : 0);
    if (hit) {
      var s = sh_(SHEET.SAVE);
      s.getRange(hit.row, 3).setValue(draft);
      s.getRange(hit.row, 12, 1, 2).setValues([[t, sp]]);
      if (!prevObj.opened) s.getRange(hit.row, 14).setValue(t);
    } else {
      sh_(SHEET.SAVE).appendRow([p.a, ch, draft, '否', '', '', '', 0, '', '', '', t, sp, t]);
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

function apiSubmit(token, ch, ans, pos, spent) {
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
      JSON.stringify(ans), prev && prev.firstTime ? prev.firstTime : t, t, t,
      cleanSpent_(spent, prev ? prev.spent : 0), prev && prev.opened ? prev.opened : t];
    if (hit) s.getRange(hit.row, 1, 1, row.length).setValues([row]); else s.appendRow(row);
    var st = findStudent_(p.a), u = st ? userObj_(st.r) : { name: '', cls: '', seat: '' };
    sh_(SHEET.LOG).appendRow([t, p.a, u.name, u.cls, u.seat, ch, JSON.stringify(ans), res.score, tries, row[12]]);
    res.tries = tries; res.best = best; res.summary = full.summary;
    return res;
  } finally { lock.releaseLock(); }
}

/* ---------- 錯題本 ---------- */
function apiMistakes(token) {
  var p = verify_(token, 's'), a = str_(p.a).toLowerCase(), showExp = yes_(getSettings_()['交卷後顯示解析'] || '是'), out = [];
  rows_(SHEET.SAVE).forEach(function (r) {
    if (str_(r[0]).toLowerCase() !== a) return;
    var s = saveObj_(r); if (!s.submitted || !s.lastAns) return;
    var full = chapterFull_(s.ch);
    full.qs.forEach(function (q) {
      var mine = str_(s.lastAns[q.no]).toUpperCase();
      if (mine !== q.ans) out.push({ ch: s.ch, num: full.num, title: full.title, no: q.no, type: q.type, stem: q.stem, opts: q.opts,
        ans: q.ans, mine: mine, exp: showExp ? q.exp : '', para: q.para });
    });
  });
  var fx = {};
  rows_(SHEET.FIX).forEach(function (r) { if (str_(r[0]).toLowerCase() === a) fx[Number(r[1]) + '-' + Number(r[2])] = 1; });
  out.forEach(function (m) { m.fixed = !!fx[m.ch + '-' + m.no]; });
  out.sort(function (x, y) { return x.ch - y.ch || x.no - y.no; });
  return out;
}
/** 錯題訂正：記錄到試算表，換裝置也看得到 */
function apiMarkFixed(token, list) {
  var p = verify_(token, 's'), a = str_(p.a).toLowerCase(), have = {}, t = now_(), add = [];
  rows_(SHEET.FIX).forEach(function (r) { if (str_(r[0]).toLowerCase() === a) have[Number(r[1]) + '-' + Number(r[2])] = 1; });
  (list || []).slice(0, 60).forEach(function (x) {
    var ch = Number(x.ch), no = Number(x.no), k = ch + '-' + no;
    if (ch && no && !have[k]) { have[k] = 1; add.push([p.a, ch, no, t]); }
  });
  if (add.length) { var s = sh_(SHEET.FIX); s.getRange(s.getLastRow() + 1, 1, add.length, 4).setValues(add); }
  return add.length;
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
      return { no: Number(r[1]), type: str_(r[2]), stem: str_(r[3]), opts: [str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7])], ans: str_(r[8]).toUpperCase(), exp: str_(r[9]), para: Number(r[10]) || 0 };
    }).sort(function (a, b) { return a.no - b.no; }) };
}
function apiTeacherSaveQ(token, q) {
  verify_(token, 't'); q = q || {};
  var ch = Number(q.ch), stem = str_(q.stem), opts = (q.opts || []).map(str_), ans = str_(q.ans).toUpperCase();
  if (!ch) throw new Error('回次錯誤');
  if (!stem) throw new Error('請填題幹');
  if (opts.length !== 4 || opts.some(function (o) { return !o; })) throw new Error('四個選項都要填');
  if ('ABCD'.indexOf(ans) < 0 || ans.length !== 1) throw new Error('答案請選 A～D');
  var type = ['劇情', '人物', '意象', '修辭'].indexOf(str_(q.type)) >= 0 ? str_(q.type) : '劇情';
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = sh_(SHEET.QB), data = rows_(SHEET.QB), no = Number(q.no) || 0, max = 0;
    var row = [ch, no, type, stem, opts[0], opts[1], opts[2], opts[3], ans, str_(q.exp), Number(q.para) || ''];
    for (var i = 0; i < data.length; i++) {
      if (Number(data[i][0]) !== ch) continue;
      max = Math.max(max, Number(data[i][1]) || 0);
      if (no && Number(data[i][1]) === no) { s.getRange(i + 2, 1, 1, 11).setValues([row]); clearContentCache(); return apiTeacherQs(token, ch); }
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
  var p = verify_(token, 's'); ch = Number(ch); word = str_(word).replace(/[\s，。、；：？！「」『』（）]/g, '').slice(0, 12);
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
