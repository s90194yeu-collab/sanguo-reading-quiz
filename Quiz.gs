/* 三國演義閱讀檢測：作答（分層抽題、選項洗牌、伺服器端批改）與錯題本（Apps Script 會把所有 .gs 合在同一個全域範圍執行） */
/* ================= 出征（分層抽題＋選項洗牌＋伺服器端批改） =================
 * 抽到的題組與每題的選項排列存在「存檔」草稿的 bt 裡：重新整理頁面不會重抽，
 * 前端只拿得到亂序後的選項，正解在作答後才由伺服器告知。 */
function drawN_(set) { var n = Math.round(Number(set['每次抽題數'])); return n >= 1 && n <= 50 ? n : 10; }
function shuffled_(a) {
  var b = a.slice(), i, j, t;
  for (i = b.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
  return b;
}
function btGroup_(type) {
  type = str_(type);
  if (/人物/.test(type)) return 'p';
  if (/概念|意象|典故|修辭|字詞|章法|體裁/.test(type)) return 'c';
  return 't';
}
/** 分層抽題：文意 4：人物 4：概念 2（依總題數等比例）；沒看過的題優先 */
function btDraw_(full, seen, n) {
  var seenSet = {}; (seen || []).forEach(function (x) { seenSet[x] = 1; });
  var all = full.qs.map(function (q) { return q.no; });
  if (all.length <= n) return shuffled_(all);
  var g = { t: [], p: [], c: [] };
  full.qs.forEach(function (q) { g[btGroup_(q.type)].push(q.no); });
  var order = function (arr) {
    var u = [], o = [];
    arr.forEach(function (no) { (seenSet[no] ? o : u).push(no); });
    return shuffled_(u).concat(shuffled_(o));
  };
  var nt = Math.round(n * 0.4), np = Math.round(n * 0.4), quota = { t: nt, p: np, c: n - nt - np };
  var pick = [], rest = [];
  ['t', 'p', 'c'].forEach(function (k) {
    var pool = order(g[k]);
    pick = pick.concat(pool.slice(0, quota[k])); rest = rest.concat(pool.slice(quota[k]));
  });
  if (pick.length < n) {
    var fresh = rest.filter(function (no) { return !seenSet[no]; }), old = rest.filter(function (no) { return seenSet[no]; });
    pick = pick.concat(shuffled_(fresh).concat(shuffled_(old)).slice(0, n - pick.length));
  }
  return shuffled_(pick);
}
function btNew_(full, set, prevSeen) {
  var nos = btDraw_(full, prevSeen, drawN_(set)), perm = {};
  nos.forEach(function (no) { perm[no] = shuffled_([0, 1, 2, 3]).join(''); });
  var seen = (prevSeen || []).concat(nos);
  if (seen.length >= full.qs.length) seen = nos.slice();   // 全題庫都出過一輪，重新計
  return { id: Utilities.getUuid().slice(0, 8), nos: nos, perm: perm, ans: {}, seen: seen, fin: false };
}
function btQ_(full, no) { for (var i = 0; i < full.qs.length; i++) if (full.qs[i].no === no) return full.qs[i]; return null; }
function btToOrig_(bt, no, d) { var i = 'ABCD'.indexOf(d); return i < 0 ? '' : 'ABCD'.charAt(Number(bt.perm[no].charAt(i))); }
function btToDisp_(bt, no, o) { return 'ABCD'.charAt(bt.perm[no].indexOf(String('ABCD'.indexOf(o)))); }
function btOpts_(q, perm) { return perm.split('').map(function (i) { return q.opts[Number(i)]; }); }
function btResult_(full, bt, no, showExp) {
  var q = btQ_(full, no), mine = bt.ans[no], ok = btToOrig_(bt, no, mine) === q.ans;
  return { no: no, mine: mine, ans: btToDisp_(bt, no, q.ans), ok: ok, exp: showExp ? q.exp : '', para: q.para, who: ok ? q.who : '' };
}
function btView_(full, bt, showExp) {
  var done = {};
  bt.nos.forEach(function (no) { if (bt.ans[no]) done[no] = btResult_(full, bt, no, showExp); });
  return { state: 'ongoing', id: bt.id, done: done,
    qs: bt.nos.map(function (no) { var q = btQ_(full, no); return { no: no, type: q.type, stem: q.stem, opts: btOpts_(q, bt.perm[no]) }; }) };
}
function btReview_(full, bt, showExp) {
  return bt.nos.map(function (no) {
    var q = btQ_(full, no), r = btResult_(full, bt, no, showExp);
    r.type = q.type; r.stem = q.stem; r.opts = btOpts_(q, bt.perm[no]); return r;
  });
}
function btAnsOrig_(bt) {
  var o = {}; bt.nos.forEach(function (no) { o[no] = btToOrig_(bt, no, bt.ans[no]); }); return o;
}
function btWriteDraft_(p, ch, bt, t) {
  var hit = findSave_(p.a, ch), s = sh_(SHEET.SAVE);
  if (hit) {
    var o = saveObj_(hit.r), d = o.draft || { ans: {}, pos: 0, bm: [] };
    d.bt = bt; s.getRange(hit.row, 3).setValue(JSON.stringify(d)); s.getRange(hit.row, 12).setValue(t);
    if (!o.opened) s.getRange(hit.row, 14).setValue(t);
  } else {
    s.appendRow([p.a, ch, JSON.stringify({ ans: {}, pos: 0, bm: [], bt: bt }), '否', '', '', '', 0, '', '', '', t, 0, t]);
  }
}
function btLoad_(p, ch) {
  var hit = findSave_(p.a, ch), o = hit ? saveObj_(hit.r) : null;
  return { save: o, bt: o && o.draft && o.draft.bt ? o.draft.bt : null };
}

/** 出征：有未完成的戰役就接著打；否則抽新題組（教師為不寫入紀錄的練習票證） */
function apiBattleStart(token, ch) {
  var p = authAny_(token), isT = p.r === 't'; ch = Number(ch);
  if (!isT && !chOpen_(ch)) throw new Error('本回尚未開放');
  var full = chapterFull_(ch), set = getSettings_();
  if (!full.qs.length) throw new Error('本回尚未建立題目');
  if (isT) {
    var btT = btNew_(full, set, []); btT.seen = [];
    var vT = btView_(full, btT, yes_(set['交卷後顯示解析'] || '是'));
    vT.ticket = sign_({ r: 'tg', ch: ch, nos: btT.nos, perm: btT.perm, e: Date.now() + 6 * 3600 * 1000 });
    vT.practice = true;
    return vT;
  }
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = btLoad_(p, ch), bt = L.bt;
    if (bt && !bt.fin) return btView_(full, bt, yes_(set['交卷後顯示解析'] || '是'));
    if (L.save && L.save.submitted && !yes_(set['允許重作'] || '是')) throw new Error('本回已交卷，老師未開放重作');
    var seen = bt ? bt.seen : (L.save && L.save.lastAns ? Object.keys(L.save.lastAns).map(Number) : []);
    bt = btNew_(full, set, seen);
    btWriteDraft_(p, ch, bt, now_());
    return btView_(full, bt, yes_(set['交卷後顯示解析'] || '是'));
  } finally { lock.releaseLock(); }
}
/** 答一題：伺服器記錄、批改，並回報正解（顯示用字母） */
function apiBattleAnswer(token, ch, no, letter) {
  var p = verify_(token, 's'); ch = Number(ch); no = Number(no); letter = str_(letter).toUpperCase();
  if ('ABCD'.indexOf(letter) < 0 || letter.length !== 1) throw new Error('請選 A～D');
  var full = chapterFull_(ch), set = getSettings_();
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var bt = btLoad_(p, ch).bt;
    if (!bt || bt.fin) throw new Error('請先出征');
    if (bt.nos.indexOf(no) < 0) throw new Error('這題不在本次出征內');
    if (bt.ans[no]) throw new Error('這題已經作答');
    bt.ans[no] = letter;
    btWriteDraft_(p, ch, bt, now_());
    var r = btResult_(full, bt, no, yes_(set['交卷後顯示解析'] || '是'));
    r.n = Object.keys(bt.ans).length; r.total = bt.nos.length;
    return r;
  } finally { lock.releaseLock(); }
}
/** 收兵：十題都答完後記成績 */
function apiBattleFinish(token, ch, pos, spent) {
  var p = verify_(token, 's'); ch = Number(ch);
  var full = chapterFull_(ch), set = getSettings_(), showExp = yes_(set['交卷後顯示解析'] || '是');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var L = btLoad_(p, ch), bt = L.bt;
    if (!bt || bt.fin) throw new Error('沒有進行中的出征');
    var left = bt.nos.filter(function (no) { return !bt.ans[no]; });
    if (left.length) throw new Error('還有 ' + left.length + ' 題未作答');
    var prev = L.save, s = sh_(SHEET.SAVE), t = now_(), hit = findSave_(p.a, ch);
    if (prev && prev.submitted && !yes_(set['允許重作'] || '是')) throw new Error('本回已交卷，老師未開放重作');
    var ans = btAnsOrig_(bt), res = grade_(full, ans, showExp);
    bt.fin = true;
    var tries = (prev ? prev.tries : 0) + 1;
    var first = prev && prev.first !== null ? prev.first : res.score;
    var best = prev && prev.best !== null ? Math.max(prev.best, res.score) : res.score;
    var row = [p.a, ch, JSON.stringify({ ans: {}, pos: Number(pos) || 0, bm: (prev && prev.draft && prev.draft.bm) || [], bt: bt }), '是', first, best, res.score, tries,
      JSON.stringify(ans), prev && prev.firstTime ? prev.firstTime : t, t, t,
      cleanSpent_(spent, prev ? prev.spent : 0), prev && prev.opened ? prev.opened : t];
    if (hit) s.getRange(hit.row, 1, 1, row.length).setValues([row]); else s.appendRow(row);
    var st = findStudent_(p.a), u = st ? userObj_(st.r) : { name: '', cls: '', seat: '' };
    sh_(SHEET.LOG).appendRow([t, p.a, u.name, u.cls, u.seat, ch, JSON.stringify(ans), res.score, tries, row[12]]);
    res.tries = tries; res.best = best; res.summary = full.summary; res.review = btReview_(full, bt, showExp);
    return res;
  } finally { lock.releaseLock(); }
}

