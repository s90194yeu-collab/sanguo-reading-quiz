/* 三國演義閱讀檢測：學生端內容、存檔、登入、目錄（Apps Script 會把所有 .gs 合在同一個全域範圍執行） */
/* ---------- 內容 ---------- */
function openChapters_() {
  var s = getSettings_()['開放回數'] || '全部', o = null;
  if (!(s === '全部' || s === '')) { o = {}; s.split(/[,，、\s]+/).forEach(function (x) { if (x) o[Number(x)] = true; }); }
  var st = chapterStatus_(), hidden = Object.keys(st).filter(function (k) { return st[k].status !== '上架'; });
  if (!hidden.length) return o;
  if (!o) { o = {}; catalog_().forEach(function (c) { o[c.ch] = true; }); }
  hidden.forEach(function (k) { delete o[k]; });
  return o;
}
/** 學生、訪客看得到這一回嗎（開放回數＋已上架） */
function chOpen_(ch) { var o = openChapters_(); return !o || !!o[ch]; }
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
  var dn = drawN_(getSettings_());
  list.forEach(function (x) { x.qn = Math.min(qn[x.ch] || 0, dn); });
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
      ans: str_(r[8]).toUpperCase(), exp: str_(r[9]), para: Number(r[10]) || 0, who: str_(r[11]) };
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
  var units = function (v) { return str_(v).split(/[、,，]/).map(function (x) { return x.trim(); }).filter(String); };
  var bf = rows_(SHEET.BF).filter(function (r) { return Number(r[0]) === ch && str_(r[3]); }).map(function (r, k) {
    var po = str_(r[21]).split(/[｜|]/).map(function (x) { return x.trim(); }).filter(String);
    return { k: k, para: Number(r[1]) || 1, anchor: str_(r[2]), scene: str_(r[3]), title: str_(r[4]),
      a: { name: str_(r[5]), units: units(r[6]), troops: str_(r[7]), state: str_(r[8]), fac: str_(r[18]) },
      b: { name: str_(r[9]), units: units(r[10]), troops: str_(r[11]), state: str_(r[12]), fac: str_(r[19]) },
      note: str_(r[13]), basis: Number(r[14]) || Number(r[1]) || 0,
      bg: str_(r[15]), horse: str_(r[16]), face: str_(r[17]), pq: str_(r[20]), po: po.length >= 2 ? po : [] };
  });
  var o = { ch: ch, num: num, title: title, paras: paras, qs: qs, ill: ill, notes: notes, names: names, summary: summary, bf: bf, art: artData_() };
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
      .map(function (r) { return { ch: Number(r[0]), no: Number(r[1]) || 0, year: str_(r[2]), place: str_(r[3]), event: str_(r[4]), lon: Number(r[5]), lat: Number(r[6]), fac: str_(r[7]) }; })
      .sort(function (a, b) { return a.ch - b.ch || a.no - b.no; })
  };
  try { c.put('atlas', JSON.stringify(o), 600); } catch (e) { }
  return o;
}
function atlas_(reach, allOpen) {
  var all = atlasAll_();
  return { reach: reach, chapters: catalog_().filter(function (c) { return allOpen || chOpen_(c.ch); }).map(function (c) { return { ch: c.ch, num: c.num, title: c.title }; }), factions: artData_().factions,
    people: peopleFor_(reach), rels: all.rels.filter(function (r) { return r.ch <= reach; }),
    places: all.places.filter(function (p) { return p.ch <= reach; }) };
}
function apiAtlas(token) {
  var p = authAny_(token);
  if (p.r === 't') {
    var cats = catalog_(), reach = cats.length ? cats[cats.length - 1].ch : 1;
    var out = atlas_(reach, true); out.allUnlocked = true; return out;
  }
  var pr = progress_(p.a), reachS = 1;
  Object.keys(pr).forEach(function (k) { reachS = Math.max(reachS, Number(k)); });
  return atlas_(reachS);
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
      o[s.ch] = { submitted: s.submitted, best: s.best, last: s.last, tries: s.tries, hasDraft: !!(s.draft && ((s.draft.ans && Object.keys(s.draft.ans).length) || (s.draft.bt && !s.draft.bt.fin && Object.keys(s.draft.bt.ans || {}).length))) };
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
    allowRegister: yes_(set['開放外人註冊'] || '是'), googleClientId: str_(set['Google登入ClientID']), user: null, token: null,
    guestChapters: Object.keys(guestChapters_(set)).map(Number),
    about: { maker: set['製作者'] || '', contact: set['聯絡方式'] || '', license: set['授權聲明'] || '',
      base: sourceOf_(set, 1, '第一回').base, refRoot: 'https://zh.wikisource.org/zh-hant/三國演義', note: set['校勘說明'] || '' } };
  if (token) {
    try {
      var p = verify_(token);
      if (p.r === 't') { out.teacher = true; out.token = token; if (p.em) out.email = p.em; }
      else { var hit = findStudent_(p.a); if (hit) { out.user = userObj_(hit.r); out.token = token; } }
    } catch (e) { }
  }
  if (!out.user && !out.teacher) {
    var email = '';
    try { email = str_(Session.getActiveUser().getEmail()).toLowerCase(); } catch (e) { }
    if (isTeacherEmail_(email, set)) {
      var tIss = issueTeacher_(email);
      out.teacher = true; out.token = tIss.token; out.auto = true; out.email = email;
    } else {
      var byMail = findByEmail_(email);
      if (byMail) { var iss = issueStudent_(byMail); out.user = iss.user; out.token = iss.token; out.auto = true; }
      out.email = email;
    }
  }
  if (out.user) out.home = homeData_(out.user.account);
  return out;
}

