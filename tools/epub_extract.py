#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
從好讀版《三國演義》epub 取出某一回原文，輸出「內容包」骨架（JSON）。
原文一律以這本 epub 為準；處理規則與第 1～5 回相同：
  1. 用 OpenCC（t2tw）轉成臺灣通行字形，再把 epub 的舊字形換成教育部標準字體（卽→即、靑→青……）
  2. 刪除 epub 的註號（①②…）
  3. 套用 FIX 校勘表（明顯訛字，據維基文庫等通行本改正；每筆都會印出）
  4. 行首四個全形空白者為詩詞，前面加「〔詩〕」
用法：
  pip install opencc-python-reimplemented
  python3 tools/epub_extract.py 三國演義.epub 6 > packs/第六回.json
  python3 tools/epub_extract.py 三國演義.epub 1 --compare packs/第一回.json   # 與既有內容包比對原文
"""
import sys, re, json, zipfile, html, argparse

try:
    import opencc
    _cc = opencc.OpenCC('t2tw')
except Exception:
    sys.exit('需要 OpenCC：pip install opencc-python-reimplemented')

# epub 舊字形 → 教育部標準字體
VAR = dict(zip('卽却旣靑鄕温敎淸衞猪眞寃尅毁効刴敍皐疎盃礮虀壻搆縧鎗挂', '即卻既青鄉溫教清衛豬真冤剋毀效剁敘皋疏杯砲齏婿構絛槍掛'))
# 校勘表：(epub 原字, 改正)。新增時請附上依據，並在內容包「校勘」欄說明
FIX = [('何南中部', '河南中部'), ('朱儁，其道盧植', '朱儁，具道盧植'), ('洛陽北都尉', '洛陽北部尉'), ('儁待之其厚', '儁待之甚厚'),
       ('逕入官中', '逕入宮中'), ('為巨逼兮', '為臣逼兮'), ('卓命牽出斬也', '卓命牽出斬之'), ('裡赤幘', '裹赤幘'), ('鰲鄉侯', '斄鄉侯')]
CN = '〇一二三四五六七八九'

def cnum(n):
    if n <= 10: return '十' if n == 10 else CN[n]
    if n < 20: return '十' + (CN[n % 10] if n % 10 else '')
    if n < 100: return CN[n // 10] + '十' + (CN[n % 10] if n % 10 else '')
    t = n % 100
    return '一百' + ('' if t == 0 else ('零' + CN[t] if t < 10 else cnum(t) if t >= 20 else '一' + cnum(t)))

def norm(s):
    s = _cc.convert(s).replace('并入', '併入').replace('并', '並')
    s = ''.join(VAR.get(c, c) for c in s)
    return re.sub('[①-⑳㉑-㉟]', '', s)

def chapter_lines(epub, ch):
    """好讀版：OEBPS/2.xhtml 是第一回，依序往後。回傳該檔的文字行（<br/> 斷行）"""
    z = zipfile.ZipFile(epub)
    raw = z.read('OEBPS/%d.xhtml' % (ch + 1)).decode('utf-8-sig')
    body = raw[raw.find('<body'):]
    body = re.sub(r'<br\s*/?>', '\n', body)
    body = re.sub(r'</?(h\d|p|div)[^>]*>', '\n', body)
    body = html.unescape(re.sub(r'<[^>]+>', '', body))
    return body.split('\n')

def extract(epub, ch):
    want = '第' + cnum(ch) + '回'
    title, paras, prev, used, started = None, [], None, [], False
    for l in chapter_lines(epub, ch):
        if l.startswith('－－－－'): break          # 之後是 epub 的註解區
        s = l.strip()
        if not s: continue
        m = re.match(r'^(第[一二三四五六七八九十百零]+回)[　 ]+(.+)$', s)
        if m:
            title = (m.group(1), m.group(2)); started = True; continue
        if s == prev: continue
        prev = s
        kind = 'poem' if l.startswith('　' * 4) else 'p'
        paras.append([kind, norm(s)])
    if not title: sys.exit('找不到回目行（%s）' % want)
    if title[0] != want: print('注意：檔案內回次為 %s，預期 %s' % (title[0], want), file=sys.stderr)
    for p in paras:
        for a, b in FIX:
            if a in p[1]: p[1] = p[1].replace(a, b); used.append(a + '→' + b)
    halves = [x for x in re.split(r'[　 ]+', norm(title[1])) if x]
    mid = (len(halves) + 1) // 2
    pack = {
        '格式版本': 1, '回': ch, '回次': title[0], '回目': ''.join(halves[:mid]) + '｜' + ''.join(halves[mid:]),
        '原文': [('〔詩〕' if k == 'poem' else '') + t for k, t in paras],
        '校勘': used,
        '題庫': [], '戰況': [], '註釋': [], '專名': [], '人物': [], '人物事蹟': [], '人物關係': [], '地點事件': [], '人物造型': [], '插圖': [],
        '回末小結': {'本回大事': [], '名句': '', '想一想': ''}
    }
    return pack

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('epub'); ap.add_argument('ch', type=int); ap.add_argument('--compare')
    a = ap.parse_args()
    pk = extract(a.epub, a.ch)
    for u in pk['校勘']: print('校勘：' + u, file=sys.stderr)
    if a.compare:
        old = json.load(open(a.compare, encoding='utf-8'))['原文']
        if old == pk['原文']: print('原文與 %s 完全一致（%d 段）' % (a.compare, len(old)))
        else:
            import difflib
            for l in difflib.unified_diff(old, pk['原文'], '內容包', 'epub', lineterm='', n=0): print(l)
            sys.exit(1)
    else:
        json.dump(pk, sys.stdout, ensure_ascii=False, indent=1); print()
