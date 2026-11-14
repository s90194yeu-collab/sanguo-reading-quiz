/* 三國演義閱讀檢測：內容包（匯入／匯出／檢查）、回目上架審核、人物造型與勢力、遊戲進度（圖鑑、找依據、預測）
 * Apps Script 會把所有 .gs 合在同一個全域範圍執行。
 * 內容包格式請見 docs/內容包格式.md；離線檢查：node tools/check_pack.js 檔案.json */

var PACK_VER = 1;
var BF_SCENES = ['軍陣', '單挑', '謀略', '平時'];
var BF_STATES = ['佔優', '相持', '潰敗'];
var BF_BGS = ['戰場', '黃昏', '夜', '桃園', '水戰', '攻城', '火攻', '宮廷', '營帳'];
var Q_TYPES = ['劇情', '文意理解', '人物', '意象', '概念', '修辭'];
var LOOK_HEAD = { '盔': 'helm', '頭巾': 'band', '冠': 'crown', '亂髮': 'wild', '幘': 'cap', '兜帽': 'hood', '光頭': 'bald' };
var LOOK_BEARD = { '無': 'none', '長鬚': 'long', '虯髯': 'bushy', '八字': 'must', '山羊': 'goat' };
var LOOK_WEAPON = { '劍': 'sword', '雙劍': 'twin', '矛': 'spear', '偃月刀': 'guandao', '戟': 'halberd', '羽扇': 'fan', '弓': 'bow', '無': 'none' };
var NAME_KINDS = ['人名', '地名', '朝代', '年號', '書名', '官名'];
var CH_STATUS = ['草稿', '待審', '上架', '下架'];

/* ================= 回目狀態（審核上架） ================= */
/** { 回: { status, imported, reviewed, note } }；表上沒有的回＝視為上架（相容舊資料） */
function chapterStatus_() {
  var hit = cacheGet_('status');
  if (hit) return hit;
  var o = {};
  rows_(SHEET.STAT).forEach(function (r) {
    var ch = Number(r[0]); if (!ch) return;
    o[ch] = { status: CH_STATUS.indexOf(str_(r[1])) >= 0 ? str_(r[1]) : '草稿', imported: str_(r[2]), reviewed: str_(r[3]), note: str_(r[4]) };
  });
  cachePut_('status', o, 600);
  return o;
}
function setChapterStatus_(ch, status, note, imported) {
  var sh = sh_(SHEET.STAT); if (!sh) { setupSheets(); sh = sh_(SHEET.STAT); }
  var data = rows_(SHEET.STAT), t = now_(), row = 0;
  for (var i = 0; i < data.length; i++) if (Number(data[i][0]) === ch) { row = i + 2; break; }
  var old = row ? data[row - 2] : [ch, '', '', '', ''];
  var vals = [ch, status, imported ? t : str_(old[2]), imported ? '' : t, note === undefined ? str_(old[4]) : note];
  if (row) sh.getRange(row, 1, 1, 5).setValues([vals]); else sh.appendRow(vals);
  CacheService.getScriptCache().removeAll(['status', 'catalog', 'codex']);
}

/* ================= 人物造型與勢力（前端 16-bit 畫面用） ================= */
function artData_() {
  var hit = cacheGet_('looks');
  if (hit) return hit;
  var looks = rows_(SHEET.LOOK).filter(function (r) { return str_(r[0]); }).map(function (r) {
    return { key: str_(r[0]), kw: str_(r[1]) === '關鍵字', head: LOOK_HEAD[str_(r[2])] || 'helm', beard: LOOK_BEARD[str_(r[3])] || 'none',
      weapon: LOOK_WEAPON[str_(r[4])] || 'sword', hair: color_(r[5]), plume: color_(r[6]), armor: color_(r[7]), cloth: color_(r[8]),
      skin: color_(r[9]), beardC: color_(r[10]), horse: color_(r[11]) };
  });
  var factions = rows_(SHEET.FAC).filter(function (r) { return str_(r[0]); }).map(function (r) {
    return { name: str_(r[0]), c1: color_(r[1]) || '#6a5a4a', c2: color_(r[2]) || '#4a3a2a',
      keys: str_(r[3]).split(/[、,，\s]+/).filter(String), note: str_(r[4]) };
  });
  var o = { looks: looks, factions: factions };
  cachePut_('looks', o, 600);
  return o;
}
function color_(v) { v = str_(v); return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) ? v : ''; }