/* ----- 訪客：不存檔，用簽章票證帶著題組 ----- */
function apiGuestBattleStart(ch) {
  ch = Number(ch); var set = getSettings_();
  if (!guestChapters_(set)[ch] || !chOpen_(ch)) throw new Error('本回需登入才能作答');
  var full = chapterFull_(ch);
  if (!full.qs.length) throw new Error('本回尚未建立題目');
  var bt = btNew_(full, set, []); bt.seen = [];
  var v = btView_(full, bt, yes_(set['交卷後顯示解析'] || '是'));
  v.ticket = sign_({ r: 'g', ch: ch, nos: bt.nos, perm: bt.perm, e: Date.now() + 6 * 3600 * 1000 });
  return v;
}
function guestBt_(ticket) {
  var p = verify_(ticket);
  if (p.r !== 'g' && p.r !== 'tg') throw new Error('權限不足');
  return { ch: p.ch, bt: { nos: p.nos, perm: p.perm, ans: {} } };
}
function apiGuestBattleAnswer(ticket, no, letter) {
  var g = guestBt_(ticket), full = chapterFull_(g.ch), set = getSettings_(); no = Number(no); letter = str_(letter).toUpperCase();
  if ('ABCD'.indexOf(letter) < 0 || letter.length !== 1 || g.bt.nos.indexOf(no) < 0) throw new Error('作答有誤');
  g.bt.ans[no] = letter;
  return btResult_(full, g.bt, no, yes_(set['交卷後顯示解析'] || '是'));
}
function apiGuestBattleFinish(ticket, ans) {
  var g = guestBt_(ticket), full = chapterFull_(g.ch), set = getSettings_(); ans = ans || {};
  g.bt.nos.forEach(function (no) { g.bt.ans[no] = str_(ans[no]).toUpperCase(); });
  var left = g.bt.nos.filter(function (no) { return 'ABCD'.indexOf(g.bt.ans[no]) < 0 || g.bt.ans[no].length !== 1; });
  if (left.length) throw new Error('還有 ' + left.length + ' 題未作答');
  var showExp = yes_(set['交卷後顯示解析'] || '是'), res = grade_(full, btAnsOrig_(g.bt), showExp);
  res.summary = full.summary; res.review = btReview_(full, g.bt, showExp); return res;
}

