/**
 * 《三國演義》閱讀檢測網站 — Code.gs
 * 綁定 Google 試算表的 Apps Script。檔案：Code.gs、Seed.gs、Index.html
 * 第一次使用：在編輯器執行 setupSheets()，授權後再部署為網頁應用程式。
 */

var SHEET = {
  SET: '設定', ROSTER: '學生名單', TEXT: '原文', QB: '題庫',
  ILL: '插圖', SAVE: '存檔', LOG: '作答紀錄',
  NOTE: '註釋', PEOPLE: '人物', DEED: '人物事蹟', SUM: '回末小結',
  REL: '人物關係', PLACE: '地點事件', ANN: '公告', FIX: '錯題訂正', NAME: '專名', ASK: '詞語提問', BF: '戰況',
  LOOK: '人物造型', FAC: '勢力', STAT: '回目狀態'
};
var HEAD = {
  '設定': ['項目', '值', '說明'],
  '學生名單': ['帳號', '密碼', '姓名', '班級', '座號', 'Email', '身分', '學校', '建立時間', '最近登入'],
  '原文': ['回', '回次', '回目', '段落序', '內文'],
  '題庫': ['回', '題號', '類型', '題幹', 'A', 'B', 'C', 'D', '答案', '解析', '對應段落', '人物'],
  '插圖': ['回', '序', '標題', '插在第幾段之後', '圖說', '生圖提示詞', '圖片網址或雲端檔案ID', '對話氣泡'],
  '存檔': ['帳號', '回', '草稿', '已交卷', '首次得分', '最高得分', '最近得分', '作答次數', '最近作答', '首次交卷時間', '最近交卷時間', '更新時間', '累計閱讀作答秒數', '首次開啟時間'],
  '作答紀錄': ['時間', '帳號', '姓名', '班級', '座號', '回', '作答', '得分', '第幾次', '累計閱讀作答秒數'],
  '註釋': ['回', '詞語', '注音', '解釋'],
  '人物': ['姓名', '別稱（逗號分隔）', '陣營', '首次出場回', '簡介（勿劇透）'],
  '人物事蹟': ['姓名', '回', '事蹟'],
  '回末小結': ['回', '本回大事（一行一件）', '名句', '想一想'],
  '人物關係': ['人物甲', '人物乙', '關係', '從第幾回起'],
  '地點事件': ['回', '序', '年代', '地點', '事件', '經度', '緯度', '勢力（此地此時屬誰；勢力版圖用，空白＝不著色）'],
  '公告': ['編號', '建立時間', '對象班級（全部或逗號分隔）', '標題', '內容', '必讀回次（逗號分隔）', '截止日期', '置頂'],
  '錯題訂正': ['帳號', '回', '題號', '訂正時間'],
  '專名': ['回（0＝各回通用）', '詞', '類別（人名／地名／朝代／年號／書名）', '說明（選填，點詞時顯示）'],
  '詞語提問': ['時間', '帳號', '姓名', '班級', '回', '段落', '詞語'],
  '戰況': ['回', '段', '錨句（該段中的一句話，戰況從這句起換畫面；空白＝段首）', '場景（軍陣／單挑／謀略／平時）', '標題', '甲方名稱', '甲方人物（頓號分隔）', '甲方兵力（原文有寫才填）', '甲方勢（佔優／相持／潰敗）', '乙方名稱', '乙方人物', '乙方兵力', '乙方勢', '說明（依文意示意）', '依據段',
    '背景（戰場／黃昏／夜／桃園／水戰／攻城／火攻／宮廷／營帳；空白＝依場景）', '騎馬（甲／乙／雙方；空白＝步戰）', '頭像人物（說明列左側；空白＝甲方第一人）',
    '甲方勢力（對照「勢力」表；空白＝依關鍵字判斷）', '乙方勢力', '預測問題（不計分，讀到這幕時詢問；空白＝無）', '預測選項（｜分隔，2～4 個）'],
  '人物造型': ['人物或關鍵字', '比對（姓名／關鍵字）', '頭飾（盔／頭巾／冠／亂髮／幘／兜帽／光頭）', '鬍鬚（無／長鬚／虯髯／八字／山羊）', '武器（劍／雙劍／矛／偃月刀／戟／羽扇／弓／無）',
    '髮或盔色', '盔纓或頭巾色', '甲色', '衣色', '膚色', '鬍色', '坐騎色', '備註'],
  '勢力': ['勢力', '主色', '副色', '關鍵字（軍名或人名含這些字就套用；頓號分隔）', '說明'],
  '回目狀態': ['回', '狀態（草稿／待審／上架／下架）', '匯入時間', '審核時間', '備註']
};
var DEFAULT_SET = [
  ['網站標題', '三國演義・閱讀試煉', '顯示在網站最上方'],
  ['副標題', '古典小說閱讀檢測', ''],
  ['教師密碼', 'nanshan', '進入教師後台的密碼，請務必修改'],
  ['教師Email', 's90194yeu@gm.nssh.ntpc.edu.tw,cpbl90194@gmail.com', '允許以 Google 帳號直接進入教師後台並全解鎖內容的信箱（逗號分隔）'],
  ['Google登入ClientID', '', '選填：填入 Google OAuth 2.0 Web Client ID 後，登入頁會顯示「以 Google 帳號登入」按鈕（適用公開網址及一般 Gmail）'],
  ['每次抽題數', '10', '每次出征從題庫隨機抽幾題（題庫題數不足時全出）；改完請按「清除網站快取」'],
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
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(getSettings_()['網站標題'] || '三國演義・閱讀試煉')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 把另一個 HTML 檔的內容原樣併入（Index.html 用 <?!= include('檔名') ?>） */
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('三國演義閱讀檢測')
    .addItem('初始化／補建工作表', 'setupSheets')
    .addItem('第一回題庫更新為 20 題', 'applyQuestionBank1')
    .addItem('第一回戰況更新（隨原文顯示勝負）', 'applyBattleData1')
    .addSeparator()
    .addItem('匯入內容包（貼上 JSON，先檢查再寫入）', 'showImportDialog')
    .addItem('匯出內容包（某一回）', 'showExportDialog')
    .addItem('第一回升級（造型、勢力、戰況新欄位）', 'applyChapter1Upgrade')
    .addSeparator()
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
      return [q.ch, q.no, q.type, q.stem, q.opts[0], q.opts[1], q.opts[2], q.opts[3], q.ans, q.exp, q.para, q.who || ''];
    });
    qb.getRange(2, 1, qr.length, 12).setValues(qr);
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
  seedIfEmpty_(SHEET.PLACE, (SEED.places || []).map(function (x) { return [x.ch, x.no, x.year, x.place, x.event, x.lon, x.lat, x.fac || '']; }));
  seedIfEmpty_(SHEET.LOOK, (SEED.looks || []).map(lookRow_));
  seedIfEmpty_(SHEET.FAC, (SEED.factions || []).map(function (x) { return [x.name, x.c1, x.c2, x.keys, x.note]; }));
  seedIfEmpty_(SHEET.SUM, (SEED.summary || []).map(function (x) { return [x.ch, x.events, x.quote, x.think]; }));
  seedIfEmpty_(SHEET.BF, (SEED.bf || []).map(bfRow_));
  var rs = ss.getSheetByName(SHEET.ROSTER);
  rs.getRange('A:A').setNumberFormat('@'); rs.getRange('B:B').setNumberFormat('@');
  getSecret_();
  clearContentCache();
}