/* ================= 遊戲進度：讀到哪一段、找到的依據、預測 ================= */
/** g = { mx: 讀到的最大段落, ev: [找到依據的戰況序], pd: { 戰況序: 選項序 } }；存於存檔草稿的 g */
function cleanGame_(g, old) {
  old = old || {}; g = g || {};
  var ev = {}; (old.ev || []).concat(g.ev || []).forEach(function (k) { if (Number(k) >= 0 && Number(k) < 500) ev[Number(k)] = true; });
  var pd = {}; Object.keys(old.pd || {}).concat(Object.keys(g.pd || {})).forEach(function (k) {
    var v = g.pd && g.pd[k] !== undefined ? g.pd[k] : old.pd[k];
    if (Number(k) >= 0 && Number(k) < 500 && Number(v) >= 0 && Number(v) < 4) pd[Number(k)] = Number(v);
  });
  return { mx: Math.max(Number(old.mx) || 0, Math.min(999, Number(g.mx) || 0)), ev: Object.keys(ev).map(Number).sort(function (a, b) { return a - b; }), pd: pd };
}
function apiSaveGame(token, ch, g) {
  var p = authAny_(token); if (p.r === 't') return { ok: true, g: cleanGame_(g, null), skipped: true };
  ch = Number(ch);
  if (!chOpen_(ch)) throw new Error('本回尚未開放');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var hit = findSave_(p.a, ch), t = now_();
    if (hit) {
      var d = saveObj_(hit.r).draft || { ans: {}, pos: 0, bm: [] };
      d.g = cleanGame_(g, d.g); sh_(SHEET.SAVE).getRange(hit.row, 3).setValue(JSON.stringify(d));
      return { ok: true, g: d.g };
    }
    var ng = cleanGame_(g, null);
    sh_(SHEET.SAVE).appendRow([p.a, ch, JSON.stringify({ ans: {}, pos: 0, bm: [], g: ng }), '否', '', '', '', 0, '', '', '', t, 0, t]);
    return { ok: true, g: ng };
  } finally { lock.releaseLock(); }
}

/* ================= 圖鑑：人物（依讀到的段落解鎖）、戰役 ================= */
function codexAll_() {
  var hit = cacheGet_('codex');
  if (hit) return hit;
  var text = {};
  rows_(SHEET.TEXT).forEach(function (r) { var ch = Number(r[0]); if (ch) (text[ch] = text[ch] || []).push({ i: Number(r[3]), t: str_(r[4]) }); });
  var people = peopleAll_().map(function (p) {
    var ps = (text[p.first] || []).slice().sort(function (a, b) { return a.i - b.i; }), at = 0, keys = [p.name].concat(p.alias || []);
    for (var i = 0; i < ps.length && !at; i++) for (var k = 0; k < keys.length; k++) if (ps[i].t.indexOf(keys[k]) >= 0) { at = ps[i].i; break; }
    return { name: p.name, camp: p.camp, first: p.first, para: at || 1, intro: p.intro, deeds: p.deeds };
  });
  var bfByCh = {};
  rows_(SHEET.BF).forEach(function (r) {
    var ch = Number(r[0]);
    if (ch && str_(r[3])) (bfByCh[ch] = bfByCh[ch] || []).push(r);
  });
  var battles = [];
  catalog_().forEach(function (cc) {
    (bfByCh[cc.ch] || []).forEach(function (row, k) {
      var r = parseBfRow_(row, k);
      if (r.scene === '平時') return;
      battles.push({ ch: cc.ch, k: r.k, para: r.para, title: r.title, scene: r.scene, a: r.a, b: r.b, note: r.note, bg: r.bg, horse: r.horse });
    });
  });
  var o = { people: people, battles: battles };
  cachePut_('codex', o, 600);
  return o;
}
function codexFor_(prog, allOpen) {
  var all = codexAll_(), open = openChapters_();
  var ok = function (ch) { return allOpen || !open || open[ch]; };
  var out = { people: all.people.filter(function (p) { return ok(p.first); }), battles: all.battles.filter(function (b) { return ok(b.ch); }),
    chapters: catalog_().filter(function (c) { return ok(c.ch); }).map(function (c) { return { ch: c.ch, num: c.num, title: c.title }; }),
    art: artData_(), prog: prog || {} };
  if (allOpen) out.allUnlocked = true;
  return out;
}
/** 學生：prog = { 回: { mx, ev, pd, done } }；教師：全回全解鎖 */
function apiCodex(token) {
  var p = authAny_(token);
  if (p.r === 't') {
    var tprog = {};
    catalog_().forEach(function (c) { tprog[c.ch] = { mx: 9999, ev: [], pd: {}, done: true }; });
    return codexFor_(tprog, true);
  }
  var a = str_(p.a).toLowerCase(), prog = {};
  rows_(SHEET.SAVE).forEach(function (r) {
    if (str_(r[0]).toLowerCase() !== a) return;
    var s = saveObj_(r), g = (s.draft && s.draft.g) || {};
    prog[s.ch] = { mx: Number(g.mx) || 0, ev: g.ev || [], pd: g.pd || {}, done: s.submitted };
  });
  return codexFor_(prog);
}
function apiGuestCodex() { return codexFor_({}); }

/* ================= 內容包：檢查 ================= */
/**
 * 檢查一份內容包。只做純資料檢查（不讀寫試算表），因此也能在 node 離線執行。
 * ctx（選填）：{ people: [已知人物姓名], factions: [已知勢力] }
 * 回傳 { errors: [字串], warnings: [字串], stats: {...} }
 */