function teacherHomeData_() {
  var st = chapterStatus_(), open = openChapters_();
  var list = catalog_().map(function (c) {
    var x = JSON.parse(JSON.stringify(c));
    x.status = (st[c.ch] && st[c.ch].status) || '上架';
    x.open = !open || !!open[c.ch];
    return x;
  });
  return { chapters: list, progress: {}, ann: annAll_().slice(0, 8), board: null, teacher: true };
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
  var p = authAny_(token);
  if (p.r === 't') return teacherHomeData_();
  return homeData_(p.a);
}

/* ---------- 訪客模式：免登入、不寫入任何紀錄 ---------- */
function apiGuestHome() {
  var g = guestChapters_(getSettings_());
  return { chapters: catalog_().filter(function (c) { return chOpen_(c.ch); }).map(function (c) { var x = JSON.parse(JSON.stringify(c)); x.guest = !!g[c.ch]; return x; }), progress: {} };
}
function apiGuestChapter(ch) {
  ch = Number(ch); var set = getSettings_();
  if (!guestChapters_(set)[ch] || !chOpen_(ch)) throw new Error('本回需登入才能閱讀');
  var full = chapterFull_(ch);
  return { ch: ch, num: full.num, title: full.title, paras: full.paras, guest: true,
    ill: full.ill.filter(function (x) { return x.url || yes_(set['顯示未完成插圖'] || '是'); }),
    qn: Math.min(full.qs.length, drawN_(set)), bt: { state: 'none' }, bf: full.bf || [], art: full.art,
    allowRetry: true, save: null, source: sourceOf_(set, ch, full.num), notes: full.notes || [], names: full.names || [], people: peopleFor_(ch) };
}

function apiChapter(token, ch) {
  var p = authAny_(token), isT = p.r === 't'; ch = Number(ch);
  if (!isT && !chOpen_(ch)) throw new Error('本回尚未開放');
  var full = chapterFull_(ch), set = getSettings_();
  var save = isT ? null : (function () { var hit = findSave_(p.a, ch); return hit ? saveObj_(hit.r) : null; })();
  var showExp = yes_(set['交卷後顯示解析'] || '是');
  var bt = save && save.draft && save.draft.bt ? save.draft.bt : null;
  if (save && save.draft) delete save.draft.bt;
  var stMap = isT ? chapterStatus_() : null;
  var out = { ch: ch, num: full.num, title: full.title, paras: full.paras,
    ill: full.ill.filter(function (x) { return x.url || yes_(set['顯示未完成插圖'] || '是'); }),
    qn: Math.min(full.qs.length, drawN_(set)), bt: { state: 'none' }, bf: full.bf || [], art: full.art,
    allowRetry: isT ? true : yes_(set['允許重作'] || '是'), save: save, source: sourceOf_(set, ch, full.num),
    notes: full.notes || [], names: full.names || [], people: peopleFor_(ch),
    teacherRead: isT, allUnlocked: isT,
    status: isT ? ((stMap[ch] && stMap[ch].status) || '上架') : undefined,
    open: isT ? chOpen_(ch) : undefined };
  if (bt && !bt.fin) out.bt = btView_(full, bt, showExp);
  else if (save && save.submitted) {
    out.result = grade_(full, save.lastAns || {}, showExp); out.result.summary = full.summary;
    if (bt && bt.fin) out.result.review = btReview_(full, bt, showExp);
    out.bt = { state: 'done' };
  }
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
  var score = 0, items = [];
  full.qs.forEach(function (q) {
    var mine = str_(ans[q.no]).toUpperCase(); if (!mine) return;   // 只計實際作答（被抽中）的題目
    var ok = mine === q.ans; if (ok) score++;
    items.push({ no: q.no, mine: mine, ans: q.ans, ok: ok, exp: showExp ? q.exp : '', para: q.para });
  });
  return { score: score, total: items.length, items: items };
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
  var p = authAny_(token); if (p.r === 't') return { ok: true, time: now_(), skipped: true };
  ch = Number(ch);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var hit = findSave_(p.a, ch), t = now_();
    var prevObj = hit ? saveObj_(hit.r) : null, old = prevObj ? prevObj.draft : null;
    var draft = JSON.stringify({ ans: ans || {}, pos: Number(pos) || 0, bm: bm ? cleanBm_(bm) : ((old && old.bm) || []), bt: (old && old.bt) || undefined, g: (old && old.g) || undefined });
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
  var p = authAny_(token); if (p.r === 't') return { ok: true, time: now_(), skipped: true };
  ch = Number(ch);
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