function bfRow_(x) {
  return [x.ch, x.para, x.anchor, x.scene, x.title, x.aName, x.aUnits, x.aTroops, x.aState, x.bName, x.bUnits, x.bTroops, x.bState, x.note, x.basis,
    x.bg || '', x.horse || '', x.face || '', x.aFac || '', x.bFac || '', x.pq || '', x.po || ''];
}
function lookRow_(x) { return [x.key, x.match || '姓名', x.head, x.beard, x.weapon, x.hair, x.plume, x.armor, x.cloth, x.skin, x.beardC, x.horseC, x.note || '']; }
/** 已部署的專案：把第一回戰況寫進「戰況」工作表（先刪掉第一回舊列再寫入；請先執行 setupSheets） */
function applyBattleData1() {
  var sh = sh_(SHEET.BF); if (!sh) { setupSheets(); sh = sh_(SHEET.BF); }
  for (var r = sh.getLastRow(); r >= 2; r--) if (Number(sh.getRange(r, 1).getValue()) === 1) sh.deleteRow(r);
  var rows = (SEED.bf || []).filter(function (x) { return x.ch === 1; }).map(bfRow_);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  clearContentCache();
  return '第一回戰況：寫入 ' + rows.length + ' 列';
}

function seedIfEmpty_(name, rows) {
  var sh = sh_(name);
  if (sh && sh.getLastRow() < 2 && rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

var CACHE_KEYS = ['catalog', 'settings', 'people', 'atlas', 'status', 'looks', 'codex', 'tch_chaps', 'ch_counts'];
var CACHE_CHUNKED = ['people', 'atlas', 'codex', 'looks', 'tch_chaps'];

/** 讀取快取（自動支援超過 100 KB 的分塊快取） */
function cacheGet_(key) {
  var c = CacheService.getScriptCache(), raw = c.get(key);
  if (!raw) return null;
  if (raw.charAt(0) === '{' && raw.indexOf('"__chunks":') === 1) {
    try {
      var meta = JSON.parse(raw), n = Number(meta.__chunks) || 0;
      if (n > 0) {
        var keys = [];
        for (var i = 0; i < n; i++) keys.push(key + '__' + i);
        var parts = c.getAll ? c.getAll(keys) : null, out = '';
        for (var j = 0; j < keys.length; j++) {
          var seg = parts ? parts[keys[j]] : c.get(keys[j]);
          if (!seg) return null;
          out += seg;
        }
        return JSON.parse(out);
      }
    } catch (e) { return null; }
  }
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** 寫入快取（自動切分每塊 <= 28000 字元，避開 GAS 單鍵 100 KB 限制） */
function cachePut_(key, val, sec) {
  try {
    var c = CacheService.getScriptCache(), s = JSON.stringify(val), ttl = sec || 600, step = 28000;
    if (s.length <= step) { c.put(key, s, ttl); return; }
    var chunks = [];
    for (var i = 0; i < s.length; i += step) chunks.push(s.slice(i, i + step));
    if (chunks.length > 60) return;
    if (c.putAll) {
      var map = {}; map[key] = JSON.stringify({ __chunks: chunks.length });
      for (var k = 0; k < chunks.length; k++) map[key + '__' + k] = chunks[k];
      c.putAll(map, ttl);
    } else {
      for (var j = 0; j < chunks.length; j++) c.put(key + '__' + j, chunks[j], ttl);
      c.put(key, JSON.stringify({ __chunks: chunks.length }), ttl);
    }
  } catch (e) { }
}

function ensureSetup_() {
  var c = CacheService.getScriptCache();
  if (c.get('setup_ok')) return;
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SHEET.QB) || !ss.getSheetByName(SHEET.SAVE) || !ss.getSheetByName(SHEET.SUM)) setupSheets();
  try { c.put('setup_ok', '1', 3600); } catch (e) { }
}

/* 同一次伺服器呼叫內的小型記憶：設定、回目狀態、開放回目常被逐回查詢（120 回 × 每次讀快取再解析），記住一次即可。
   寫入或清快取時務必呼叫 memoReset_()。 */
var MEMO_ = {};
function memoReset_() { MEMO_ = {}; }

function clearContentCache() {
  memoReset_();
  var c = CacheService.getScriptCache();
  var keys = CACHE_KEYS.concat(['setup_ok']);
  for (var i = 1; i <= 120; i++) keys.push('ch_' + i);
  CACHE_CHUNKED.forEach(function (k) { for (var j = 0; j < 60; j++) keys.push(k + '__' + j); });
  for (var s = 0; s < keys.length; s += 150) c.removeAll(keys.slice(s, s + 150));
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
  if (MEMO_.settings) return MEMO_.settings;
  var hit = cacheGet_('settings');
  if (hit) return (MEMO_.settings = hit);
  var o = {};
  rows_(SHEET.SET).forEach(function (r) { if (str_(r[0])) o[str_(r[0])] = str_(r[1]); });
  cachePut_('settings', o, 300);
  return (MEMO_.settings = o);
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
function authAny_(token) {
  var p = verify_(token);
  if (p.r !== 's' && p.r !== 't') throw new Error('權限不足');
  return p;
}
var DEFAULT_TEACHER_EMAILS = ['s90194yeu@gm.nssh.ntpc.edu.tw', 'cpbl90194@gmail.com'];
function teacherEmails_(set) {
  set = set || getSettings_();
  var raw = set['教師Email'];
  if (raw === undefined) return DEFAULT_TEACHER_EMAILS.slice();
  return str_(raw).split(/[,，、\s]+/).map(function (s) { return str_(s).toLowerCase(); }).filter(Boolean);
}
function isTeacherEmail_(email, set) {
  email = str_(email).toLowerCase();
  return !!(email && teacherEmails_(set).indexOf(email) >= 0);
}
function issueTeacher_(email) {
  var who = str_(email) || 'teacher';
  return { token: sign_({ a: who, r: 't', em: str_(email), e: Date.now() + 1000 * 60 * 60 * 12 }), email: str_(email) };
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
function findStudent_(account, data) {
  var key = str_(account).toLowerCase();
  if (!key) return null;
  data = data || rows_(SHEET.ROSTER);
  for (var i = 0; i < data.length; i++) {
    if (str_(data[i][0]).toLowerCase() === key) return { row: i + 2, r: data[i] };
  }
  return null;
}
function findByEmail_(email, data) {
  email = str_(email).toLowerCase(); if (!email) return null;
  data = data || rows_(SHEET.ROSTER);
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