function validatePack_(pk, ctx) {
  ctx = ctx || {};
  var E = [], W = [], err = function (m) { E.push(m); }, warn = function (m) { W.push(m); };
  if (!pk || typeof pk !== 'object') return { errors: ['內容包不是 JSON 物件'], warnings: [], stats: {} };
  var ch = Number(pk['回']);
  if (!(ch >= 1 && ch <= 120 && Math.floor(ch) === ch)) err('「回」須為 1～120 的整數');
  if (Number(pk['格式版本'] || 1) !== PACK_VER) warn('格式版本不是 ' + PACK_VER);
  if (!/^第[一二三四五六七八九十百〇零]+回$/.test(String(pk['回次'] || ''))) err('「回次」格式應為「第六回」');
  var tt = String(pk['回目'] || '').split(/[｜|]/);
  if (tt.length !== 2 || !tt[0].trim() || !tt[1].trim()) err('「回目」須為上下聯，以「｜」分隔');
  var paras = pk['原文'];
  if (!Array.isArray(paras) || !paras.length) { err('「原文」須為非空陣列（一段一個字串）'); paras = []; }
  paras.forEach(function (t, i) { if (typeof t !== 'string' || !t.replace(/^〔詩〕/, '').trim()) err('原文第 ' + (i + 1) + ' 段是空的'); });
  var N = paras.length, full = paras.join('\n'), plain = function (i) { return String(paras[i - 1] || '').replace(/^〔詩〕/, ''); };
  var inRange = function (v) { v = Number(v); return v >= 1 && v <= N && Math.floor(v) === v; };
  var SIMP = '们这说国来时为发对战军张刘关门见马长东车书乐卫与陈刘吕孙杀将杀听开兴归钱龙凤岁';
  var simp = {}; for (var si = 0; si < full.length; si++) if (SIMP.indexOf(full.charAt(si)) >= 0) simp[full.charAt(si)] = true;
  if (Object.keys(simp).length) err('原文疑似有簡體字：' + Object.keys(simp).join('、') + '（請以好讀 epub 繁體本為準）');
  if (/[a-zA-Z]{3,}/.test(full)) warn('原文含英文字母，請確認是否為殘留標記');

  // 題庫
  var qs = pk['題庫'] || [], seenNo = {};
  if (!Array.isArray(qs)) { err('「題庫」須為陣列'); qs = []; }
  if (qs.length !== 20) warn('題庫有 ' + qs.length + ' 題（建議 20 題，系統每次抽 10 題）');
  var tcount = {};
  qs.forEach(function (q, i) {
    var at = '題庫第 ' + (i + 1) + ' 題';
    if (!q || typeof q !== 'object') { err(at + '格式錯誤'); return; }
    var no = Number(q['題號']); if (!(no >= 1)) err(at + '：「題號」須為正整數'); else if (seenNo[no]) err(at + '：題號 ' + no + ' 重複'); seenNo[no] = true;
    if (Q_TYPES.indexOf(q['類型']) < 0) err(at + '：「類型」須為 ' + Q_TYPES.join('／')); else tcount[q['類型']] = (tcount[q['類型']] || 0) + 1;
    if (!String(q['題幹'] || '').trim()) err(at + '：題幹是空的');
    var op = q['選項'];
    if (!Array.isArray(op) || op.length !== 4 || op.some(function (x) { return !String(x || '').trim(); })) err(at + '：「選項」須為 4 個非空字串');
    else { var u = {}; op.forEach(function (x) { if (u[x]) err(at + '：選項重複「' + x + '」'); u[x] = true; }); }
    if ('ABCD'.indexOf(String(q['答案'] || '').toUpperCase()) < 0 || String(q['答案'] || '').length !== 1) err(at + '：「答案」須為 A／B／C／D');
    if (!String(q['解析'] || '').trim()) err(at + '：解析是空的');
    if (!inRange(q['對應段落'])) err(at + '：「對應段落」須在 1～' + N);
    if (q['人物'] && ctx.people && ctx.people.indexOf(q['人物']) < 0 && !(pk['人物'] || []).some(function (p) { return p['姓名'] === q['人物']; })) warn(at + '：人物「' + q['人物'] + '」不在人物表');
  });
  if (qs.length) {
    var ans = { A: 0, B: 0, C: 0, D: 0 }; qs.forEach(function (q) { var a = String(q['答案'] || '').toUpperCase(); if (ans[a] !== undefined) ans[a]++; });
    if (Math.max(ans.A, ans.B, ans.C, ans.D) > qs.length * .45) warn('答案分布偏斜：' + JSON.stringify(ans) + '（前端會洗牌，但題庫本身仍建議平均）');
  }

  // 戰況
  var bf = pk['戰況'] || [], last = 0, facs = (ctx.factions || []).concat((pk['勢力'] || []).map(function (f) { return f['勢力']; }));
  if (!Array.isArray(bf)) { err('「戰況」須為陣列'); bf = []; }
  bf.forEach(function (r, i) {
    var at = '戰況第 ' + (i + 1) + ' 列', sc = r['場景'];
    if (!inRange(r['段'])) { err(at + '：「段」須在 1～' + N); return; }
    if (r['錨句'] && plain(r['段']).indexOf(r['錨句']) < 0) err(at + '：錨句「' + r['錨句'] + '」不在第 ' + r['段'] + ' 段（必須逐字相同）');
    var pos = Number(r['段']) + (r['錨句'] ? plain(r['段']).indexOf(r['錨句']) / Math.max(1, plain(r['段']).length) : 0);
    if (pos < last) warn(at + '：順序比前一列早（系統會自動排序，但請確認段與錨句）'); last = pos;
    if (BF_SCENES.indexOf(sc) < 0) err(at + '：「場景」須為 ' + BF_SCENES.join('／'));
    if (!String(r['標題'] || '').trim()) err(at + '：標題是空的');
    if (r['背景'] && BF_BGS.indexOf(r['背景']) < 0) err(at + '：「背景」須為 ' + BF_BGS.join('／') + ' 或空白');
    if (r['騎馬'] && ['甲', '乙', '雙方'].indexOf(r['騎馬']) < 0) err(at + '：「騎馬」須為 甲／乙／雙方 或空白');
    ['甲方', '乙方'].forEach(function (s) {
      var sd = r[s] || {};
      if (sc !== '平時' && !String(sd['名稱'] || '').trim() && !(sd['人物'] || []).length) err(at + '：' + s + '沒有名稱也沒有人物');
      if (sd['勢'] && BF_STATES.indexOf(sd['勢']) < 0) err(at + '：' + s + '「勢」須為 ' + BF_STATES.join('／') + ' 或空白');
      if (sc !== '平時' && !sd['勢'] && (sd['名稱'] || (sd['人物'] || []).length)) warn(at + '：' + s + '沒有填「勢」');
      if (sd['兵力'] && full.indexOf(sd['兵力']) < 0) err(at + '：' + s + '兵力「' + sd['兵力'] + '」不在原文中（原文有寫才可填數字）');
      if (sd['人物'] && !Array.isArray(sd['人物'])) err(at + '：' + s + '「人物」須為陣列');
      if (sd['勢力'] && facs.length && facs.indexOf(sd['勢力']) < 0) warn(at + '：' + s + '勢力「' + sd['勢力'] + '」不在勢力表');
    });
    if (!String(r['說明'] || '').trim()) err(at + '：說明是空的');
    if (r['依據段'] && !inRange(r['依據段'])) err(at + '：「依據段」須在 1～' + N);
    var pq = r['預測'];
    if (pq) {
      if (!String(pq['問題'] || '').trim()) err(at + '：預測沒有問題');
      if (!Array.isArray(pq['選項']) || pq['選項'].length < 2 || pq['選項'].length > 4) err(at + '：預測選項須 2～4 個');
      if (i === bf.length - 1) warn(at + '：最後一幕放預測，學生讀不到揭曉');
    }
  });
  if (!bf.length) warn('沒有戰況資料：本回戰況畫面會自動隱藏');

  // 其他表
  (pk['註釋'] || []).forEach(function (x, i) { if (!x['詞語'] || full.indexOf(x['詞語']) < 0) err('註釋第 ' + (i + 1) + ' 筆：詞語「' + (x['詞語'] || '') + '」不在原文'); if (!String(x['解釋'] || '').trim()) err('註釋第 ' + (i + 1) + ' 筆：解釋是空的'); });
  (pk['專名'] || []).forEach(function (x, i) { if (!x['詞'] || full.indexOf(x['詞']) < 0) warn('專名第 ' + (i + 1) + ' 筆：「' + (x['詞'] || '') + '」不在原文'); if (x['類別'] && NAME_KINDS.indexOf(x['類別']) < 0) err('專名第 ' + (i + 1) + ' 筆：類別須為 ' + NAME_KINDS.join('／')); });
  (pk['人物'] || []).forEach(function (x, i) {
    if (!x['姓名']) err('人物第 ' + (i + 1) + ' 筆沒有姓名');
    if (Number(x['首次出場回']) > ch) err('人物「' + x['姓名'] + '」首次出場回晚於本回');
    if (Number(x['首次出場回']) === ch && x['姓名'] && full.indexOf(x['姓名']) < 0 && !(x['別稱'] || []).some(function (a) { return full.indexOf(a) >= 0; })) warn('人物「' + x['姓名'] + '」本回原文找不到姓名或別稱');
    if (/後來|日後|最終|死於|將會/.test(x['簡介'] || '')) warn('人物「' + x['姓名'] + '」簡介可能劇透（含「後來／最終」等字）');
  });
  (pk['人物事蹟'] || []).forEach(function (x, i) { if (!x['姓名'] || !String(x['事蹟'] || '').trim()) err('人物事蹟第 ' + (i + 1) + ' 筆缺姓名或事蹟'); });
  (pk['人物關係'] || []).forEach(function (x, i) { if (!x['人物甲'] || !x['人物乙'] || !x['關係']) err('人物關係第 ' + (i + 1) + ' 筆缺欄位'); });
  (pk['地點事件'] || []).forEach(function (x, i) {
    var lo = Number(x['經度']), la = Number(x['緯度']);
    if (!x['地點'] || !x['事件']) err('地點事件第 ' + (i + 1) + ' 筆缺地點或事件');
    if (!(lo >= 73 && lo <= 135 && la >= 18 && la <= 54)) err('地點事件第 ' + (i + 1) + ' 筆經緯度不在中國範圍');
  });
  (pk['人物造型'] || []).forEach(function (x, i) {
    var at = '人物造型第 ' + (i + 1) + ' 筆（' + (x['人物'] || '') + '）';
    if (!x['人物']) err(at + '缺人物');
    if (x['比對'] && ['姓名', '關鍵字'].indexOf(x['比對']) < 0) err(at + '：比對須為 姓名／關鍵字');
    if (x['頭飾'] && !LOOK_HEAD[x['頭飾']]) err(at + '：頭飾須為 ' + Object.keys(LOOK_HEAD).join('／'));
    if (x['鬍鬚'] && !LOOK_BEARD[x['鬍鬚']]) err(at + '：鬍鬚須為 ' + Object.keys(LOOK_BEARD).join('／'));
    if (x['武器'] && !LOOK_WEAPON[x['武器']]) err(at + '：武器須為 ' + Object.keys(LOOK_WEAPON).join('／'));
    ['髮色', '纓色', '甲色', '衣色', '膚色', '鬍色', '坐騎色'].forEach(function (k) { if (x[k] && !color_(x[k])) err(at + '：' + k + '須為 #RRGGBB'); });
  });
  (pk['勢力'] || []).forEach(function (x, i) { if (!x['勢力'] || !color_(x['主色'])) err('勢力第 ' + (i + 1) + ' 筆缺名稱或主色（#RRGGBB）'); });
  var sm = pk['回末小結'];
  if (!sm) warn('沒有回末小結'); else if (!Array.isArray(sm['本回大事']) || !sm['本回大事'].length) err('回末小結「本回大事」須為非空陣列');
  (pk['插圖'] || []).forEach(function (x, i) { if (!inRange(x['插在第幾段之後'])) err('插圖第 ' + (i + 1) + ' 張：插在第幾段之後須在 1～' + N); });
  return { errors: E, warnings: W, stats: { 回: ch, 段數: N, 字數: full.replace(/\s/g, '').length, 題數: qs.length, 題型: tcount, 戰況: bf.length, 註釋: (pk['註釋'] || []).length } };
}