/** 已部署的專案：把第一回 20 題題庫寫進「題庫」工作表（只動第一回；請先執行 setupSheets） */
function applyQuestionBank1() {
  var s = sh_(SHEET.QB), data = rows_(SHEET.QB), idx = {}, add = [], upd = 0;
  data.forEach(function (r, i) { idx[Number(r[0]) + '|' + Number(r[1])] = i + 2; });
  SEED.questions.filter(function (q) { return q.ch === 1; }).forEach(function (q) {
    var row = [q.ch, q.no, q.type, q.stem, q.opts[0], q.opts[1], q.opts[2], q.opts[3], q.ans, q.exp, q.para, q.who || ''], at = idx[q.ch + '|' + q.no];
    if (at) { s.getRange(at, 1, 1, 12).setValues([row]); upd++; } else add.push(row);
  });
  if (add.length) s.getRange(s.getLastRow() + 1, 1, add.length, 12).setValues(add);
  clearContentCache();
  return '第一回題庫：更新 ' + upd + ' 題、新增 ' + add.length + ' 題';
}

/* ---------- 錯題本 ---------- */
function apiMistakes(token) {
  var p = authAny_(token); if (p.r === 't') return [];
  var a = str_(p.a).toLowerCase(), showExp = yes_(getSettings_()['交卷後顯示解析'] || '是'), out = [];
  var subs = [];
  rows_(SHEET.SAVE).forEach(function (r) {
    if (str_(r[0]).toLowerCase() !== a) return;
    var s = saveObj_(r); if (s.submitted && s.lastAns) subs.push(s);
  });
  var catMap = null, qbByCh = null;
  subs.forEach(function (s) {
    var cached = cacheGet_('ch_' + s.ch), num, title, qs;
    if (cached) { num = cached.num; title = cached.title; qs = cached.qs; }
    else {
      if (!catMap) {
        catMap = {}; catalog_().forEach(function (c) { catMap[c.ch] = c; });
        qbByCh = {};
        rows_(SHEET.QB).forEach(function (r) {
          var ch = Number(r[0]); if (!ch) return;
          (qbByCh[ch] = qbByCh[ch] || []).push({ no: Number(r[1]), type: str_(r[2]), stem: str_(r[3]), opts: [str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7])],
            ans: str_(r[8]).toUpperCase(), exp: str_(r[9]), para: Number(r[10]) || 0 });
        });
      }
      var cc = catMap[s.ch] || {}; num = cc.num || ''; title = cc.title || ''; qs = qbByCh[s.ch] || [];
    }
    qs.forEach(function (q) {
      var mine = str_(s.lastAns[q.no]).toUpperCase();
      if (mine && mine !== q.ans) out.push({ ch: s.ch, num: num, title: title, no: q.no, type: q.type, stem: q.stem, opts: q.opts,
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
  var p = authAny_(token); if (p.r === 't') return 0;
  var a = str_(p.a).toLowerCase(), have = {}, t = now_(), add = [];
  rows_(SHEET.FIX).forEach(function (r) { if (str_(r[0]).toLowerCase() === a) have[Number(r[1]) + '-' + Number(r[2])] = 1; });
  (list || []).slice(0, 60).forEach(function (x) {
    var ch = Number(x.ch), no = Number(x.no), k = ch + '-' + no;
    if (ch && no && !have[k]) { have[k] = 1; add.push([p.a, ch, no, t]); }
  });
  if (add.length) { var s = sh_(SHEET.FIX); s.getRange(s.getLastRow() + 1, 1, add.length, 4).setValues(add); }
  return add.length;
}