/* ================= 內容包：匯入 ================= */
function knownCtx_() {
  return { people: rows_(SHEET.PEOPLE).map(function (r) { return str_(r[0]); }).filter(String),
    factions: rows_(SHEET.FAC).map(function (r) { return str_(r[0]); }).filter(String) };
}
/** 把某回的列刪掉（第 col 欄＝回）後在表尾補上 rows */
function replaceRows_(name, ch, rows, col) {
  var sh = sh_(name); col = col || 1;
  var data = rows_(name);
  for (var i = data.length - 1; i >= 0; i--) if (Number(data[i][col - 1]) === ch) sh.deleteRow(i + 2);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}
/** 依第一欄（或 keyFn）更新或新增 */
function upsertRows_(name, rows, keyFn) {
  var sh = sh_(name), data = rows_(name), idx = {};
  keyFn = keyFn || function (r) { return str_(r[0]); };
  data.forEach(function (r, i) { idx[keyFn(r)] = i + 2; });
  rows.forEach(function (r) {
    var at = idx[keyFn(r)];
    if (at) sh.getRange(at, 1, 1, r.length).setValues([r]);
    else { sh.appendRow(r); idx[keyFn(r)] = sh.getLastRow(); }
  });
}
function packBfRow_(ch, r) {
  var a = r['甲方'] || {}, b = r['乙方'] || {}, pq = r['預測'] || null;
  return [ch, Number(r['段']), r['錨句'] || '', r['場景'], r['標題'], a['名稱'] || '', (a['人物'] || []).join('、'), a['兵力'] || '', a['勢'] || '',
    b['名稱'] || '', (b['人物'] || []).join('、'), b['兵力'] || '', b['勢'] || '', r['說明'] || '', Number(r['依據段']) || Number(r['段']),
    r['背景'] || '', r['騎馬'] || '', r['頭像'] || '', a['勢力'] || '', b['勢力'] || '', pq ? pq['問題'] : '', pq ? (pq['選項'] || []).join('｜') : ''];
}
/** 匯入內容包。mode：'check' 只檢查；'import' 檢查通過才寫入。publish：true＝直接上架，否則設為待審 */
function importPack(json, mode, publish) {
  var pk;
  try { pk = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return { ok: false, errors: ['JSON 格式錯誤：' + e.message], warnings: [] }; }
  ensureSetup_(); setupSheets();
  var v = validatePack_(pk, knownCtx_());
  if (mode !== 'import' || v.errors.length) return { ok: !v.errors.length, checked: true, errors: v.errors, warnings: v.warnings, stats: v.stats };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ch = Number(pk['回']), tt = String(pk['回目']).split(/[｜|]/), title = tt[0].trim() + '　' + tt[1].trim(), done = [];
    replaceRows_(SHEET.TEXT, ch, pk['原文'].map(function (t, i) { return [ch, pk['回次'], title, i + 1, t]; })); done.push('原文 ' + pk['原文'].length + ' 段');
    if (pk['題庫']) { replaceRows_(SHEET.QB, ch, pk['題庫'].map(function (q) { return [ch, Number(q['題號']), q['類型'], q['題幹'], q['選項'][0], q['選項'][1], q['選項'][2], q['選項'][3], String(q['答案']).toUpperCase(), q['解析'], Number(q['對應段落']), q['人物'] || '']; })); done.push('題庫 ' + pk['題庫'].length + ' 題'); }
    if (pk['戰況']) { replaceRows_(SHEET.BF, ch, pk['戰況'].map(function (r) { return packBfRow_(ch, r); })); done.push('戰況 ' + pk['戰況'].length + ' 幕'); }
    if (pk['註釋']) { replaceRows_(SHEET.NOTE, ch, pk['註釋'].map(function (x) { return [ch, x['詞語'], x['注音'] || '', x['解釋']]; })); done.push('註釋 ' + pk['註釋'].length); }
    if (pk['專名']) { replaceRows_(SHEET.NAME, ch, pk['專名'].map(function (x) { return [ch, x['詞'], x['類別'] || '人名', x['說明'] || '']; })); done.push('專名 ' + pk['專名'].length); }
    if (pk['人物']) { upsertRows_(SHEET.PEOPLE, pk['人物'].map(function (x) { return [x['姓名'], (x['別稱'] || []).join('，'), x['陣營'] || '', Number(x['首次出場回']) || ch, x['簡介'] || '']; })); done.push('人物 ' + pk['人物'].length); }
    if (pk['人物事蹟']) {
      var dsh = sh_(SHEET.DEED), dd = rows_(SHEET.DEED), names = {};
      pk['人物事蹟'].forEach(function (x) { names[x['姓名']] = true; });
      for (var i = dd.length - 1; i >= 0; i--) if (Number(dd[i][1]) === ch && names[str_(dd[i][0])]) dsh.deleteRow(i + 2);
      pk['人物事蹟'].forEach(function (x) { dsh.appendRow([x['姓名'], ch, x['事蹟']]); }); done.push('事蹟 ' + pk['人物事蹟'].length);
    }
    if (pk['人物關係']) { upsertRows_(SHEET.REL, pk['人物關係'].map(function (x) { return [x['人物甲'], x['人物乙'], x['關係'], Number(x['從第幾回起']) || ch]; }), function (r) { return str_(r[0]) + '|' + str_(r[1]); }); done.push('關係 ' + pk['人物關係'].length); }
    if (pk['地點事件']) { replaceRows_(SHEET.PLACE, ch, pk['地點事件'].map(function (x, i) { return [ch, i + 1, x['年代'] || '', x['地點'], x['事件'], Number(x['經度']), Number(x['緯度']), x['勢力'] || '']; })); done.push('地點 ' + pk['地點事件'].length); }
    if (pk['人物造型']) { upsertRows_(SHEET.LOOK, pk['人物造型'].map(function (x) { return [x['人物'], x['比對'] || '姓名', x['頭飾'] || '盔', x['鬍鬚'] || '無', x['武器'] || '劍', x['髮色'] || '', x['纓色'] || '', x['甲色'] || '', x['衣色'] || '', x['膚色'] || '', x['鬍色'] || '', x['坐騎色'] || '', x['備註'] || '']; })); done.push('造型 ' + pk['人物造型'].length); }
    if (pk['勢力']) { upsertRows_(SHEET.FAC, pk['勢力'].map(function (x) { return [x['勢力'], x['主色'], x['副色'] || '', (x['關鍵字'] || []).join('、'), x['說明'] || '']; })); done.push('勢力 ' + pk['勢力'].length); }
    if (pk['回末小結']) { var sm = pk['回末小結']; replaceRows_(SHEET.SUM, ch, [[ch, sm['本回大事'].join('\n'), sm['名句'] || '', sm['想一想'] || '']]); done.push('小結'); }
    if (pk['插圖']) {
      var old = {}; rows_(SHEET.ILL).forEach(function (r) { if (Number(r[0]) === ch) old[Number(r[1])] = str_(r[6]); });
      replaceRows_(SHEET.ILL, ch, pk['插圖'].map(function (x, i) { return [ch, i + 1, x['標題'], Number(x['插在第幾段之後']), x['圖說'] || '', x['生圖提示詞'] || '', x['圖片網址或雲端檔案ID'] || old[i + 1] || '', x['對話氣泡'] || '']; }));
      done.push('插圖 ' + pk['插圖'].length);
    }
    setChapterStatus_(ch, publish ? '上架' : '待審', '匯入：' + done.join('、'), true);
    clearContentCache();
    return { ok: true, imported: true, ch: ch, done: done, status: publish ? '上架' : '待審', errors: [], warnings: v.warnings, stats: v.stats };
  } finally { lock.releaseLock(); }
}

/* ================= 內容包：匯出（試算表 → JSON） ================= */
function exportPack_(ch) {
  ch = Number(ch); var full = chapterFull_(ch);
  if (!full.paras.length) throw new Error('第 ' + ch + ' 回沒有原文');
  var tt = full.title.split(/\s+|　/).filter(String);
  var mine = function (name) { return rows_(name).filter(function (r) { return Number(r[0]) === ch; }); };
  var people = peopleAll_().filter(function (p) { return p.first === ch; });
  var pnames = {}; people.forEach(function (p) { pnames[p.name] = true; });
  var usedUnits = {}; full.bf.forEach(function (r) { r.a.units.concat(r.b.units).forEach(function (u) { usedUnits[u] = true; }); });
  var looks = rows_(SHEET.LOOK).filter(function (r) { return str_(r[1]) === '關鍵字' || usedUnits[str_(r[0])]; });
  var sideOut = function (s) { var o = { '名稱': s.name, '人物': s.units, '兵力': s.troops, '勢': s.state }; if (s.fac) o['勢力'] = s.fac; return o; };
  var pk = {
    '格式版本': PACK_VER, '回': ch, '回次': full.num, '回目': tt.slice(0, Math.ceil(tt.length / 2)).join('') + '｜' + tt.slice(Math.ceil(tt.length / 2)).join(''),
    '原文': full.paras.map(function (p) { return p.t; }),
    '題庫': full.qs.map(function (q) { return { '題號': q.no, '類型': q.type, '題幹': q.stem, '選項': q.opts, '答案': q.ans, '解析': q.exp, '對應段落': q.para, '人物': q.who }; }),
    '戰況': full.bf.map(function (r) {
      var o = { '段': r.para, '錨句': r.anchor, '場景': r.scene, '標題': r.title, '甲方': sideOut(r.a), '乙方': sideOut(r.b), '說明': r.note, '依據段': r.basis };
      if (r.bg) o['背景'] = r.bg; if (r.horse) o['騎馬'] = r.horse; if (r.face) o['頭像'] = r.face;
      if (r.pq) o['預測'] = { '問題': r.pq, '選項': r.po };
      return o;
    }),
    '註釋': mine(SHEET.NOTE).map(function (r) { return { '詞語': str_(r[1]), '注音': str_(r[2]), '解釋': str_(r[3]) }; }),
    '專名': mine(SHEET.NAME).map(function (r) { return { '詞': str_(r[1]), '類別': str_(r[2]), '說明': str_(r[3]) }; }),
    '人物': people.map(function (p) { return { '姓名': p.name, '別稱': p.alias, '陣營': p.camp, '首次出場回': p.first, '簡介': p.intro }; }),
    '人物事蹟': rows_(SHEET.DEED).filter(function (r) { return Number(r[1]) === ch; }).map(function (r) { return { '姓名': str_(r[0]), '事蹟': str_(r[2]) }; }),
    '人物關係': rows_(SHEET.REL).filter(function (r) { return Number(r[3]) === ch; }).map(function (r) { return { '人物甲': str_(r[0]), '人物乙': str_(r[1]), '關係': str_(r[2]), '從第幾回起': ch }; }),
    '地點事件': mine(SHEET.PLACE).map(function (r) { return { '年代': str_(r[2]), '地點': str_(r[3]), '事件': str_(r[4]), '經度': Number(r[5]), '緯度': Number(r[6]), '勢力': str_(r[7]) }; }),
    '人物造型': looks.map(function (r) { return { '人物': str_(r[0]), '比對': str_(r[1]), '頭飾': str_(r[2]), '鬍鬚': str_(r[3]), '武器': str_(r[4]), '髮色': str_(r[5]), '纓色': str_(r[6]), '甲色': str_(r[7]), '衣色': str_(r[8]), '膚色': str_(r[9]), '鬍色': str_(r[10]), '坐騎色': str_(r[11]) }; }),
    '勢力': rows_(SHEET.FAC).filter(function (r) { return str_(r[0]); }).map(function (r) { return { '勢力': str_(r[0]), '主色': str_(r[1]), '副色': str_(r[2]), '關鍵字': str_(r[3]).split(/[、,，]/).filter(String), '說明': str_(r[4]) }; }),
    '插圖': mine(SHEET.ILL).map(function (r) { return { '標題': str_(r[2]), '插在第幾段之後': Number(r[3]), '圖說': str_(r[4]), '生圖提示詞': str_(r[5]) }; })
  };
  if (full.summary) pk['回末小結'] = { '本回大事': full.summary.events, '名句': full.summary.quote, '想一想': full.summary.think };
  return pk;
}

/* ================= 試算表選單：匯入／匯出對話框 ================= */
function showImportDialog() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('dlg_import').setWidth(760).setHeight(620), '匯入內容包');
}
function showExportDialog() {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('匯出內容包', '要匯出第幾回？', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var json = JSON.stringify(exportPack_(Number(r.getResponseText())), null, 1);
  var html = HtmlService.createHtmlOutput('<textarea style="width:100%;height:520px;font:12px monospace">' + json.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea><p style="font:13px sans-serif">全選複製後存成 .json 檔；可交給 Gemini 當範本，或修改後再用「匯入內容包」寫回。</p>').setWidth(760).setHeight(620);
  ui.showModalDialog(html, '第 ' + r.getResponseText() + ' 回內容包');
}

/* ================= 已部署專案：第一回升級 ================= */
function applyChapter1Upgrade() {
  setupSheets();
  var fsh = sh_(SHEET.FAC); if (fsh.getLastRow() < 2) seedIfEmpty_(SHEET.FAC, (SEED.factions || []).map(function (x) { return [x.name, x.c1, x.c2, x.keys, x.note]; }));
  upsertRows_(SHEET.LOOK, (SEED.looks || []).map(lookRow_));
  var r1 = applyBattleData1();
  var psh = sh_(SHEET.PLACE), pd = rows_(SHEET.PLACE);
  (SEED.places || []).forEach(function (x) { for (var i = 0; i < pd.length; i++) if (Number(pd[i][0]) === x.ch && str_(pd[i][3]) === x.place && x.fac) psh.getRange(i + 2, 8).setValue(x.fac); });
  clearContentCache();
  return r1 + '；人物造型 ' + (SEED.looks || []).length + ' 筆；勢力 ' + (SEED.factions || []).length + ' 筆';
}

/* ================= 教師後台：審核上架、預覽 ================= */
function chapterCounts_() {
  var hit = cacheGet_('ch_counts');
  if (hit) return hit;
  var counts = {}, inc = function (ch, k) {
    ch = Number(ch); if (!ch) return;
    var o = counts[ch] || (counts[ch] = { paras: 0, qs: 0, bf: 0, notes: 0 });
    o[k]++;
  };
  rows_(SHEET.TEXT).forEach(function (r) { inc(r[0], 'paras'); });
  rows_(SHEET.QB).forEach(function (r) { inc(r[0], 'qs'); });
  rows_(SHEET.BF).forEach(function (r) { if (str_(r[3])) inc(r[0], 'bf'); });
  rows_(SHEET.NOTE).forEach(function (r) { if (str_(r[1])) inc(r[0], 'notes'); });
  cachePut_('ch_counts', counts, 600);
  return counts;
}
function apiTeacherStatus(token) {
  verify_(token, 't');
  var st = chapterStatus_(), counts = chapterCounts_();
  return catalog_().map(function (c) {
    var cnt = counts[c.ch] || { paras: 0, qs: 0, bf: 0, notes: 0 };
    var s = st[c.ch] || { status: '上架', imported: '', reviewed: '', note: '（未列入審核表，視為上架）' };
    return { ch: c.ch, num: c.num, title: c.title, status: s.status, imported: s.imported, reviewed: s.reviewed, note: s.note,
      paras: cnt.paras, qs: cnt.qs, bf: cnt.bf, notes: cnt.notes };
  });
}
function apiTeacherSetStatus(token, ch, status) {
  verify_(token, 't'); ch = Number(ch);
  if (CH_STATUS.indexOf(status) < 0) throw new Error('狀態須為 ' + CH_STATUS.join('／'));
  setChapterStatus_(ch, status);
  return apiTeacherStatus(token);
}
function apiTeacherCheck(token, ch) {
  verify_(token, 't');
  return validatePack_(exportPack_(ch), knownCtx_());
}
/** 教師預覽：不論上架狀態都可讀（不存檔、不作答） */
function apiTeacherPreview(token, ch) {
  verify_(token, 't'); ch = Number(ch);
  var full = chapterFull_(ch), set = getSettings_(), st = chapterStatus_()[ch];
  return { ch: ch, num: full.num, title: full.title, paras: full.paras, guest: true, preview: st ? st.status : '上架',
    ill: full.ill, qn: Math.min(full.qs.length, drawN_(set)), bt: { state: 'none' }, bf: full.bf || [], art: full.art,
    allowRetry: false, save: null, source: sourceOf_(set, ch, full.num), notes: full.notes || [], names: full.names || [], people: peopleFor_(ch) };
}
